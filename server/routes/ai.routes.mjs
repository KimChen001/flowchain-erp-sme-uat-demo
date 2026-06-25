import { fetch as undiciFetch } from 'undici'
import { buildAiChatStatusResponse, normalizeAiChatMessage } from '../domain/ai-chat-status.mjs'
import { getAiToolRegistry } from '../domain/ai-tool-registry.mjs'
import { buildMrpPlan } from './mrp.routes.mjs'
import {
  ensureMarketPrices,
  ensureMarketSignals,
  fetchExternalSignals,
  marketPriceReply,
  normalizeMarketSignal,
} from './market.routes.mjs'

function localAiReply({ moduleId, question, activeInsight }, db, ctx) {
  const { ensurePurchaseRequests } = ctx
  const priceAnswer = marketPriceReply(question, db)
  if (priceAnswer) return priceAnswer
  const evidence = activeInsight?.title
    ? `当前系统关注「${activeInsight.title}」${activeInsight.metric ? `，核心指标是 ${activeInsight.metric}` : ''}。`
    : `当前模块是 ${moduleId || 'SCM 工作台'}。`
  const pending = db.purchaseOrders.filter((po) => po.status === '待审批').length
  const pendingRequests = ensurePurchaseRequests(db).filter((pr) => pr.status === '待审批').length
  const stockReceipts = db.receivingDocs.filter((doc) => doc.status === '质检中' || doc.status === '异常处理').length
  const latestPlan = (db.forecastPlans || []).find((plan) => plan.procurementSuggestion?.quantity > 0)
  const planNote = latestPlan
    ? `最近预测方案 ${latestPlan.id} 识别 ${latestPlan.sku} 最大净缺口，建议向 ${latestPlan.procurementSuggestion.supplier} 采购 ${Number(latestPlan.procurementSuggestion.quantity).toLocaleString()}${latestPlan.unit || ''}，预估金额 ${Number(latestPlan.procurementSuggestion.amount || 0).toLocaleString()} 元，优先级 ${latestPlan.procurementSuggestion.priority}。`
    : '当前还没有可执行的预测补货方案。'
  return `${evidence} 当前后端数据里有 ${db.purchaseOrders.length} 张采购订单，其中 ${pending} 张待审批；有 ${ensurePurchaseRequests(db).length} 张采购申请，其中 ${pendingRequests} 张待审批；有 ${db.receivingDocs.length} 张收货单，其中 ${stockReceipts} 张需要质检或异常跟进。${planNote} 建议先处理影响交付的待审批 PR/PO 和异常 GRN，再把预测净缺口转成采购申请。`
}

