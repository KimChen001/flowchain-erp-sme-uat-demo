import { classifyAiBusinessIntent, AI_BUSINESS_INTENT_TAXONOMY } from './ai-business-intent-router.mjs'
import { buildAiCockpitFastPathResponse, buildAiDataLimitationResponse, buildAiEvidenceReuseResponse } from './ai-evidence-reuse.mjs'
import { buildAiProcurementOperationalResponse } from './ai-procurement-operational-query.mjs'
import { buildAiSupplierOperationalResponse } from './ai-supplier-operational-query.mjs'
import { buildAiRfqOperationalResponse } from './ai-rfq-operational-query.mjs'
import { routeAiModelPolicy } from './ai-model-router.mjs'

function text(value, fallback = '') {
  const next = String(value ?? '').trim()
  return next || fallback
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function poIdFor(po = {}, index = 0) {
  return text(po.po || po.poId || po.id || po.purchaseOrder || po.orderNo, `PO-${String(index + 1).padStart(4, '0')}`)
}

function receivingIdFor(doc = {}, index = 0) {
  return text(doc.grn || doc.id || doc.receivingId || doc.receiptNo, `GRN-${String(index + 1).padStart(4, '0')}`)
}

function expectedDateFor(po = {}) {
  return text(po.eta || po.expectedDate || po.dueDate || po.promisedDate || po.deliveryDate)
}

function isTerminalPoStatus(status = '') {
  return /已完成|已取消|已关闭|已收货|completed|cancelled|canceled|closed|received/i.test(text(status))
}

function orderedQuantityFor(po = {}) {
  if (asArray(po.lines).length) {
    return po.lines.reduce((sum, line) => sum + toNumber(line.quantityOrdered ?? line.orderedQty ?? line.qty, 0), 0)
  }
  return toNumber(po.totalOrderedQty ?? po.items ?? po.quantity ?? po.recommendedQty, 0)
}

function receivedQuantityFor(po = {}, linkedDocs = []) {
  const direct = toNumber(po.totalReceivedQty ?? po.received ?? po.receivedQuantity, NaN)
  if (Number.isFinite(direct)) return direct
  return linkedDocs.reduce((sum, doc) => sum + toNumber(doc.passed ?? doc.receivedQuantity ?? doc.acceptedQty ?? doc.items, 0), 0)
}

function receivingDocsForPo(db = {}, poId = '') {
  return asArray(db.receivingDocs).filter((doc) => text(doc.po || doc.poId || doc.purchaseOrder).toUpperCase() === poId.toUpperCase())
}

function isOverdue(po = {}, now = new Date()) {
  const raw = expectedDateFor(po)
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)?.[0]
  if (!iso) return /逾期|overdue/i.test(text(po.status || po.risk || po.reason))
  return new Date(`${iso}T00:00:00.000Z`).getTime() < now.getTime() && !isTerminalPoStatus(po.status)
}

function receivingGapRows(db = {}, options = {}) {
  const now = options.now ? new Date(options.now) : new Date()
  return asArray(db.purchaseOrders)
    .map((po, index) => {
      const poId = poIdFor(po, index)
      const linkedDocs = receivingDocsForPo(db, poId)
      const orderedQuantity = orderedQuantityFor(po)
      const receivedQuantity = receivedQuantityFor(po, linkedDocs)
      const remainingQuantity = Math.max(0, orderedQuantity - receivedQuantity)
      return {
        po,
        poId,
        supplier: text(po.supplier || po.supplierName),
        status: text(po.status),
        orderedQuantity,
        receivedQuantity,
        remainingQuantity,
        expectedDate: expectedDateFor(po),
        overdue: isOverdue(po, now),
        linkedGrns: linkedDocs.map((doc, docIndex) => receivingIdFor(doc, docIndex)),
      }
    })
    .filter((row) => !isTerminalPoStatus(row.status) && (row.remainingQuantity > 0 || /未收货|部分到货|待收货|已发出|已审批|待审批/i.test(row.status)))
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || b.remainingQuantity - a.remainingQuantity || a.poId.localeCompare(b.poId))
}

function evidenceCard(evidence = []) {
  return { type: 'evidence', evidence }
}

function recommendedActions(actions = []) {
  return { type: 'recommended_actions', actions }
}

export function isReceivingGapPrompt(message = '') {
  return /(?:订单|采购单|PO|po|收货|到货|未收|没收|剩余|还有多少)/.test(message) &&
    /(?:没有收货|未收货|没收货|没收|还没到货|未到货|部分到货|剩余.*(?:收货|到货)|收货数量)/.test(message)
}

