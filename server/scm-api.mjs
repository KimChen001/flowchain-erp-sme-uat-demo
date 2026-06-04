import http from 'node:http'
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetch as undiciFetch, ProxyAgent } from 'undici'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')
const dataFile = path.join(root, 'data', 'scm-demo.json')
const port = Number(process.env.SCM_API_PORT || 8787)
const distDir = path.join(root, 'dist')

async function loadEnv() {
  for (const name of ['.env.local', '.env']) {
    try {
      const raw = await readFile(path.join(root, name), 'utf8')
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eq = trimmed.indexOf('=')
        if (eq === -1) continue
        const key = trimmed.slice(0, eq).trim().replace(/^\uFEFF/, '')
        const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
        if (!process.env[key]) process.env[key] = value
      }
    } catch {
      // Optional local env file.
    }
  }
}

await loadEnv()

const openaiProxyUrl = process.env.OPENAI_PROXY_URL || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || 'http://127.0.0.1:15236'
const openaiDispatcher = openaiProxyUrl ? new ProxyAgent(openaiProxyUrl) : undefined
const arkProxyUrl = process.env.ARK_PROXY_URL || process.env.DOUBAO_PROXY_URL || ''
const arkDispatcher = arkProxyUrl ? new ProxyAgent(arkProxyUrl) : undefined
const webProxyUrl = process.env.WEB_PROXY_URL || process.env.OPENAI_PROXY_URL || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || 'http://127.0.0.1:15236'
const webDispatcher = webProxyUrl ? new ProxyAgent(webProxyUrl) : undefined
const aiMaxTokens = Number(process.env.AI_MAX_TOKENS || 520)
let externalCache = { at: 0, data: null }

async function readDb() {
  const raw = await readFile(dataFile, 'utf8')
  return JSON.parse(raw)
}

async function writeDb(db) {
  await mkdir(path.dirname(dataFile), { recursive: true })
  await writeFile(dataFile, JSON.stringify(db, null, 2), 'utf8')
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

function send(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(JSON.stringify(payload))
}

function sendText(res, status, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType })
  res.end(text)
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  return {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
  }[ext] || 'application/octet-stream'
}

async function sendStatic(req, res, url) {
  if (!['GET', 'HEAD'].includes(req.method)) return send(res, 404, { error: 'Not found' })
  const decodedPath = decodeURIComponent(url.pathname)
  const requested = decodedPath === '/' ? '/index.html' : decodedPath
  const normalized = path.normalize(requested).replace(/^(\.\.[/\\])+/, '')
  let filePath = path.join(distDir, normalized)
  if (!filePath.startsWith(distDir)) return sendText(res, 403, 'Forbidden')

  try {
    const info = await stat(filePath)
    if (info.isDirectory()) filePath = path.join(filePath, 'index.html')
  } catch {
    filePath = path.join(distDir, 'index.html')
  }

  try {
    const body = await readFile(filePath)
    res.writeHead(200, {
      'Content-Type': contentTypeFor(filePath),
      'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
    })
    if (req.method === 'HEAD') return res.end()
    return res.end(body)
  } catch {
    return sendText(res, 404, 'Not found')
  }
}

function todayLabel() {
  const now = new Date()
  return `${now.getMonth() + 1}月${now.getDate()}日`
}

function event(db, type, message, ref) {
  db.events.unshift({
    id: `EVT-${Date.now()}`,
    type,
    message,
    ref,
    at: new Date().toISOString(),
  })
  db.events = db.events.slice(0, 50)
}

function ensureUsers(db) {
  if (!Array.isArray(db.users)) db.users = []
  return db.users
}

function publicUser(user) {
  if (!user) return null
  const { token, ...safeUser } = user
  return safeUser
}

function normalizeLogin(body) {
  const email = String(body.email || '').trim().toLowerCase()
  const name = String(body.name || '').trim()
  const company = String(body.company || '').trim()
  const role = String(body.role || '供应链经理').trim()
  if (!email || !name || !company) {
    throw new Error('company, name and email are required')
  }
  return { email, name, company, role }
}