function aiConfidence(body, db, result = {}, ctx) {
  const { ensurePurchaseRequests, ensureInventoryMovements, supplierPerformance, supplierQuoteCount } = ctx
  const mrp = buildMrpPlan(db)
  const products = db.products || []
  const forecastPlans = db.forecastPlans || []
  const purchaseRequests = ensurePurchaseRequests(db)
  const inventoryMovements = ensureInventoryMovements(db)
  const supplierPerf = supplierPerformance(db)
  const q = String(body.question || '')
  const moduleId = String(body.moduleId || '')
  const externalSignalCount = Number(body.externalSignals?.signals?.length || 0)
  const poCount = db.purchaseOrders?.length || 0
  const grnCount = db.receivingDocs?.length || 0
  const quoteSkuCount = Number(supplierQuoteCount || 0)
  const levelOf = (score) => score >= 85 ? '高' : score >= 70 ? '中' : '低'
  const clampScore = (score) => Math.max(35, Math.min(96, Math.round(score)))
  const dimension = (key, label, rawScore, dimensionEvidence = [], dimensionWarnings = []) => {
    const score = clampScore(rawScore)
    return {
      key,
      label,
      score,
      level: levelOf(score),
      evidence: dimensionEvidence,
      warnings: dimensionWarnings,
    }
  }

  const forecastEvidence = []
  const forecastWarnings = []
  let forecastScore = 50
  if (products.length >= 6) {
    forecastScore += 8
    forecastEvidence.push(`${products.length} 个 SKU 主数据`)
  } else {
    forecastScore -= 6
    forecastWarnings.push('SKU 样本偏少')
  }
  if (forecastPlans.length > 0) {
    forecastScore += 14
    forecastEvidence.push(`${forecastPlans.length} 个保存预测方案`)
  } else {
    forecastWarnings.push('没有已保存预测方案')
  }
  if (purchaseRequests.length > 0) {
    forecastScore += 4
    forecastEvidence.push(`${purchaseRequests.length} 张 PR 可追溯预测/补货动作`)
  }
  if (/预测|forecast|需求|销量|季节|区间/.test(q)) forecastScore += 5

  const inventoryEvidence = []
  const inventoryWarnings = []
  let inventoryScore = 52
  if (products.length >= 6) {
    inventoryScore += 8
    inventoryEvidence.push(`${products.length} 个 SKU 库存口径`)
  }
  if (mrp.summary.exceptionCount > 0) {
    inventoryScore += 14
    inventoryEvidence.push(`${mrp.summary.exceptionCount} 条 MRP 例外`)
  } else {
    inventoryWarnings.push('当前 MRP 未形成例外样本')
  }
  if (inventoryMovements.length > 0) {
    inventoryScore += 7
    inventoryEvidence.push(`${inventoryMovements.length} 条库存事务`)
  } else {
    inventoryWarnings.push('库存事务流水较少')
  }
  if (/库存|MRP|补货|断货|缺口|安全库存|ROP|批次|仓库/.test(q) || moduleId === 'inventory') inventoryScore += 5

  const supplierEvidence = []
  const supplierWarnings = []
  let supplierScore = 50
  if (supplierPerf.length >= 5) {
    supplierScore += 15
    supplierEvidence.push(`${supplierPerf.length} 个供应商绩效`)
  } else {
    supplierScore -= 4
    supplierWarnings.push('供应商绩效样本偏少')
  }
  if (grnCount >= 5) {
    supplierScore += 8
    supplierEvidence.push(`${grnCount} 张 GRN/质检记录`)
  }
  if (quoteSkuCount > 0) {
    supplierScore += 7
    supplierEvidence.push(`${quoteSkuCount} 个 SKU 报价候选`)
  } else {
    supplierWarnings.push('缺少报价候选')
  }
  if (poCount >= 8) {
    supplierScore += 5
    supplierEvidence.push(`${poCount} 张 PO`)
  }
  if (/供应商|报价|RFQ|交期|质检|合同|币种|产能/.test(q) || moduleId === 'purchasing') supplierScore += 5

  const externalEvidence = []
  const externalWarnings = []
  let externalScore = 48
  if (externalSignalCount > 0) {
    externalScore += 18
    externalEvidence.push(`${externalSignalCount} 条外部信号`)
  }
  if (result.provider === 'market-data') {
    externalScore += 20
    externalEvidence.push('命中内部行情样本')
  }
  if (/外部|新闻|汇率|市场|价格|风险|铁|钢|铝|铜|美元|原油/.test(q)) {
    externalScore += 4
    if (!externalSignalCount && result.provider !== 'market-data') {
      externalScore -= 12
      externalWarnings.push('缺少可用的外部信号样本')
    }
  } else if (!externalSignalCount && result.provider !== 'market-data') {
    externalWarnings.push('外部市场未参与本次判断')
  }

  const dimensions = [
    dimension('forecast', '预测', forecastScore, forecastEvidence, forecastWarnings),
    dimension('inventory', '库存/MRP', inventoryScore, inventoryEvidence, inventoryWarnings),
    dimension('supplier', '供应商', supplierScore, supplierEvidence, supplierWarnings),
    dimension('external', '外部市场', externalScore, externalEvidence, externalWarnings),
  ]

  if (result.provider === 'local') {
    dimensions.forEach((item) => {
      item.score = clampScore(item.score - 5)
      item.level = levelOf(item.score)
    })
  }
  if (result.degraded) {
    dimensions.forEach((item) => {
      item.score = clampScore(item.score - 7)
      item.level = levelOf(item.score)
    })
  }

  const intentWeights = {
    forecast: (/预测|forecast|需求|销量|季节|区间/.test(q) || moduleId === 'forecast') ? 2.2 : 1,
    inventory: (/库存|MRP|补货|断货|缺口|安全库存|ROP|批次|仓库/.test(q) || moduleId === 'inventory') ? 2.2 : 1,
    supplier: (/供应商|报价|RFQ|交期|质检|合同|币种|产能/.test(q) || moduleId === 'purchasing') ? 2.2 : 1,
    external: (/外部|新闻|汇率|市场|价格|风险|铁|钢|铝|铜|美元|原油/.test(q) || result.provider === 'market-data') ? 2.2 : 0.8,
  }
  const totalWeight = dimensions.reduce((sum, item) => sum + Number(intentWeights[item.key] || 1), 0)
  const weighted = dimensions.reduce((sum, item) => sum + item.score * Number(intentWeights[item.key] || 1), 0) / totalWeight
  let score = weighted
  const evidence = Array.from(new Set(dimensions.flatMap((item) => item.evidence))).slice(0, 8)
  const warnings = Array.from(new Set(dimensions.flatMap((item) => item.warnings)))
  if (result.provider === 'local') {
    score -= 6
    warnings.push('模型服务不可用，当前使用本地规则解释')
  }
  if (result.degraded) {
    score -= 8
    warnings.push('AI 服务降级，需人工复核')
  }

  const bounded = clampScore(score)
  const weakDimensions = dimensions.filter((item) => item.score < 70).map((item) => item.label)
  return {
    score: bounded,
    level: levelOf(bounded),
    dimensions,
    evidence,
    warnings,
    recommendedValidation: weakDimensions.length
      ? `建议在审批前重点复核：${weakDimensions.join('、')}。`
      : warnings.length
        ? '建议在审批前复核主数据、预测版本、供应商报价和外部市场信号。'
      : '可作为审批说明草稿，但关键采购动作仍需人工确认。',
    method: '分维度规则校准：预测 + 库存/MRP + 供应商 + 外部市场，按问题意图加权',
  }
}