export function buildAiReceivingGapResponse(db = {}, body = {}, options = {}) {
  const message = text(body.question || body.message || body.prompt || body.text)
  if (!message || !isReceivingGapPrompt(message)) return null
  const rows = receivingGapRows(db, options)
  const topRows = rows.slice(0, 5)
  const evidence = topRows.flatMap((row) => [
    {
      type: 'purchase_order',
      id: row.poId,
      label: `采购单 ${row.poId} 未完全收货`,
      summary: `${row.poId} 已收 ${row.receivedQuantity} / 订购 ${row.orderedQuantity}，剩余 ${row.remainingQuantity} 未到货。${row.expectedDate ? `预计日期 ${row.expectedDate}。` : '预计日期缺失。'}`,
      status: row.status,
    },
    ...row.linkedGrns.slice(0, 2).map((grnId) => ({
      type: 'receiving',
      id: grnId,
      label: `收货单 ${grnId}`,
      summary: `${grnId} 关联 ${row.poId}，用于复核已收数量和质检状态。`,
    })),
  ])
  if (!evidence.length) {
    evidence.push({ type: 'empty_state', id: 'receiving_gap', summary: '当前没有发现未完全收货的开放采购单。' })
  }
  const totalRemaining = rows.reduce((sum, row) => sum + row.remainingQuantity, 0)
  const keyFacts = topRows.map((row) => `${row.poId}：已收 ${row.receivedQuantity} / 订购 ${row.orderedQuantity}，剩余 ${row.remainingQuantity}；供应商 ${row.supplier || '未记录'}；状态 ${row.status || '未记录'}${row.overdue ? '；已逾期' : ''}`)
  const content = rows.length
    ? `目前需要关注 ${rows.length} 张未完全收货采购单，合计剩余 ${totalRemaining} 件未到货。${keyFacts.join('；')}。`
    : '当前没有发现未完全收货的开放采购单。'
  return {
    provider: 'local',
    providerStatus: 'deterministic',
    mode: 'deterministic',
    intent: { name: AI_BUSINESS_INTENT_TAXONOMY.receivingGap, confidence: 0.9, slots: {} },
    content,
    message: content,
    cards: [
      {
        type: 'receiving_gap_summary',
        title: '未收货订单',
        data: {
          openGapCount: rows.length,
          totalRemainingQuantity: totalRemaining,
          topPurchaseOrders: topRows.map((row) => ({
            poId: row.poId,
            supplier: row.supplier,
            status: row.status,
            orderedQuantity: row.orderedQuantity,
            receivedQuantity: row.receivedQuantity,
            remainingQuantity: row.remainingQuantity,
            expectedDate: row.expectedDate,
            overdue: row.overdue,
            relatedGrnIds: row.linkedGrns,
          })),
          limitations: rows.some((row) => !row.orderedQuantity) ? ['部分 PO 缺少明确订购数量，已按可用汇总字段展示。'] : [],
        },
        evidence,
      },
      evidenceCard(evidence),
      recommendedActions(topRows.slice(0, 3).flatMap((row) => [
        { label: `打开 ${row.poId}`, kind: 'deep_link', target: `/procurement?view=orders&poId=${encodeURIComponent(row.poId)}` },
        ...(row.linkedGrns[0] ? [{ label: `查看关联 GRN ${row.linkedGrns[0]}`, kind: 'deep_link', target: `/procurement?view=receiving&receivingId=${encodeURIComponent(row.linkedGrns[0])}` }] : []),
        {
          label: `预览 ${row.poId} 供应商交期跟进草稿，需人工审阅后再发送。`,
          kind: 'draft_preview',
          target: '',
          draftType: 'po_followup_draft',
          draftTitle: `${row.poId} 供应商交期跟进草稿预览`,
          requiresHumanReview: true,
          payload: {
            poId: row.poId,
            message: `请确认 ${row.poId} 剩余 ${row.remainingQuantity} 件未到货部分的预计交期。当前状态为 ${row.status || '待确认'}。`,
            reason: 'AI 基于未完全收货证据建议跟进供应商交期。',
          },
          originEvidence: evidence.filter((item) => item.id === row.poId || row.linkedGrns.includes(item.id)),
        },
      ]).slice(0, 5)),
    ],
    evidence,
    readModelReuse: true,
    usedWeb: false,
  }
}