function demoMarketPrices() {
  const asOf = new Date().toISOString().slice(0, 16).replace('T', ' ')
  return [
    {
      symbol: 'FE-ORE-62',
      name: '铁矿石 62%粉矿',
      category: '黑色原料',
      price: 828,
      unit: '元/吨',
      changePct: 1.18,
      direction: 'up',
      asOf,
      source: 'UAT行情样本',
      procurementImpact: '影响钢结构件、铝型材替代方案和华东精工机械报价复核。',
    },
    {
      symbol: 'RB-HRB400E',
      name: '螺纹钢 HRB400E',
      category: '黑色成材',
      price: 3420,
      unit: '元/吨',
      changePct: 0.64,
      direction: 'up',
      asOf,
      source: 'UAT行情样本',
      procurementImpact: '若连续上涨，建议锁定本周钢材采购报价并复核安全库存。',
    },
    {
      symbol: 'HC-Q235B',
      name: '热轧卷板 Q235B',
      category: '黑色成材',
      price: 3568,
      unit: '元/吨',
      changePct: -0.22,
      direction: 'down',
      asOf,
      source: 'UAT行情样本',
      procurementImpact: '价格回落时可暂缓低优先级补采，优先处理高风险缺料订单。',
    },
    {
      symbol: 'AL-SHFE',
      name: '电解铝',
      category: '有色金属',
      price: 20480,
      unit: '元/吨',
      changePct: 0.35,
      direction: 'up',
      asOf,
      source: 'UAT行情样本',
      procurementImpact: '关联 SKU-00287 铝合金型材，当前库存低于安全线，应优先补采。',
    },
    {
      symbol: 'CU-SHFE',
      name: '电解铜',
      category: '有色金属',
      price: 78260,
      unit: '元/吨',
      changePct: -0.48,
      direction: 'down',
      asOf,
      source: 'UAT行情样本',
      procurementImpact: '可复核电气元件供应商报价，争取铜价回落带来的成本让利。',
    },
    {
      symbol: 'USD-CNY',
      name: '美元兑人民币',
      category: '汇率',
      price: 6.7694,
      unit: 'CNY',
      changePct: 0.12,
      direction: 'up',
      asOf,
      source: 'Frankfurter/缓存',
      procurementImpact: '美元计价进口件需确认报价有效期和锁汇策略。',
    },
  ]
}

function ensureMarketPrices(db) {
  if (!Array.isArray(db.marketPrices) || db.marketPrices.length === 0) {
    db.marketPrices = demoMarketPrices()
  }
  return db.marketPrices
}

function findMarketPrices(question = '', db) {
  const prices = ensureMarketPrices(db)
  const q = String(question).toLowerCase()
  if (/铁|钢|黑色|螺纹|热轧|iron|steel/.test(q)) {
    return prices.filter((item) => /铁|钢|热轧|螺纹/.test(item.name + item.category))
  }
  if (/铝|aluminium|aluminum/.test(q)) return prices.filter((item) => /铝/.test(item.name))
  if (/铜|copper/.test(q)) return prices.filter((item) => /铜/.test(item.name))
  if (/美元|汇率|usd|cny/.test(q)) return prices.filter((item) => /美元|USD/.test(item.name + item.symbol))
  if (/价格|行情|市场/.test(q)) return prices.slice(0, 5)
  return []
}

function marketPriceReply(question, db) {
  const matches = findMarketPrices(question, db)
  if (!matches.length) return null
  const lines = matches.map((item) => {
    const arrow = item.direction === 'up' ? '上涨' : item.direction === 'down' ? '下跌' : '持平'
    return `${item.name}: ${item.price}${item.unit}，${arrow} ${Math.abs(item.changePct)}%，${item.asOf}，${item.source}`
  })
  const impacts = matches.map((item) => `- ${item.procurementImpact}`).join('\n')
  return [
    '当前系统已有行情数据，可以回答这类问题。',
    lines.join('\n'),
    '',
    '采购影响建议:',
    impacts,
    '',
    '说明: 这是 UAT 行情样本/缓存数据，用于功能测试和业务链路验证；正式版应接入交易所、钢联、卓创、Wind 或企业采购行情源。',
  ].join('\n')
}