function extractResponseText(payload) {
  if (payload.output_text) return payload.output_text
  const chunks = []
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) chunks.push(content.text)
      if (content.type === 'text' && content.text) chunks.push(content.text)
    }
  }
  return chunks.join('\n').trim()
}

function buildAiContext({ moduleId, activeInsight }, db, ctx) {
  const {
    ensurePurchaseRequests,
    ensureInventoryMovements,
    ensureEvents,
    ensureAuditLog,
    supplierRecommendations,
  } = ctx
  const mrpPlan = buildMrpPlan(db)
  const topRecommendation = mrpPlan.exceptions[0]
    ? supplierRecommendations(db, { sku: mrpPlan.exceptions[0].sku, quantity: mrpPlan.exceptions[0].quantity })
    : null
  return {
    moduleId,
    activeInsight,
    purchaseOrders: db.purchaseOrders.slice(0, 12),
    purchaseRequests: ensurePurchaseRequests(db).slice(0, 12),
    inventoryMovements: ensureInventoryMovements(db).slice(0, 12),
    receivingDocs: db.receivingDocs.slice(0, 12),
    products: (db.products || []).slice(0, 12),
    suppliers: (db.suppliers || []).slice(0, 12),
    salesForecasts: (db.salesForecasts || []).slice(0, 12),
    forecastPlans: (db.forecastPlans || []).slice(0, 8),
    mrpPlan: {
      summary: mrpPlan.summary,
      exceptions: mrpPlan.exceptions.slice(0, 8),
    },
    supplierRecommendation: topRecommendation ? {
      sku: topRecommendation.sku,
      primary: topRecommendation.primary,
      backup: topRecommendation.backup,
      needsRfq: topRecommendation.needsRfq,
      split: topRecommendation.split,
    } : null,
    marketPrices: ensureMarketPrices(db).slice(0, 12),
    marketSignals: ensureMarketSignals(db).slice(0, 8),
    recentEvents: ensureEvents(db).slice(0, 8),
    recentAuditLog: ensureAuditLog(db).slice(0, 12),
  }
}

function buildAiSystemPrompt() {
  return [
    '你是一个供应链 ERP SaaS 内嵌 AI 分析助手。',
    '你只能基于提供的 ERP JSON 上下文回答；如果上下文包含外部信号，可以结合外部信号说明风险。',
    '回答要短、具体、业务化，包含数据依据和下一步建议。',
    '如果缺少关键数据，明确说需要人工确认。',
  ].join('\n')
}

function withOptionalDispatcher(options, dispatcher) {
  return dispatcher ? { ...options, dispatcher } : options
}

function shouldFetchExternalSignals(question = '') {
  return /联网|外部|新闻|汇率|关税|政策|天气|港口|航运|物流|市场|风险|国际|美元|进口/.test(question)
}