const PUNCTUATION_SEPARATORS = /[，,。；;？?]/g
const CONNECTOR_SEPARATORS = /\b(?:还有|以及|同时|另外|顺便|并且)\b|(?:帮我一起看|以及|同时|另外|顺便|并且)/g
const COMPOUND_INTENTS = new Set([
  AI_BUSINESS_INTENT_TAXONOMY.attentionOverview,
  AI_BUSINESS_INTENT_TAXONOMY.todayPriority,
  AI_BUSINESS_INTENT_TAXONOMY.procurementRisk,
  AI_BUSINESS_INTENT_TAXONOMY.receivingGap,
  AI_BUSINESS_INTENT_TAXONOMY.supplierFollowup,
  AI_BUSINESS_INTENT_TAXONOMY.inventoryRisk,
  AI_BUSINESS_INTENT_TAXONOMY.rfqFollowup,
  AI_BUSINESS_INTENT_TAXONOMY.dataLimitation,
])

function normalizeSubIntent(intent = '') {
  if (intent === AI_BUSINESS_INTENT_TAXONOMY.attentionOverview) return AI_BUSINESS_INTENT_TAXONOMY.todayPriority
  return intent
}

export function splitCompoundBusinessQuestion(question = '') {
  const normalized = text(question)
  const punctuationParts = normalized
    .split(PUNCTUATION_SEPARATORS)
    .map((part) => text(part))
    .filter((part) => part.length >= 3)
  if (punctuationParts.length > 1) return punctuationParts
  return normalized
    .split(CONNECTOR_SEPARATORS)
    .map((part) => text(part))
    .filter((part) => part.length >= 3)
}

export function classifyCompoundBusinessQuery(body = {}) {
  const question = text(body.question || body.message || body.prompt || body.text)
  const parts = splitCompoundBusinessQuestion(question)
  const candidates = parts.length > 1 ? parts : [question]
  const subQueries = []
  const seen = new Set()
  for (const part of candidates) {
    const route = classifyAiBusinessIntent({ ...body, question: part, message: part })
    const intent = isReceivingGapPrompt(part) ? AI_BUSINESS_INTENT_TAXONOMY.receivingGap : route.intent
    if (!COMPOUND_INTENTS.has(intent)) continue
    const key = normalizeSubIntent(intent)
    if (seen.has(key)) continue
    seen.add(key)
    subQueries.push({
      text: part,
      intent,
      confidence: intent === AI_BUSINESS_INTENT_TAXONOMY.receivingGap ? Math.max(route.confidence, 0.9) : route.confidence,
      entities: route.entities || [],
      routeReason: intent === AI_BUSINESS_INTENT_TAXONOMY.receivingGap ? 'receiving_gap_task' : route.routeReason,
      modelPolicy: route.modelPolicy,
    })
  }
  return {
    isCompound: subQueries.length >= 2,
    subQueries,
    primaryIntent: subQueries[0]?.intent || classifyAiBusinessIntent(body).intent,
    orchestrationReason: subQueries.length >= 2 ? 'multiple_business_intent_signals' : 'single_business_intent',
  }
}

export function detectCompoundBusinessQuery(body = {}) {
  return classifyCompoundBusinessQuery(body).isCompound
}

function sectionTitleFor(intent = '') {
  if ([AI_BUSINESS_INTENT_TAXONOMY.attentionOverview, AI_BUSINESS_INTENT_TAXONOMY.todayPriority].includes(intent)) return '今日待办 / 今日重点'
  if (intent === AI_BUSINESS_INTENT_TAXONOMY.receivingGap) return '未收货订单'
  if (intent === AI_BUSINESS_INTENT_TAXONOMY.supplierFollowup) return '供应商风险 / 供应商跟进'
  if (intent === AI_BUSINESS_INTENT_TAXONOMY.inventoryRisk) return '库存风险'
  if (intent === AI_BUSINESS_INTENT_TAXONOMY.rfqFollowup) return 'RFQ 回复'
  if (intent === AI_BUSINESS_INTENT_TAXONOMY.dataLimitation) return '数据限制'
  return '业务问题'
}

function collectActions(response = {}) {
  return asArray(response.cards).find((card) => card.type === 'recommended_actions')?.actions || []
}

function dedupeBy(items = [], keyOf = (item) => JSON.stringify(item)) {
  const seen = new Set()
  const result = []
  for (const item of items) {
    const key = keyOf(item)
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }
  return result
}