function localAiReply({ moduleId, question, activeInsight }, db) {
  const priceAnswer = marketPriceReply(question, db)
  if (priceAnswer) return priceAnswer
  const evidence = activeInsight?.title
    ? `当前系统关注「${activeInsight.title}」${activeInsight.metric ? `，核心指标是 ${activeInsight.metric}` : ''}。`
    : `当前模块是 ${moduleId || 'SCM 工作台'}。`
  const pending = db.purchaseOrders.filter((po) => po.status === '待审批').length
  const stockReceipts = db.receivingDocs.filter((doc) => doc.status === '质检中' || doc.status === '异常处理').length
  return `${evidence} 当前后端数据里有 ${db.purchaseOrders.length} 张采购订单，其中 ${pending} 张待审批；有 ${db.receivingDocs.length} 张收货单，其中 ${stockReceipts} 张需要质检或异常跟进。建议先处理影响交付的待审批 PO 和异常 GRN，再根据预测缺口生成新的采购申请。`
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

function buildAiContext({ moduleId, activeInsight }, db) {
  return {
    moduleId,
    activeInsight,
    purchaseOrders: db.purchaseOrders.slice(0, 12),
    receivingDocs: db.receivingDocs.slice(0, 12),
    products: (db.products || []).slice(0, 12),
    suppliers: (db.suppliers || []).slice(0, 12),
    salesForecasts: (db.salesForecasts || []).slice(0, 12),
    marketPrices: ensureMarketPrices(db).slice(0, 12),
    marketSignals: (db.marketSignals || []).slice(0, 8),
    recentEvents: db.events.slice(0, 8),
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

async function callOpenAI({ moduleId, question, activeInsight }, db) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return { provider: 'local', content: localAiReply({ moduleId, question, activeInsight }, db) }
  }

  const model = process.env.OPENAI_MODEL || 'gpt-5-mini'
  const context = buildAiContext({ moduleId, activeInsight }, db)

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

async function callDoubao({ moduleId, question, activeInsight }, db) {
  const apiKey = process.env.ARK_API_KEY || process.env.DOUBAO_API_KEY
  if (!apiKey) {
    return { provider: 'local', content: localAiReply({ moduleId, question, activeInsight }, db) }
  }

  const model = process.env.ARK_MODEL || process.env.DOUBAO_MODEL || 'doubao-seed-2-0-lite-260215'
  const baseUrl = process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3'
  const context = buildAiContext({ moduleId, activeInsight }, db)
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

async function callConfiguredAi(body, db) {
  const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase()
  const priceAnswer = marketPriceReply(body.question, db)
  if (priceAnswer) return { provider: 'market-data', content: priceAnswer }
  if (body.externalSignals) {
    db.marketSignals = [
      ...(db.marketSignals || []),
      ...body.externalSignals.signals,
    ].slice(-12)
  }
  if (provider === 'doubao' || provider === 'ark') return callDoubao(body, db)
  return callOpenAI(body, db)
}

async function fetchJson(url, timeoutMs = 4500, dispatcher = webDispatcher) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await undiciFetch(url, withOptionalDispatcher({
      signal: controller.signal,
      headers: { 'User-Agent': 'scm-saas-demo/0.1' },
    }, dispatcher))
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

async function fetchExternalSignals() {
  const now = Date.now()
  if (externalCache.data && now - externalCache.at < 15 * 60 * 1000) return externalCache.data

  const signals = []
  let fx = null
  let news = []

  const [fxResult, newsResult] = await Promise.allSettled([
    fetchJson('https://api.frankfurter.app/latest?from=USD&to=CNY,EUR,JPY', 3500),
    fetchJson('https://api.gdeltproject.org/api/v2/doc/doc?query=%22supply%20chain%22&mode=artlist&format=json&maxrecords=5', 3500),
  ])

  if (fxResult.status === 'fulfilled') {
    fx = fxResult.value
    signals.push({
      type: 'fx',
      title: `USD/CNY ${fx.rates?.CNY ?? 'N/A'}`,
      severity: '中',
      value: `Frankfurter ${fx.date}: USD/CNY=${fx.rates?.CNY}, USD/EUR=${fx.rates?.EUR}, USD/JPY=${fx.rates?.JPY}`,
      recommendedAction: '检查美元计价采购合同和进口件报价有效期。',
    })
  } else {
    signals.push({
      type: 'fx',
      title: '汇率数据暂不可用',
      severity: '低',
      value: fxResult.reason?.message || '外部汇率接口超时',
      recommendedAction: '稍后重试或改用内部财务汇率表。',
    })
  }

  if (newsResult.status === 'fulfilled') {
    const gdelt = newsResult.value
    news = (gdelt.articles || []).slice(0, 5).map((article) => ({
      title: article.title,
      url: article.url,
      domain: article.domain,
      seendate: article.seendate,
      sourcecountry: article.sourcecountry,
    }))
    if (news.length) {
      signals.push({
        type: 'news',
        title: '供应链相关新闻已联网更新',
        severity: '中',
        value: news.map((item) => `${item.title} (${item.domain})`).join('；'),
        recommendedAction: '结合供应商地区、品类和交期风险判断是否需要调整采购计划。',
      })
    }
  } else {
    news = [
      {
        title: '产业链供应链安全与物流韧性成为采购风险关注点',
        url: 'https://api.gdeltproject.org/',
        domain: 'gdeltproject.org',
        seendate: 'fallback',
        sourcecountry: 'Global',
      },
      {
        title: '制造业企业继续关注核心零部件交期与合规要求',
        url: 'https://api.gdeltproject.org/',
        domain: 'gdeltproject.org',
        seendate: 'fallback',
        sourcecountry: 'Global',
      },
    ]
    signals.push({
      type: 'news',
      title: '新闻联网限频，使用风险主题 fallback',
      severity: '低',
      value: newsResult.reason?.message || '外部新闻接口超时',
      recommendedAction: '保留内部 ERP 风险判断，稍后刷新外部信号。',
    })
  }

  externalCache = {
    at: now,
    data: { fetchedAt: new Date(now).toISOString(), fx, news, signals },
  }
  return externalCache.data
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 204, {})

    const url = new URL(req.url || '/', `http://localhost:${port}`)
    const db = await readDb()

    if (req.method === 'GET' && url.pathname === '/api/health') {
      return send(res, 200, {
        ok: true,
        purchaseOrders: db.purchaseOrders.length,
        receivingDocs: db.receivingDocs.length,
        openai: Boolean(process.env.OPENAI_API_KEY),
        doubao: Boolean(process.env.ARK_API_KEY || process.env.DOUBAO_API_KEY),
        provider: process.env.AI_PROVIDER || 'openai',
        model: (process.env.AI_PROVIDER || 'openai').toLowerCase() === 'doubao'
          ? (process.env.ARK_MODEL || process.env.DOUBAO_MODEL || 'doubao-seed-2-0-lite-260215')
          : (process.env.OPENAI_MODEL || 'gpt-5-mini'),
        proxy: {
          openai: Boolean(openaiDispatcher),
          doubao: Boolean(arkDispatcher),
          web: Boolean(webDispatcher),
        },
      })
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
      const body = await readBody(req)
      let profile
      try {
        profile = normalizeLogin(body)
      } catch (error) {
        return send(res, 400, { error: error.message })
      }
      const users = ensureUsers(db)
      const now = new Date().toISOString()
      let user = users.find((item) => item.email === profile.email)
      if (!user) {
        user = {
          id: `USR-${Date.now()}`,
          token: `demo-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          createdAt: now,
        }
        users.unshift(user)
      }
      Object.assign(user, profile, { lastLoginAt: now })
      event(db, 'user_login', `${user.name} logged in for ${user.company}`, user.id)
      await writeDb(db)
      return send(res, 200, { token: user.token, user: publicUser(user) })
    }

    if (req.method === 'GET' && url.pathname === '/api/auth/me') {
      const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
      const user = ensureUsers(db).find((item) => item.token === token)
      if (!user) return send(res, 401, { error: 'invalid demo token' })
      return send(res, 200, publicUser(user))
    }

    if (req.method === 'GET' && url.pathname === '/api/external-signals') {
      const external = await fetchExternalSignals()
      return send(res, 200, external)
    }

    if (req.method === 'GET' && url.pathname === '/api/market-prices') {
      const prices = ensureMarketPrices(db)
      return send(res, 200, {
        asOf: prices[0]?.asOf || null,
        source: 'UAT 行情数据',
        prices,
      })
    }

    if (req.method === 'POST' && url.pathname === '/api/market-prices/refresh') {
      const now = new Date().toISOString().slice(0, 16).replace('T', ' ')
      const prices = ensureMarketPrices(db).map((item, index) => {
        const wave = ((Date.now() / 1000 + index * 7) % 9 - 4) / 100
        const nextChange = Number((item.changePct + wave).toFixed(2))
        return {
          ...item,
          price: Number((item.price * (1 + wave / 100)).toFixed(item.price < 10 ? 4 : 0)),
          changePct: nextChange,
          direction: nextChange > 0 ? 'up' : nextChange < 0 ? 'down' : 'flat',
          asOf: now,
          source: item.source.includes('UAT') ? 'UAT行情刷新' : item.source,
        }
      })
      db.marketPrices = prices
      event(db, 'market_prices_refresh', '行情数据已刷新', 'market-prices')
      await writeDb(db)
      return send(res, 200, { asOf: now, source: 'UAT 行情数据', prices })
    }

    if (req.method === 'POST' && url.pathname === '/api/ai/chat') {
      const startedAt = Date.now()
      const body = await readBody(req)
      if (!body.question) return send(res, 400, { error: 'question is required' })
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
        result = await callConfiguredAi(body, db)
      } catch (error) {
        result = {
          provider: 'local',
          degraded: true,
          error: error.message,
          content: localAiReply(body, db),
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
      event(db, 'ai_chat', `AI answered ${body.moduleId || 'unknown'} question via ${result.provider}`, body.moduleId || 'ai')
      await writeDb(db)
      return send(res, 200, result)
    }

    if (req.method === 'GET' && url.pathname === '/api/purchase-orders') {
      return send(res, 200, db.purchaseOrders)
    }

    if (req.method === 'POST' && url.pathname === '/api/purchase-orders') {
      const body = await readBody(req)
      const po = {
        po: body.po || `PO-2026-${String(1300 + db.purchaseOrders.length).padStart(4, '0')}`,
        supplier: body.supplier || '未选择供应商',
        created: body.created || todayLabel(),
        eta: body.eta || '6月15日',
        owner: body.owner || '张磊',
        amount: Number(body.amount || 0),
        items: Number(body.items || 1),
        received: Number(body.received || 0),
        status: body.status || '待审批',
        priority: body.priority || '中',
        paid: Boolean(body.paid),
      }
      db.purchaseOrders.unshift(po)
      event(db, 'purchase_order_created', `采购订单 ${po.po} 已提交审批`, po.po)
      await writeDb(db)
      return send(res, 201, po)
    }

    const poStatusMatch = url.pathname.match(/^\/api\/purchase-orders\/([^/]+)\/status$/)
    if (req.method === 'PATCH' && poStatusMatch) {
      const poId = decodeURIComponent(poStatusMatch[1])
      const body = await readBody(req)
      const po = db.purchaseOrders.find((item) => item.po === poId)
      if (!po) return send(res, 404, { error: 'PO not found' })
      po.status = body.status || po.status
      if (typeof body.received === 'number') po.received = body.received
      event(db, 'purchase_order_status', `${po.po} 状态更新为 ${po.status}`, po.po)
      await writeDb(db)
      return send(res, 200, po)
    }

    if (req.method === 'GET' && url.pathname === '/api/receiving-docs') {
      return send(res, 200, db.receivingDocs)
    }

    if (req.method === 'POST' && url.pathname === '/api/receiving-docs') {
      const body = await readBody(req)
      const po = db.purchaseOrders.find((item) => item.po === body.po)
      const grn = {
        grn: body.grn || `GRN-202606-${String(430 + db.receivingDocs.length).padStart(4, '0')}`,
        po: body.po,
        supplier: body.supplier || po?.supplier || '—',
        arrived: body.arrived || `${todayLabel()} ${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`,
        dock: body.dock || 'Dock-02',
        receiver: body.receiver || '刘建华',
        items: Number(body.items || po?.items || 1),
        passed: Number(body.passed || 0),
        failed: Number(body.failed || 0),
        status: body.status || '质检中',
        warehouse: body.warehouse || '—',
      }
      db.receivingDocs.unshift(grn)
      if (po && po.status === '已发出') po.status = '部分到货'
      event(db, 'receiving_created', `收货单 ${grn.grn} 已创建`, grn.grn)
      await writeDb(db)
      return send(res, 201, grn)
    }

    const grnMatch = url.pathname.match(/^\/api\/receiving-docs\/([^/]+)$/)
    if (req.method === 'PATCH' && grnMatch) {
      const grnId = decodeURIComponent(grnMatch[1])
      const body = await readBody(req)
      const grn = db.receivingDocs.find((item) => item.grn === grnId)
      if (!grn) return send(res, 404, { error: 'GRN not found' })
      Object.assign(grn, body)
      const po = db.purchaseOrders.find((item) => item.po === grn.po)
      if (po && grn.status === '已入库') {
        po.received = Math.max(po.received, grn.items)
        if (po.received >= po.items) po.status = '已完成'
      }
      event(db, 'receiving_status', `${grn.grn} 状态更新为 ${grn.status}`, grn.grn)
      await writeDb(db)
      return send(res, 200, grn)
    }

    if (!url.pathname.startsWith('/api/')) return sendStatic(req, res, url)
    return send(res, 404, { error: 'Not found' })
  } catch (error) {
    return send(res, 500, { error: error.message })
  }
})

server.listen(port, () => {
  console.log(`FlowChain listening on http://127.0.0.1:${port}`)
})