async function callOpenAI({ moduleId, question, activeInsight }, db, ctx) {
  const { openaiDispatcher, aiMaxTokens } = ctx
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return { provider: 'local', content: localAiReply({ moduleId, question, activeInsight }, db, ctx) }
  }

  const model = process.env.OPENAI_MODEL || 'gpt-5-mini'
  const context = buildAiContext({ moduleId, activeInsight }, db, ctx)

  const response = await undiciFetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    dispatcher: openaiDispatcher,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions: buildAiSystemPrompt(),
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `用户问题：${question}\n\nERP 上下文 JSON：${JSON.stringify(context)}`,
            },
          ],
        },
      ],
      max_output_tokens: aiMaxTokens,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`OpenAI API error ${response.status}: ${text}`)
  }

  const payload = await response.json()
  return { provider: 'openai', model, content: extractResponseText(payload) || '模型没有返回文本。' }
}

async function callDoubao({ moduleId, question, activeInsight }, db, ctx) {
  const { arkDispatcher, aiMaxTokens } = ctx
  const apiKey = process.env.ARK_API_KEY || process.env.DOUBAO_API_KEY
  if (!apiKey) {
    return { provider: 'local', content: localAiReply({ moduleId, question, activeInsight }, db, ctx) }
  }

  const model = process.env.ARK_MODEL || process.env.DOUBAO_MODEL || 'doubao-seed-2-0-lite-260215'
  const baseUrl = process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3'
  const context = buildAiContext({ moduleId, activeInsight }, db, ctx)
  const response = await undiciFetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, withOptionalDispatcher({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: aiMaxTokens,
      messages: [
        { role: 'system', content: buildAiSystemPrompt() },
        {
          role: 'user',
          content: [
            '下面是 ERP 上下文 JSON：',
            JSON.stringify(context),
            '',
            `请直接回答这个用户问题：${question}`,
          ].join('\n'),
        },
      ],
    }),
  }, arkDispatcher))

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Doubao API error ${response.status}: ${text}`)
  }

  const payload = await response.json()
  return {
    provider: 'doubao',
    model,
    content: payload.choices?.[0]?.message?.content || '模型没有返回文本。',
  }
}

async function callConfiguredAi(body, db, ctx) {
  const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase()
  const priceAnswer = marketPriceReply(body.question, db)
  if (priceAnswer) return { provider: 'market-data', content: priceAnswer }
  if (body.externalSignals) {
    db.marketSignals = [
      ...ensureMarketSignals(db),
      ...(body.externalSignals.signals || []).map(normalizeMarketSignal),
    ].slice(-12)
  }
  if (provider === 'doubao' || provider === 'ark') return callDoubao(body, db, ctx)
  return callOpenAI(body, db, ctx)
}

export async function handleAiRoute(ctx) {
  const { req, res, url, db, send, readBody, writeDb, event } = ctx

  if (req.method === 'GET' && url.pathname === '/api/ai/tools') {
    send(res, 200, { tools: getAiToolRegistry() })
    return true
  }

  if (req.method === 'POST' && url.pathname === '/api/ai/chat') {
    const startedAt = Date.now()
    const body = await readBody(req)
    body.question = normalizeAiChatMessage(body)
    if (!body.question) return send(res, 400, { error: 'question is required' })

    const statusQuery = buildAiChatStatusResponse(db, body)
    if (statusQuery) {
      const result = {
        ...statusQuery,
        usedWeb: false,
        timingMs: Date.now() - startedAt,
        externalMs: 0,
        modelMs: 0,
      }
      event(db, 'ai_chat_status_query', `AI answered ${result.intent.name} via ${result.provider}`, result.intent.name)
      await writeDb(db)
      send(res, 200, result)
      return true
    }

    const hasMarketAnswer = Boolean(marketPriceReply(body.question, db))
    const useWeb = !hasMarketAnswer && (body.useWeb === true || (body.useWeb !== false && shouldFetchExternalSignals(body.question)))
    let externalMs = 0
    if (useWeb) {
      const externalStartedAt = Date.now()
      body.externalSignals = await fetchExternalSignals()
      externalMs = Date.now() - externalStartedAt
    }
    let result
    const modelStartedAt = Date.now()
    try {
      result = await callConfiguredAi(body, db, ctx)
    } catch (error) {
      result = {
        provider: 'local',
        degraded: true,
        error: error.message,
        content: localAiReply(body, db, ctx),
      }
    }
    const modelMs = Date.now() - modelStartedAt
    result = {
      ...result,
      usedWeb: useWeb,
      timingMs: Date.now() - startedAt,
      externalMs,
      modelMs,
    }
    result.confidence = aiConfidence(body, db, result, ctx)
    event(db, 'ai_chat', `AI answered ${body.moduleId || 'unknown'} question via ${result.provider}`, body.moduleId || 'ai')
    await writeDb(db)
    return send(res, 200, result)
  }

  return false
}