function buildSubResponse(db = {}, body = {}, subQuery = {}, options = {}) {
  const subBody = { ...body, question: subQuery.text, message: subQuery.text }
  if ([AI_BUSINESS_INTENT_TAXONOMY.attentionOverview, AI_BUSINESS_INTENT_TAXONOMY.todayPriority].includes(subQuery.intent)) {
    return buildAiCockpitFastPathResponse(db, { ...subBody, moduleId: 'overview' }, options)
  }
  if (subQuery.intent === AI_BUSINESS_INTENT_TAXONOMY.receivingGap) {
    return buildAiReceivingGapResponse(db, subBody, options)
  }
  if (subQuery.intent === AI_BUSINESS_INTENT_TAXONOMY.supplierFollowup) {
    return buildAiEvidenceReuseResponse(db, subBody, options) || buildAiSupplierOperationalResponse(db, subBody, options)
  }
  if (subQuery.intent === AI_BUSINESS_INTENT_TAXONOMY.rfqFollowup) {
    return buildAiRfqOperationalResponse(db, subBody, options) || buildAiEvidenceReuseResponse(db, subBody, options)
  }
  if (subQuery.intent === AI_BUSINESS_INTENT_TAXONOMY.dataLimitation) {
    return buildAiDataLimitationResponse(db, subBody, options)
  }
  if (subQuery.intent === AI_BUSINESS_INTENT_TAXONOMY.procurementRisk) {
    return buildAiProcurementOperationalResponse(db, subBody, options) || buildAiEvidenceReuseResponse(db, subBody, options)
  }
  return buildAiEvidenceReuseResponse(db, subBody, options)
}

export function buildAiCompoundQueryResponse(db = {}, body = {}, options = {}) {
  const classification = classifyCompoundBusinessQuery(body)
  if (!classification.isCompound) return null
  const sections = []
  const evidence = []
  const actions = []
  for (const subQuery of classification.subQueries) {
    const response = buildSubResponse(db, body, subQuery, options)
    if (!response) {
      sections.push({
        title: sectionTitleFor(subQuery.intent),
        intent: subQuery.intent,
        conclusion: '当前没有足够的确定性规则回答这一部分。',
        keyFacts: [],
        limitations: ['该子问题需要补充业务对象或等待后续能力扩展。'],
      })
      continue
    }
    const sectionEvidence = asArray(response.evidence).slice(0, 4)
    sections.push({
      title: sectionTitleFor(subQuery.intent),
      intent: subQuery.intent,
      conclusion: text(response.message || response.content),
      keyFacts: sectionEvidence.map((item) => text(item.summary || item.label || item.id)).filter(Boolean).slice(0, 4),
      evidenceIds: sectionEvidence.map((item) => item.id).filter(Boolean),
      limitations: asArray(response.cards).flatMap((card) => asArray(card.data?.limitations)).slice(0, 3),
    })
    evidence.push(...asArray(response.evidence))
    actions.push(...collectActions(response))
  }
  const dedupedEvidence = dedupeBy(evidence, (item) => `${item.type || 'evidence'}:${item.id || item.label || item.summary}`)
  const dedupedActions = dedupeBy(actions, (item) => `${item.kind}:${item.label}:${item.target || item.draftType || ''}`).slice(0, 8)
  const sectionNames = sections.map((section) => section.title.replace(/\s*\/.*$/, '')).join('、')
  const content = `我把这个问题拆成 ${sections.length} 部分来看：${sectionNames}。${sections.map((section) => `${section.title}：${section.conclusion}`).join(' ')}`
  const modelRoute = routeAiModelPolicy({ intent: AI_BUSINESS_INTENT_TAXONOMY.compoundBusiness })
  return {
    provider: 'local',
    providerStatus: 'deterministic',
    mode: 'deterministic',
    intent: {
      name: AI_BUSINESS_INTENT_TAXONOMY.compoundBusiness,
      confidence: Math.min(0.92, Math.max(...classification.subQueries.map((item) => item.confidence), 0.8)),
      slots: {},
    },
    aiBusinessIntent: classification,
    aiModelRoute: modelRoute,
    subIntents: classification.subQueries.map((item) => item.intent),
    sections,
    content,
    message: content,
    cards: [
      {
        type: 'compound_summary',
        title: '多问题拆解',
        data: {
          orchestrationReason: classification.orchestrationReason,
          subIntents: classification.subQueries.map((item) => item.intent),
          sections: sections.map((section) => ({
            title: section.title,
            conclusion: section.conclusion,
            keyFacts: section.keyFacts,
            limitations: section.limitations,
          })),
        },
        evidence: dedupedEvidence.slice(0, 8),
      },
      ...sections.map((section) => ({
        type: 'compound_section',
        title: section.title,
        data: section,
        evidence: dedupedEvidence.filter((item) => section.evidenceIds?.includes(item.id)).slice(0, 4),
      })),
      evidenceCard(dedupedEvidence.slice(0, 10)),
      recommendedActions(dedupedActions),
    ],
    evidence: dedupedEvidence,
    readModelReuse: true,
    usedWeb: false,
  }
}

export const orchestrateCompoundBusinessQuery = buildAiCompoundQueryResponse
