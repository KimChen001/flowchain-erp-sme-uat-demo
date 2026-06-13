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
const purchaseRequestStatuses = new Set(['草稿', '待审批', '已批准', '已驳回', '已转PO', '已取消'])
const purchaseOrderStatuses = new Set(['草稿', '待审批', '已审批', '已发出', '部分到货', '已完成', '已驳回', '已取消'])
const priorities = new Set(['高', '中', '低'])
const systemRequestSources = new Set(['forecast', 'inventory', 'mrp-release'])
const postedReceivingStatuses = new Set(['已入库', '异常处理'])

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

function ensurePurchaseRequests(db) {
  if (!Array.isArray(db.purchaseRequests)) db.purchaseRequests = []
  return db.purchaseRequests
}

function ensureInventoryMovements(db) {
  if (!Array.isArray(db.inventoryMovements)) db.inventoryMovements = []
  return db.inventoryMovements
}

function ensureSopCycles(db) {
  if (!Array.isArray(db.sopCycles)) db.sopCycles = []
  return db.sopCycles
}

const defaultRfqs = [
  { id: 'RFQ-26-0042', title: 'Q3 铝合金型材集采', category: '原材料', suppliers: 6, quoted: 5, bestPrice: 18.6, bestSupplier: '江苏铝合金集团', due: '2026-06-10', status: '比价中' },
  { id: 'RFQ-26-0043', title: '标准紧固件年框', category: '通用件', suppliers: 8, quoted: 8, bestPrice: 0.42, bestSupplier: '佛山标准件', due: '2026-05-30', status: '已授标' },
  { id: 'RFQ-26-0044', title: 'PCB 板代工', category: '电子', suppliers: 4, quoted: 3, bestPrice: 86.4, bestSupplier: '深圳新元电气', due: '2026-06-15', status: '进行中' },
  { id: 'RFQ-26-0045', title: '切削液 12 个月供货', category: '耗材', suppliers: 5, quoted: 4, bestPrice: 24.8, bestSupplier: '广州化工耗材', due: '2026-06-08', status: '比价中' },
  { id: 'RFQ-26-0046', title: '高精度数控刀具', category: '工具', suppliers: 3, quoted: 2, bestPrice: 312, bestSupplier: '华东精工机械', due: '2026-06-22', status: '进行中' },
]

function ensureRfqs(db) {
  if (!Array.isArray(db.rfqs)) db.rfqs = defaultRfqs
  return db.rfqs
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

function nextSequenceId(items, field, prefix, start) {
  const max = items.reduce((highest, item) => {
    const match = String(item?.[field] || '').match(/(\d+)$/)
    return match ? Math.max(highest, Number(match[1])) : highest
  }, start - 1)
  return `${prefix}${String(max + 1).padStart(4, '0')}`
}

function recordInventoryMovement(db, movement) {
  const movements = ensureInventoryMovements(db)
  const id = movement.id || nextSequenceId(movements, 'id', 'MV-2026-', 1)
  const timestamp = movement.timestamp || new Date().toISOString()
  const record = {
    id,
    movementId: movement.movementId || id,
    ts: timestamp,
    timestamp,
    ...movement,
    id,
    movementId: movement.movementId || id,
  }
  movements.unshift(record)
  db.inventoryMovements = movements.slice(0, 200)
  return record
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function supplierIdFor(name = '') {
  return String(name || 'unknown-supplier')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '') || 'unknown-supplier'
}

function warehouseIdFor(value = '') {
  const raw = String(value || '').trim()
  if (!raw || raw === '—') return ''
  return raw.replace(/\s+/g, '-')
}

function makePoLineId(poId, index = 0) {
  return `${poId}-L${String(index + 1).padStart(3, '0')}`
}

function lineStatusFromQuantities(line) {
  const ordered = Math.max(0, toNumber(line.quantityOrdered))
  const received = Math.max(0, toNumber(line.quantityReceived))
  const accepted = Math.max(0, toNumber(line.quantityAccepted))
  const rejected = Math.max(0, toNumber(line.quantityRejected))
  if (ordered <= 0) return 'closed'
  if (received <= 0) return 'open'
  if (received < ordered) return 'partially_received'
  return rejected > 0 ? 'closed' : 'received'
}

function normalizePoLine(line, po, index = 0) {
  const poId = po.po || po.poId || line.poId || ''
  const quantityOrdered = Math.max(0, toNumber(line.quantityOrdered ?? line.quantity ?? line.qty ?? po.recommendedQty ?? po.items ?? 1, 1))
  const quantityReceived = Math.max(0, toNumber(line.quantityReceived ?? line.receivedQty ?? line.received ?? 0))
  const quantityAccepted = Math.max(0, toNumber(line.quantityAccepted ?? line.acceptedQty ?? line.accepted ?? 0))
  const quantityRejected = Math.max(0, toNumber(line.quantityRejected ?? line.rejectedQty ?? line.rejected ?? 0))
  const normalized = {
    poLineId: line.poLineId || makePoLineId(poId, index),
    poId,
    sku: line.sku || po.sourceSku || '',
    itemName: line.itemName || line.name || po.sourceName || po.reason || `采购明细 ${index + 1}`,
    quantityOrdered,
    quantityReceived,
    quantityAccepted,
    quantityRejected,
    unit: line.unit || po.unit || '',
    unitPrice: toNumber(line.unitPrice ?? po.unitPrice ?? 0),
    currency: line.currency || po.currency || 'CNY',
    supplierId: line.supplierId || po.supplierId || supplierIdFor(po.supplier),
    warehouseId: line.warehouseId || po.warehouseId || warehouseIdFor(po.warehouse),
    requiredDate: line.requiredDate || po.requiredDate || po.eta || '',
    promisedDate: line.promisedDate || po.promisedDate || po.eta || '',
    status: line.status || '',
  }
  normalized.status = lineStatusFromQuantities(normalized)
  return normalized
}

function ensurePoLines(po) {
  const rawLines = Array.isArray(po.lines) && po.lines.length > 0
    ? po.lines
    : [{
        poLineId: makePoLineId(po.po || po.poId || '', 0),
        sku: po.sourceSku || '',
        itemName: po.sourceName || po.reason || `${po.po || 'PO'} 汇总行`,
        quantityOrdered: toNumber(po.recommendedQty || po.items || 1, 1),
        quantityReceived: toNumber(po.received || 0),
        quantityAccepted: toNumber(po.accepted || po.received || 0),
        quantityRejected: toNumber(po.rejected || 0),
        unit: po.unit || '',
        unitPrice: toNumber(po.unitPrice || (toNumber(po.amount) && toNumber(po.recommendedQty) ? toNumber(po.amount) / toNumber(po.recommendedQty) : 0)),
        currency: po.currency || 'CNY',
      }]
  po.lines = rawLines.map((line, index) => normalizePoLine(line, po, index))
  return po.lines
}

function calculatePoHeaderFromLines(po) {
  const lines = ensurePoLines(po)
  const quantityOrdered = lines.reduce((sum, line) => sum + toNumber(line.quantityOrdered), 0)
  const quantityReceived = lines.reduce((sum, line) => sum + toNumber(line.quantityReceived), 0)
  const quantityAccepted = lines.reduce((sum, line) => sum + toNumber(line.quantityAccepted), 0)
  const quantityRejected = lines.reduce((sum, line) => sum + toNumber(line.quantityRejected), 0)
  const amount = lines.reduce((sum, line) => sum + toNumber(line.quantityOrdered) * toNumber(line.unitPrice), 0)
  po.lineCount = lines.length
  po.totalOrderedQty = quantityOrdered
  po.totalReceivedQty = quantityReceived
  po.totalAcceptedQty = quantityAccepted
  po.totalRejectedQty = quantityRejected
  po.totalAmount = amount
  po.itemsMeaning = 'totalOrderedQty'
  po.items = quantityOrdered
  po.received = quantityReceived
  po.amount = amount
  po.sourceSku = po.sourceSku || lines.find((line) => line.sku)?.sku || ''
  po.sourceName = po.sourceName || lines.find((line) => line.itemName)?.itemName || ''
  po.recommendedQty = po.recommendedQty || quantityOrdered
  po.unit = po.unit || lines.find((line) => line.unit)?.unit || ''
  po.unitPrice = po.unitPrice || toNumber(lines[0]?.unitPrice || 0)
  return po
}

function headerStatusFromLines(po) {
  const lines = ensurePoLines(po)
  if (lines.length === 0) return { status: po.status || '待审批', erpStatus: 'open' }
  const anyReceived = lines.some((line) => toNumber(line.quantityReceived) > 0)
  const allCompleted = lines.every((line) => ['received', 'closed'].includes(line.status))
  const anyRejected = lines.some((line) => toNumber(line.quantityRejected) > 0)
  if (allCompleted) return { status: '已完成', erpStatus: anyRejected ? 'closed' : 'received' }
  if (anyReceived) return { status: '部分到货', erpStatus: 'partially_received' }
  return { status: po.status || '待审批', erpStatus: po.erpStatus || 'open' }
}

function normalizePurchaseOrder(po) {
  if (!po || typeof po !== 'object') return po
  ensurePoLines(po)
  calculatePoHeaderFromLines(po)
  if (!po.erpStatus) po.erpStatus = headerStatusFromLines(po).erpStatus
  return po
}

function normalizePurchaseOrders(db) {
  if (!Array.isArray(db.purchaseOrders)) db.purchaseOrders = []
  db.purchaseOrders = db.purchaseOrders.map((po) => normalizePurchaseOrder(po))
  return db.purchaseOrders
}

function createPoLineFromRequest(request, poId, index = 0) {
  return normalizePoLine({
    poLineId: makePoLineId(poId, index),
    poId,
    sku: request.sourceSku || request.sku || '',
    itemName: request.sourceName || request.itemName || request.name || '',
    quantityOrdered: toNumber(request.quantity || request.recommendedQty || 0),
    quantityReceived: 0,
    quantityAccepted: 0,
    quantityRejected: 0,
    unit: request.unit || '',
    unitPrice: toNumber(request.unitPrice || 0),
    currency: request.currency || 'CNY',
    supplierId: request.supplierId || supplierIdFor(request.supplier),
    warehouseId: request.warehouseId || '',
    requiredDate: request.requiredDate || request.eta || '',
    promisedDate: request.promisedDate || request.requiredDate || request.eta || '',
    status: 'open',
  }, { po: poId, supplier: request.supplier }, index)
}

function createPoLineFromRfq(rfq, request, poId, index = 0) {
  const quantity = toNumber(rfq.quantity || request?.quantity || 1, 1)
  const unitPrice = toNumber(rfq.bestPrice || request?.unitPrice || 0)
  return normalizePoLine({
    poLineId: makePoLineId(poId, index),
    poId,
    sku: rfq.sourceSku || request?.sourceSku || '',
    itemName: rfq.sourceName || request?.sourceName || rfq.title || '',
    quantityOrdered: quantity,
    quantityReceived: 0,
    quantityAccepted: 0,
    quantityRejected: 0,
    unit: rfq.unit || request?.unit || '',
    unitPrice,
    currency: rfq.currency || request?.currency || 'CNY',
    supplierId: supplierIdFor(rfq.bestSupplier || request?.supplier || ''),
    warehouseId: rfq.warehouseId || request?.warehouseId || '',
    requiredDate: request?.requiredDate || rfq.due || '',
    promisedDate: rfq.promisedDate || rfq.due || request?.requiredDate || '',
    status: 'open',
  }, { po: poId, supplier: rfq.bestSupplier || request?.supplier || '' }, index)
}

function normalizeGrnLine(line, grn, po, index = 0, options = {}) {
  const poLines = ensurePoLines(po)
  const fallbackBySku = line.sku ? poLines.find((poLine) => poLine.sku && poLine.sku === line.sku) : null
  const fallbackLine = poLines.find((poLine) => poLine.poLineId === line.poLineId) || fallbackBySku || poLines[index] || poLines[0] || {}
  const acceptedQty = toNumber(line.acceptedQty ?? line.passed ?? line.accepted ?? 0)
  const rejectedQty = toNumber(line.rejectedQty ?? line.failed ?? line.rejected ?? 0)
  const explicitReceived = line.receivedQty ?? line.items ?? line.quantityReceived
  const receivedQty = toNumber(explicitReceived ?? (acceptedQty + rejectedQty || grn.items || fallbackLine.quantityOrdered || 0))
  const terminal = postedReceivingStatuses.has(grn.status)
  const assumeApplied = Boolean(options.assumeApplied && terminal)
  return {
    grnLineId: line.grnLineId || `${grn.grn}-L${String(index + 1).padStart(3, '0')}`,
    grnId: grn.grn,
    poId: grn.po,
    poLineId: line.poLineId || fallbackLine.poLineId || '',
    sku: line.sku || fallbackLine.sku || '',
    itemName: line.itemName || line.name || fallbackLine.itemName || '',
    receivedQty,
    acceptedQty,
    rejectedQty,
    unit: line.unit || fallbackLine.unit || '',
    warehouseId: line.warehouseId || warehouseIdFor(line.warehouse || grn.warehouse || fallbackLine.warehouseId || ''),
    qualityStatus: line.qualityStatus || (rejectedQty > 0 ? 'rejected' : acceptedQty > 0 ? 'accepted' : 'pending'),
    inspectionResult: line.inspectionResult || line.reason || '',
    appliedReceivedQty: toNumber(line.appliedReceivedQty ?? (assumeApplied ? receivedQty : 0)),
    appliedAcceptedQty: toNumber(line.appliedAcceptedQty ?? (assumeApplied ? acceptedQty : 0)),
    appliedRejectedQty: toNumber(line.appliedRejectedQty ?? (assumeApplied ? rejectedQty : 0)),
  }
}

function normalizeGrnLines(grn, po, options = {}) {
  const rawLines = Array.isArray(grn.lines) && grn.lines.length > 0
    ? grn.lines
    : [{
        poLineId: grn.poLineId || '',
        sku: grn.sku || po?.sourceSku || '',
        itemName: grn.sourceName || po?.sourceName || '',
        receivedQty: postedReceivingStatuses.has(grn.status) && toNumber(grn.passed || 0) + toNumber(grn.failed || 0) > 0
          ? toNumber(grn.passed || 0) + toNumber(grn.failed || 0)
          : toNumber(grn.items || po?.items || 0),
        acceptedQty: toNumber(grn.passed || 0),
        rejectedQty: toNumber(grn.failed || 0),
        unit: grn.unit || po?.unit || '',
        warehouseId: warehouseIdFor(grn.warehouse || po?.warehouseId || ''),
      }]
  grn.lines = rawLines.map((line, index) => normalizeGrnLine(line, grn, po, index, options))
  grn.items = grn.lines.reduce((sum, line) => sum + toNumber(line.receivedQty), 0)
  grn.passed = grn.lines.reduce((sum, line) => sum + toNumber(line.acceptedQty), 0)
  grn.failed = grn.lines.reduce((sum, line) => sum + toNumber(line.rejectedQty), 0)
  return grn.lines
}

function validateReceivingAgainstPoLines(grnLines, poLines, options = {}) {
  const errors = []
  const warnings = []
  const allowOverReceipt = Boolean(options.allowOverReceipt)
  for (const line of grnLines) {
    const receivedQty = toNumber(line.receivedQty)
    const acceptedQty = toNumber(line.acceptedQty)
    const rejectedQty = toNumber(line.rejectedQty)
    if (receivedQty < 0 || acceptedQty < 0 || rejectedQty < 0) errors.push(`${line.grnLineId} has negative quantity`)
    if (acceptedQty > receivedQty) errors.push(`${line.grnLineId} acceptedQty cannot exceed receivedQty`)
    if (rejectedQty > receivedQty) errors.push(`${line.grnLineId} rejectedQty cannot exceed receivedQty`)
    if (acceptedQty + rejectedQty !== receivedQty) errors.push(`${line.grnLineId} acceptedQty + rejectedQty must equal receivedQty`)
    const poLine = poLines.find((item) => item.poLineId === line.poLineId)
    if (!poLine) {
      errors.push(`${line.grnLineId} does not match a PO line`)
      continue
    }
    const deltaReceived = receivedQty - toNumber(line.appliedReceivedQty)
    const cumulativeReceived = toNumber(poLine.quantityReceived) + deltaReceived
    if (cumulativeReceived > toNumber(poLine.quantityOrdered)) {
      const message = `${line.grnLineId} would over-receive ${poLine.poLineId}: ${cumulativeReceived}/${poLine.quantityOrdered}`
      if (allowOverReceipt) warnings.push(message)
      else errors.push(message)
    }
  }
  return { ok: errors.length === 0, errors, warnings }
}

function postedGrnProtectedChangeError(grn, body, po) {
  if (!postedReceivingStatuses.has(grn.status)) return ''
  if (body.status !== undefined && body.status !== grn.status) {
    return `GRN ${grn.grn} is already posted; status cannot be changed without a reversal`
  }
  normalizeGrnLines(grn, po, { assumeApplied: true })
  const protectedHeaderFields = ['passed', 'failed', 'items', 'sku', 'poLineId', 'warehouse', 'warehouseId']
  for (const field of protectedHeaderFields) {
    if (body[field] !== undefined) {
      const currentValue = field === 'warehouseId'
        ? warehouseIdFor(grn.warehouse || grn.warehouseId || '')
        : grn[field]
      const nextValue = field === 'warehouseId'
        ? warehouseIdFor(body[field] || '')
        : body[field]
      if (String(currentValue ?? '') !== String(nextValue ?? '')) {
        return `GRN ${grn.grn} is already posted; ${field} cannot be changed without a reversal`
      }
    }
  }
  if (!Array.isArray(body.lines)) return ''
  if (body.lines.length !== grn.lines.length) {
    return `GRN ${grn.grn} is already posted; receiving lines cannot be added or removed without a reversal`
  }
  const incoming = body.lines.map((line, index) => normalizeGrnLine(line, grn, po, index, { assumeApplied: true }))
  const protectedLineFields = ['poLineId', 'sku', 'receivedQty', 'acceptedQty', 'rejectedQty', 'warehouseId']
  for (let index = 0; index < incoming.length; index += 1) {
    const current = grn.lines[index]
    const next = incoming[index]
    for (const field of protectedLineFields) {
      if (String(current?.[field] ?? '') !== String(next?.[field] ?? '')) {
        return `GRN ${grn.grn} is already posted; ${field} cannot be changed without a reversal`
      }
    }
  }
  return ''
}

function applyReceivingToPoAndInventory(db, grn, po, options = {}) {
  normalizePurchaseOrder(po)
  normalizeGrnLines(grn, po, { assumeApplied: false })
  if (!postedReceivingStatuses.has(grn.status)) return { warnings: [] }
  if (grn.inventoryApplied) {
    grn.inventoryMovementIds = Array.isArray(grn.inventoryMovementIds) ? grn.inventoryMovementIds : []
    return { warnings: grn.warnings || [] }
  }

  const validation = validateReceivingAgainstPoLines(grn.lines, po.lines, options)
  if (!validation.ok) {
    const error = new Error(validation.errors.join('; '))
    error.status = 400
    throw error
  }

  grn.inventoryMovementIds = Array.isArray(grn.inventoryMovementIds) ? grn.inventoryMovementIds : []
  for (const grnLine of grn.lines) {
    const poLine = po.lines.find((line) => line.poLineId === grnLine.poLineId)
    if (!poLine) continue
    const receivedDelta = toNumber(grnLine.receivedQty) - toNumber(grnLine.appliedReceivedQty)
    const acceptedDelta = toNumber(grnLine.acceptedQty) - toNumber(grnLine.appliedAcceptedQty)
    const rejectedDelta = toNumber(grnLine.rejectedQty) - toNumber(grnLine.appliedRejectedQty)
    poLine.quantityReceived = Math.max(0, toNumber(poLine.quantityReceived) + receivedDelta)
    poLine.quantityAccepted = Math.max(0, toNumber(poLine.quantityAccepted) + acceptedDelta)
    poLine.quantityRejected = Math.max(0, toNumber(poLine.quantityRejected) + rejectedDelta)
    poLine.status = lineStatusFromQuantities(poLine)
    if (!poLine.warehouseId && grnLine.warehouseId) poLine.warehouseId = grnLine.warehouseId

    if (acceptedDelta !== 0 && grnLine.sku) {
      const product = (db.products || []).find((item) => item.sku === grnLine.sku)
      if (product) product.currentStock = Math.max(0, toNumber(product.currentStock) + acceptedDelta)
      const movement = recordInventoryMovement(db, {
        type: acceptedDelta >= 0 ? '入库' : '库存调整',
        sourceType: 'GRN',
        sourceId: grn.grn,
        grnId: grn.grn,
        poId: po.po,
        poLineId: poLine.poLineId,
        sku: grnLine.sku,
        name: grnLine.itemName || poLine.itemName,
        quantity: acceptedDelta,
        qty: acceptedDelta,
        ref: grn.grn,
        po: po.po,
        from: grn.supplier,
        to: grnLine.warehouseId || grn.warehouse || '—',
        warehouseId: grnLine.warehouseId || warehouseIdFor(grn.warehouse || ''),
        operator: grn.receiver || '刘建华',
        reason: grnLine.rejectedQty > 0 ? '质检部分合格入库' : '质检合格入库',
        status: grn.status,
      })
      grn.inventoryMovementIds.push(movement.movementId)
    }

    grnLine.appliedReceivedQty = grnLine.receivedQty
    grnLine.appliedAcceptedQty = grnLine.acceptedQty
    grnLine.appliedRejectedQty = grnLine.rejectedQty
  }

  calculatePoHeaderFromLines(po)
  const header = headerStatusFromLines(po)
  po.status = header.status
  po.erpStatus = header.erpStatus
  grn.postedAt = grn.postedAt || new Date().toISOString()
  grn.postedBy = grn.postedBy || options.postedBy || grn.receiver || 'system'
  grn.inventoryApplied = true
  grn.warnings = validation.warnings
  return { warnings: validation.warnings }
}

function supplierFlag(score, rejectRate) {
  if (score >= 92 && rejectRate <= 2) return '战略'
  if (score >= 84 && rejectRate <= 5) return '核心'
  if (score >= 74 && rejectRate <= 12) return '备选'
  return '整改'
}

function supplierPerformance(db) {
  const purchaseOrders = normalizePurchaseOrders(db)
  const receivingDocs = db.receivingDocs || []
  const suppliers = new Map()

  for (const item of db.suppliers || []) {
    suppliers.set(item.name, {
      name: item.name,
      category: item.category || '未分类',
      onTime: Number(item.onTimeRate || 0),
      quality: Number(item.qualityRate || 0),
      risk: item.risk || '中',
      po: 0,
      spend: 0,
      received: 0,
      passed: 0,
      failed: 0,
      exceptions: 0,
      lastIssue: '',
    })
  }

  for (const po of purchaseOrders) {
    if (!po.supplier) continue
    if (!suppliers.has(po.supplier)) {
      suppliers.set(po.supplier, {
        name: po.supplier,
        category: '采购供应商',
        onTime: 90,
        quality: 96,
        risk: '中',
        po: 0,
        spend: 0,
        received: 0,
        passed: 0,
        failed: 0,
        exceptions: 0,
        lastIssue: '',
      })
    }
    const row = suppliers.get(po.supplier)
    row.po += 1
    row.spend += Number(po.amount || 0)
  }

  for (const grn of receivingDocs) {
    if (!grn.supplier) continue
    if (!suppliers.has(grn.supplier)) {
      suppliers.set(grn.supplier, {
        name: grn.supplier,
        category: '收货供应商',
        onTime: 90,
        quality: 96,
        risk: '中',
        po: 0,
        spend: 0,
        received: 0,
        passed: 0,
        failed: 0,
        exceptions: 0,
        lastIssue: '',
      })
    }
    const row = suppliers.get(grn.supplier)
    const po = purchaseOrders.find((item) => item.po === grn.po)
    const lines = po ? normalizeGrnLines(grn, po, { assumeApplied: postedReceivingStatuses.has(grn.status) }) : []
    const passed = lines.length
      ? lines.reduce((sum, line) => sum + Number(line.acceptedQty || 0), 0)
      : Number(grn.passed || 0)
    const failed = lines.length
      ? lines.reduce((sum, line) => sum + Number(line.rejectedQty || 0), 0)
      : Number(grn.failed || 0)
    row.received += passed + failed
    row.passed += passed
    row.failed += failed
    if (failed > 0 || grn.status === '异常处理') {
      row.exceptions += 1
      row.lastIssue = `${grn.grn} ${failed > 0 ? `不合格 ${failed}` : '异常处理'}`
    }
  }

  return Array.from(suppliers.values()).map((row) => {
    const inspectionQuality = row.received > 0 ? (row.passed / row.received) * 100 : row.quality
    const blendedQuality = row.received > 0 ? row.quality * 0.45 + inspectionQuality * 0.55 : row.quality
    const rejectRate = row.received > 0 ? (row.failed / row.received) * 100 : 0
    const riskPenalty = row.risk === '高' ? 8 : row.risk === '中' ? 3 : 0
    const exceptionPenalty = Math.min(14, row.exceptions * 3 + rejectRate * 0.35)
    const score = Math.max(0, Math.round(row.onTime * 0.34 + blendedQuality * 0.46 + Math.min(100, row.po * 2 + 70) * 0.2 - riskPenalty - exceptionPenalty))
    const rating = Math.max(1, Math.min(5, Number((score / 20).toFixed(1))))
    return {
      ...row,
      onTime: Number(row.onTime.toFixed(1)),
      quality: Number(blendedQuality.toFixed(1)),
      rejectRate: Number(rejectRate.toFixed(1)),
      score,
      rating,
      flag: supplierFlag(score, rejectRate),
    }
  }).sort((a, b) => b.score - a.score)
}

const supplierQuotes = {
  'SKU-00412': [
    { supplier: '深圳新元电气', unitPrice: 2980, currency: 'CNY', leadTimeDays: 7, responseScore: 92, capacity: 800, risk: '中', contractId: 'BPA-26-ELEC' },
    { supplier: '上海仪表科技', unitPrice: 450, currency: 'USD', leadTimeDays: 10, responseScore: 84, capacity: 260, risk: '低', contractId: 'BPA-26-METER' },
    { supplier: '华东精工机械', unitPrice: 3380, currency: 'CNY', leadTimeDays: 12, responseScore: 78, capacity: 180, risk: '中' },
  ],
  'SKU-00623': [
    { supplier: '深圳新元电气', unitPrice: 12400, currency: 'CNY', leadTimeDays: 9, responseScore: 92, capacity: 420, risk: '中', contractId: 'BPA-26-ELEC' },
    { supplier: '上海仪表科技', unitPrice: 1830, currency: 'USD', leadTimeDays: 11, responseScore: 86, capacity: 160, risk: '低', contractId: 'BPA-26-METER' },
  ],
  'SKU-00287': [
    { supplier: '江苏铝合金集团', unitPrice: 142, currency: 'CNY', leadTimeDays: 12, responseScore: 88, capacity: 3200, risk: '低', contractId: 'BPA-26-ALU' },
    { supplier: '华东精工机械', unitPrice: 151, currency: 'CNY', leadTimeDays: 14, responseScore: 82, capacity: 900, risk: '中' },
  ],
  'SKU-00142': [
    { supplier: '华东精工机械', unitPrice: 86, currency: 'CNY', leadTimeDays: 9, responseScore: 82, capacity: 5000, risk: '低' },
    { supplier: '佛山标准件', unitPrice: 89, currency: 'CNY', leadTimeDays: 7, responseScore: 90, capacity: 4200, risk: '中', contractId: 'BPA-26-FASTENER' },
  ],
  'SKU-00815': [
    { supplier: '华东精工机械', unitPrice: 4600, currency: 'CNY', leadTimeDays: 14, responseScore: 82, capacity: 220, risk: '低' },
    { supplier: '上海仪表科技', unitPrice: 675, currency: 'USD', leadTimeDays: 16, responseScore: 84, capacity: 120, risk: '低', contractId: 'BPA-26-METER' },
  ],
  'SKU-00744': [
    { supplier: '广州化工耗材', unitPrice: 320, currency: 'CNY', leadTimeDays: 8, responseScore: 76, capacity: 2000, risk: '高', contractId: 'BPA-25-CHEM' },
    { supplier: '佛山标准件', unitPrice: 356, currency: 'CNY', leadTimeDays: 10, responseScore: 90, capacity: 900, risk: '中' },
  ],
}

const exchangeRatesToCny = { CNY: 1, USD: 7.18, EUR: 7.78 }

const contractPriceRules = {
  'BPA-26-ELEC': { label: '电子件年框', tiers: [{ minQty: 0, discount: 0.06 }, { minQty: 200, discount: 0.1 }, { minQty: 500, discount: 0.14 }] },
  'BPA-26-METER': { label: '仪表进口框架', tiers: [{ minQty: 0, discount: 0.04 }, { minQty: 100, discount: 0.08 }, { minQty: 300, discount: 0.12 }] },
  'BPA-26-ALU': { label: '铝型材阶梯价', tiers: [{ minQty: 0, discount: 0.03 }, { minQty: 1000, discount: 0.08 }, { minQty: 2500, discount: 0.12 }] },
  'BPA-26-FASTENER': { label: '紧固件年框', tiers: [{ minQty: 0, discount: 0.08 }, { minQty: 2000, discount: 0.16 }, { minQty: 5000, discount: 0.22 }] },
  'BPA-25-CHEM': { label: '化工耗材临期合同', tiers: [{ minQty: 0, discount: 0.02 }, { minQty: 1000, discount: 0.05 }] },
}

const supplierCapacityCalendar = {
  '深圳新元电气': { nextWindow: '2026-W25', available: 620, committed: 280, reliability: 0.94 },
  '上海仪表科技': { nextWindow: '2026-W25', available: 180, committed: 90, reliability: 0.9 },
  '华东精工机械': { nextWindow: '2026-W25', available: 720, committed: 410, reliability: 0.86 },
  '江苏铝合金集团': { nextWindow: '2026-W26', available: 2800, committed: 1300, reliability: 0.92 },
  '佛山标准件': { nextWindow: '2026-W25', available: 3600, committed: 1800, reliability: 0.88 },
  '广州化工耗材': { nextWindow: '2026-W25', available: 1200, committed: 900, reliability: 0.72 },
}

function applyContractAndCurrency(quote, qty) {
  const currency = quote.currency || 'CNY'
  const fxRate = exchangeRatesToCny[currency] || 1
  const listPriceCny = Number(quote.unitPrice || 0) * fxRate
  const contract = quote.contractId ? contractPriceRules[quote.contractId] : null
  const tier = contract?.tiers
    ?.filter((item) => qty >= Number(item.minQty || 0))
    .sort((a, b) => Number(b.minQty || 0) - Number(a.minQty || 0))[0] || null
  const discount = Number(tier?.discount || 0)
  const unitPriceCny = Number((listPriceCny * (1 - discount)).toFixed(2))
  return {
    currency,
    fxRate,
    listPriceCny: Number(listPriceCny.toFixed(2)),
    unitPriceCny,
    contractId: quote.contractId || '',
    contractLabel: contract?.label || '',
    contractDiscount: discount,
    contractTierMinQty: Number(tier?.minQty || 0),
  }
}

function supplierRecommendations(db, { sku = '', quantity = 0, currentSupplier = '' } = {}) {
  const performance = supplierPerformance(db)
  const perfByName = new Map(performance.map((item) => [item.name, item]))
  const quotes = supplierQuotes[sku] || []
  const qty = Math.max(0, Number(quantity || 0))
  const enrichedQuotes = quotes.map((quote) => ({ ...quote, pricing: applyContractAndCurrency(quote, qty) }))
  const minPrice = Math.min(...enrichedQuotes.map((item) => Number(item.pricing.unitPriceCny || 0)).filter(Boolean), Infinity)
  const candidates = enrichedQuotes.map((quote) => {
    const perf = perfByName.get(quote.supplier) || {}
    const capacityCalendar = supplierCapacityCalendar[quote.supplier] || { nextWindow: '待排产', available: Number(quote.capacity || 0), committed: 0, reliability: 0.8 }
    const availableCapacity = Math.min(Number(quote.capacity || 0), Number(capacityCalendar.available || 0))
    const priceIndex = Number.isFinite(minPrice) && quote.pricing.unitPriceCny > 0 ? Math.min(100, (minPrice / quote.pricing.unitPriceCny) * 100) : 70
    const deliveryIndex = Math.max(40, 100 - Number(quote.leadTimeDays || 0) * 2)
    const capacityIndex = qty > 0 ? Math.min(100, (availableCapacity / qty) * 100) : 100
    const calendarIndex = Math.round(capacityIndex * 0.65 + Number(capacityCalendar.reliability || 0.8) * 100 * 0.35)
    const riskPenalty = quote.risk === '高' || perf.flag === '整改' ? 14 : quote.risk === '中' ? 5 : 0
    const qualityPenalty = Number(perf.rejectRate || 0) > 10 ? 8 : 0
    const score = Math.round(
      Number(perf.score || 70) * 0.32 +
      priceIndex * 0.24 +
      deliveryIndex * 0.16 +
      Number(quote.responseScore || 70) * 0.14 +
      calendarIndex * 0.14 -
      riskPenalty -
      qualityPenalty
    )
    return {
      supplier: quote.supplier,
      unitPrice: quote.pricing.unitPriceCny,
      listPrice: quote.unitPrice,
      listPriceCny: quote.pricing.listPriceCny,
      currency: quote.pricing.currency,
      fxRate: quote.pricing.fxRate,
      contractId: quote.pricing.contractId,
      contractLabel: quote.pricing.contractLabel,
      contractDiscount: quote.pricing.contractDiscount,
      contractTierMinQty: quote.pricing.contractTierMinQty,
      leadTimeDays: quote.leadTimeDays,
      responseScore: quote.responseScore,
      capacity: quote.capacity,
      availableCapacity,
      capacityWindow: capacityCalendar.nextWindow,
      capacityReliability: Number(capacityCalendar.reliability || 0),
      capacityStatus: qty > availableCapacity ? '不足' : qty > availableCapacity * 0.85 ? '紧张' : '可承诺',
      risk: quote.risk,
      performanceScore: Number(perf.score || 0),
      quality: Number(perf.quality || 0),
      rejectRate: Number(perf.rejectRate || 0),
      flag: perf.flag || '待评估',
      score: Math.max(0, score),
      amount: qty * Number(quote.pricing.unitPriceCny || 0),
      isCurrent: quote.supplier === currentSupplier,
      note: `折算价 ${quote.pricing.unitPriceCny} CNY，${quote.pricing.contractId ? `${quote.pricing.contractLabel} 折扣 ${(quote.pricing.contractDiscount * 100).toFixed(0)}%，` : ''}产能 ${availableCapacity}/${qty || 0}，窗口 ${capacityCalendar.nextWindow}，绩效 ${Number(perf.score || 0)}。`,
    }
  }).sort((a, b) => b.score - a.score)

  const primary = candidates[0] || null
  const backup = candidates.find((item) => item.supplier !== primary?.supplier) || null
  const shouldSplit = Boolean(primary && backup && qty > Number(primary.availableCapacity || primary.capacity || 0) * 0.85)
  const split = shouldSplit && primary && backup
    ? [
        { supplier: primary.supplier, quantity: Math.min(qty, primary.availableCapacity || primary.capacity), unitPrice: primary.unitPrice },
        { supplier: backup.supplier, quantity: Math.max(0, qty - Math.min(qty, primary.availableCapacity || primary.capacity)), unitPrice: backup.unitPrice },
      ].filter((item) => item.quantity > 0)
    : []
  const needsRfq = candidates.length < 2 || candidates.some((item) => item.flag === '整改' && item.score < 74) || (primary?.score || 0) < 78 || candidates.some((item) => item.capacityStatus === '不足')

  return {
    sku,
    quantity: qty,
    currentSupplier,
    primary,
    backup,
    candidates,
    split,
    needsRfq,
    rfqReason: needsRfq
      ? '候选不足、绩效整改、产能不可承诺或综合评分低于阈值，建议发起 RFQ 或补充备选供应商。'
      : '候选供应商评分、合同价格和产能窗口满足自动推荐阈值。',
  }
}

const mrpProfiles = {
  'SKU-00412': { allocated: 11, inbound: [0, 40, 0, 0, 30, 0], moq: 20, batchMultiple: 5, leadTimePeriods: 1, serviceLevel: 99, abc: 'A', xyz: 'X', supplier: '深圳新元电气', unitPrice: 2980, bomDemand: [18, 20, 22, 24, 20, 18] },
  'SKU-00623': { allocated: 6, inbound: [0, 20, 0, 0, 10, 0], moq: 10, batchMultiple: 5, leadTimePeriods: 1, serviceLevel: 99, abc: 'A', xyz: 'Y', supplier: '深圳新元电气', unitPrice: 12400, bomDemand: [6, 8, 10, 10, 8, 6] },
  'SKU-00287': { allocated: 180, inbound: [500, 0, 0, 300, 0, 0], moq: 500, batchMultiple: 100, leadTimePeriods: 2, serviceLevel: 97, abc: 'A', xyz: 'Y', supplier: '江苏铝合金集团', unitPrice: 142, bomDemand: [120, 140, 150, 160, 150, 130] },
  'SKU-00142': { allocated: 120, inbound: [300, 0, 0, 0, 0, 0], moq: 200, batchMultiple: 50, leadTimePeriods: 1, serviceLevel: 95, abc: 'B', xyz: 'X', supplier: '华东精工机械', unitPrice: 86, bomDemand: [80, 90, 100, 100, 90, 80] },
  'SKU-00815': { allocated: 18, inbound: [0, 0, 40, 0, 0, 0], moq: 20, batchMultiple: 5, leadTimePeriods: 2, serviceLevel: 95, abc: 'B', xyz: 'Y', supplier: '华东精工机械', unitPrice: 4600, bomDemand: [12, 14, 16, 18, 16, 14] },
  'SKU-00744': { allocated: 80, inbound: [600, 0, 0, 0, 0, 0], moq: 200, batchMultiple: 50, leadTimePeriods: 1, serviceLevel: 92, abc: 'C', xyz: 'Y', supplier: '广州化工耗材', unitPrice: 320, bomDemand: [20, 20, 24, 24, 22, 20] },
}

const bomMaster = {
  'FG-ROBOT-ARM': {
    name: '工业机器人关节模组',
    unit: '套',
    demand: [18, 20, 22, 24, 22, 20],
    children: [
      { sku: 'SA-DRIVE-KIT', qty: 1, scrapPct: 0.02, leadTimeOffset: 0 },
      { sku: 'SKU-00623', qty: 1, scrapPct: 0.01, leadTimeOffset: 0 },
      { sku: 'SKU-00287', qty: 4, scrapPct: 0.03, leadTimeOffset: 0 },
      { sku: 'SKU-00142', qty: 2, scrapPct: 0.02, leadTimeOffset: 0 },
    ],
  },
  'SA-DRIVE-KIT': {
    name: '伺服驱动套件',
    unit: '套',
    phantom: true,
    children: [
      { sku: 'SKU-00412', qty: 2, scrapPct: 0.02, leadTimeOffset: 0 },
      { sku: 'SKU-00815', qty: 1, scrapPct: 0.01, leadTimeOffset: 1 },
      { sku: 'SKU-00744', qty: 0.4, scrapPct: 0.05, leadTimeOffset: 0 },
    ],
  },
  'FG-HYDRAULIC-STATION': {
    name: '液压工装站',
    unit: '套',
    demand: [8, 10, 12, 12, 10, 9],
    children: [
      { sku: 'SKU-00815', qty: 3, scrapPct: 0.01, leadTimeOffset: 0 },
      { sku: 'SKU-00287', qty: 6, scrapPct: 0.02, leadTimeOffset: 0 },
      { sku: 'SKU-00744', qty: 0.8, scrapPct: 0.03, leadTimeOffset: 0 },
    ],
  },
}

function roundUpToBatch(value, moq, batchMultiple) {
  if (value <= 0) return 0
  return Math.ceil(Math.max(value, moq) / batchMultiple) * batchMultiple
}

function futureMonthLabels(periods = 6) {
  return Array.from({ length: periods }, (_, index) => {
    const total = 2026 * 12 + 5 + index
    return `${String(Math.floor(total / 12)).slice(-2)}/${(total % 12) + 1}月`
  })
}

function createBomBucket(periods) {
  return {
    total: Array.from({ length: periods }, () => 0),
    sourcesByPeriod: Array.from({ length: periods }, () => []),
    parents: new Map(),
  }
}

function addBomDemand(target, sku, periodIndex, quantity, source, periods) {
  if (!target.has(sku)) target.set(sku, createBomBucket(periods))
  const bucket = target.get(sku)
  bucket.total[periodIndex] += quantity
  bucket.sourcesByPeriod[periodIndex].push({ ...source, demand: quantity })

  const parentKey = `${source.parent}|${source.top}`
  const previous = bucket.parents.get(parentKey) || {
    parent: source.parent,
    parentName: source.parentName,
    top: source.top,
    topName: source.topName,
    level: source.level,
    demand: 0,
  }
  previous.demand += quantity
  previous.level = Math.min(previous.level, source.level)
  bucket.parents.set(parentKey, previous)
}

function explodeBomChildren(parentSku, demandByPeriod, output, periods, trail = []) {
  const parent = bomMaster[parentSku]
  if (!parent?.children?.length) return

  const topSku = trail[0]?.sku || parentSku
  const topName = trail[0]?.name || parent.name || parentSku

  parent.children.forEach((child) => {
    const childDemand = Array.from({ length: periods }, () => 0)

    demandByPeriod.slice(0, periods).forEach((parentDemand, periodIndex) => {
      if (!parentDemand) return
      const requiredPeriod = Math.max(0, Math.min(periods - 1, periodIndex - Number(child.leadTimeOffset || 0)))
      const requiredQty = Math.ceil(Number(parentDemand || 0) * Number(child.qty || 0) * (1 + Number(child.scrapPct || 0)))
      if (requiredQty <= 0) return
      childDemand[requiredPeriod] += requiredQty
      addBomDemand(output, child.sku, requiredPeriod, requiredQty, {
        parent: parentSku,
        parentName: parent.name || parentSku,
        top: topSku,
        topName,
        level: trail.length,
        qtyPer: Number(child.qty || 0),
        scrapPct: Number(child.scrapPct || 0),
        leadTimeOffset: Number(child.leadTimeOffset || 0),
      }, periods)
    })

    if (bomMaster[child.sku]?.children?.length) {
      explodeBomChildren(child.sku, childDemand, output, periods, [...trail, { sku: parentSku, name: parent.name || parentSku }])
    }
  })
}

function buildBomExplosion(periods) {
  const output = new Map()
  Object.entries(bomMaster)
    .filter(([, item]) => Array.isArray(item.demand))
    .forEach(([sku, item]) => {
      explodeBomChildren(sku, item.demand, output, periods, [{ sku, name: item.name || sku }])
    })

  for (const bucket of output.values()) {
    bucket.total = bucket.total.map((value) => Math.round(value))
    bucket.sourcesByPeriod = bucket.sourcesByPeriod.map((sources) => sources
      .sort((a, b) => b.demand - a.demand)
      .slice(0, 4))
    bucket.summary = Array.from(bucket.parents.values())
      .sort((a, b) => b.demand - a.demand)
      .slice(0, 6)
  }

  return output
}

function buildMrpPlan(db, options = {}) {
  const periods = Math.max(1, Math.min(12, Number(options.periods || 6)))
  const labels = futureMonthLabels(periods)
  const skuFilter = options.sku ? new Set(String(options.sku).split(',').map((item) => item.trim()).filter(Boolean)) : null
  const products = (db.products || []).filter((product) => !skuFilter || skuFilter.has(product.sku))
  const bomExplosion = buildBomExplosion(periods)

  const rows = products.map((product) => {
    const profile = mrpProfiles[product.sku] || {
      allocated: 0,
      inbound: [],
      moq: 1,
      batchMultiple: 1,
      leadTimePeriods: 1,
      serviceLevel: 92,
      abc: 'B',
      xyz: 'Y',
      supplier: '',
      unitPrice: 0,
      bomDemand: [],
    }
    const bomBucket = bomExplosion.get(product.sku)
    const monthlyDemand = Number(product.monthlyDemand || 0)
    const safetyStock = Number(product.safetyStock || 0)
    let projected = Number(product.currentStock || 0) - Number(profile.allocated || 0)
    const schedule = []
    let firstShortagePeriod = null
    let maxNetRequirement = 0
    let totalPlannedReceipt = 0

    for (let index = 0; index < periods; index += 1) {
      const seasonalFactor = 1 + Math.sin((index / 6) * Math.PI) * 0.08
      const independentDemand = Math.max(0, Math.round(monthlyDemand * seasonalFactor))
      const dependentDemand = Number(bomBucket?.total?.[index] ?? profile.bomDemand?.[index] ?? 0)
      const grossRequirement = independentDemand + dependentDemand
      const scheduledReceipt = Number(profile.inbound?.[index] || 0)
      const availableBeforePlanning = projected + scheduledReceipt - grossRequirement
      const netRequirement = Math.max(0, safetyStock - availableBeforePlanning)
      const plannedReceipt = roundUpToBatch(netRequirement, Number(profile.moq || 1), Number(profile.batchMultiple || 1))
      const releaseIndex = index - Number(profile.leadTimePeriods || 1)
      const plannedReleasePeriod = releaseIndex >= 0 ? labels[releaseIndex] : '立即释放'
      const exception = plannedReceipt > 0 && releaseIndex < 0
        ? '加急'
        : plannedReceipt > 0
          ? '释放'
          : availableBeforePlanning > safetyStock + monthlyDemand * 1.5
            ? '推迟/取消'
            : '正常'

      projected = availableBeforePlanning + plannedReceipt
      if (firstShortagePeriod === null && plannedReceipt > 0) firstShortagePeriod = labels[index]
      maxNetRequirement = Math.max(maxNetRequirement, netRequirement)
      totalPlannedReceipt += plannedReceipt

      schedule.push({
        period: labels[index],
        grossRequirement,
        independentDemand,
        dependentDemand,
        scheduledReceipt,
        projectedAvailable: Math.round(projected),
        netRequirement: Math.round(netRequirement),
        plannedReceipt,
        plannedRelease: plannedReceipt,
        plannedReleasePeriod,
        exception,
        dependentDemandSources: bomBucket?.sourcesByPeriod?.[index] || [],
      })
    }

    const exceptionSummary = schedule.find((item) => item.exception === '加急') ? '加急'
      : schedule.find((item) => item.exception === '释放') ? '释放'
        : schedule.find((item) => item.exception === '推迟/取消') ? '推迟/取消'
          : '正常'

    return {
      sku: product.sku,
      name: product.name,
      category: product.category,
      unit: product.unit,
      supplier: profile.supplier,
      unitPrice: profile.unitPrice,
      serviceLevel: profile.serviceLevel,
      abc: profile.abc,
      xyz: profile.xyz,
      onHand: Number(product.currentStock || 0),
      allocated: Number(profile.allocated || 0),
      safetyStock,
      moq: Number(profile.moq || 1),
      batchMultiple: Number(profile.batchMultiple || 1),
      leadTimePeriods: Number(profile.leadTimePeriods || 1),
      totalPlannedReceipt,
      firstShortagePeriod,
      maxNetRequirement: Math.round(maxNetRequirement),
      amount: totalPlannedReceipt * Number(profile.unitPrice || 0),
      exception: exceptionSummary,
      bomSources: bomBucket?.summary || [],
      schedule,
    }
  })

  const exceptions = rows
    .filter((row) => row.exception !== '正常')
    .map((row) => ({
      sku: row.sku,
      name: row.name,
      type: row.exception,
      period: row.firstShortagePeriod || row.schedule.find((item) => item.exception !== '正常')?.period || labels[0],
      quantity: row.totalPlannedReceipt,
      amount: row.amount,
      action: row.exception === '加急'
        ? '立即释放计划订单，并复核供应商交期'
        : row.exception === '释放'
          ? '按提前期释放计划订单'
          : '检查在途订单是否可推迟或取消',
    }))
    .sort((a, b) => b.amount - a.amount)

  return {
    generatedAt: new Date().toISOString(),
    horizon: periods,
    periods: labels,
    summary: {
      skuCount: rows.length,
      exceptionCount: exceptions.length,
      urgentCount: exceptions.filter((item) => item.type === '加急').length,
      plannedAmount: rows.reduce((sum, row) => sum + row.amount, 0),
      plannedQty: rows.reduce((sum, row) => sum + row.totalPlannedReceipt, 0),
      bomRootCount: Object.values(bomMaster).filter((item) => Array.isArray(item.demand)).length,
      bomComponentCount: bomExplosion.size,
    },
    rows,
    exceptions,
  }
}

function buildSopDraft(db) {
  const mrp = buildMrpPlan(db)
  const supplierScore = supplierPerformance(db)
  const cycles = ensureSopCycles(db)
  const latestCycle = cycles[0] || null
  const forecastPlans = db.forecastPlans || []
  const purchaseRequests = ensurePurchaseRequests(db)
  const pendingRequests = purchaseRequests.filter((item) => item.status === '待审批')
  const openOrders = (db.purchaseOrders || []).filter((item) => ['待审批', '已审批', '已发出', '部分到货'].includes(item.status))
  const plannedAmount = Number(mrp.summary.plannedAmount || 0)
  const openPoAmount = openOrders.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const requestAmount = pendingRequests.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const budgetLimit = 3_600_000
  const totalCommitment = plannedAmount + requestAmount + openPoAmount
  const constrainedAmount = Math.max(0, totalCommitment - budgetLimit)
  const topRisks = [
    ...mrp.exceptions.slice(0, 4).map((item) => ({
      type: item.type,
      title: `${item.sku} ${item.name}`,
      amount: item.amount,
      action: item.action,
    })),
    ...supplierScore.filter((item) => item.flag === '整改').slice(0, 2).map((item) => ({
      type: '供应商整改',
      title: item.name,
      amount: 0,
      action: `拒收率 ${item.rejectRate}% ，采购前需要复核质检异常。`,
    })),
  ].slice(0, 6)

  return {
    cycle: '2026-06',
    version: latestCycle ? Number(latestCycle.version || 1) + 1 : 1,
    status: latestCycle?.status === '已发布' ? '草案' : (latestCycle?.status || '草案'),
    demandPlan: {
      forecastVersions: forecastPlans.length,
      totalMonthlyDemand: (db.products || []).reduce((sum, item) => sum + Number(item.monthlyDemand || 0), 0),
      highRiskSku: (db.products || []).filter((item) => item.stockoutRisk === '高').length,
      source: forecastPlans[0]?.id || 'MRP profile',
    },
    supplyPlan: {
      plannedQty: mrp.summary.plannedQty,
      plannedAmount,
      exceptionCount: mrp.summary.exceptionCount,
      urgentCount: mrp.summary.urgentCount,
      openPoAmount,
      pendingPrAmount: requestAmount,
    },
    financialConstraint: {
      budgetLimit,
      totalCommitment,
      constrainedAmount,
      budgetUsagePct: Number(((totalCommitment / budgetLimit) * 100).toFixed(1)),
      decision: constrainedAmount > 0 ? '需要削减或分期释放' : '预算内可执行',
    },
    consensus: {
      recommendation: mrp.summary.urgentCount > 0
        ? `优先释放 ${mrp.summary.urgentCount} 条加急 MRP 计划，预算超出部分分期审批。`
        : 'MRP 计划可按常规节奏进入采购申请。',
      approvers: ['销售计划', '供应链计划', '采购', '财务'],
      decisions: topRisks,
    },
    latestPublished: latestCycle,
  }
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
  const pendingRequests = ensurePurchaseRequests(db).filter((pr) => pr.status === '待审批').length
  const stockReceipts = db.receivingDocs.filter((doc) => doc.status === '质检中' || doc.status === '异常处理').length
  const latestPlan = (db.forecastPlans || []).find((plan) => plan.procurementSuggestion?.quantity > 0)
  const planNote = latestPlan
    ? `最近预测方案 ${latestPlan.id} 识别 ${latestPlan.sku} 最大净缺口，建议向 ${latestPlan.procurementSuggestion.supplier} 采购 ${Number(latestPlan.procurementSuggestion.quantity).toLocaleString()}${latestPlan.unit || ''}，预估金额 ${Number(latestPlan.procurementSuggestion.amount || 0).toLocaleString()} 元，优先级 ${latestPlan.procurementSuggestion.priority}。`
    : '当前还没有可执行的预测补货方案。'
  return `${evidence} 当前后端数据里有 ${db.purchaseOrders.length} 张采购订单，其中 ${pending} 张待审批；有 ${ensurePurchaseRequests(db).length} 张采购申请，其中 ${pendingRequests} 张待审批；有 ${db.receivingDocs.length} 张收货单，其中 ${stockReceipts} 张需要质检或异常跟进。${planNote} 建议先处理影响交付的待审批 PR/PO 和异常 GRN，再把预测净缺口转成采购申请。`
}

function aiConfidence(body, db, result = {}) {
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
  const quoteSkuCount = Object.keys(supplierQuotes).length
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
    externalEvidence.push('命中内部行情数据')
  }
  if (/外部|新闻|汇率|市场|价格|风险|铁|钢|铝|铜|美元|原油/.test(q)) {
    externalScore += 4
    if (!externalSignalCount && result.provider !== 'market-data') {
      externalScore -= 12
      externalWarnings.push('缺少实时外部信号')
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

function buildAiContext({ moduleId, activeInsight }, db) {
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
        purchaseRequests: ensurePurchaseRequests(db).length,
        inventoryMovements: ensureInventoryMovements(db).length,
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

    if (req.method === 'GET' && url.pathname === '/api/mrp-plan') {
      return send(res, 200, buildMrpPlan(db, {
        sku: url.searchParams.get('sku') || '',
        periods: Number(url.searchParams.get('periods') || 6),
      }))
    }

    if (req.method === 'GET' && url.pathname === '/api/sop-cycle') {
      return send(res, 200, {
        draft: buildSopDraft(db),
        history: ensureSopCycles(db).slice(0, 8),
      })
    }

    if (req.method === 'POST' && url.pathname === '/api/sop-cycle') {
      const body = await readBody(req)
      const draft = buildSopDraft(db)
      const cycle = {
        id: body.id || nextSequenceId(ensureSopCycles(db), 'id', 'SOP-2026-', 1),
        cycle: body.cycle || draft.cycle,
        version: Number(body.version || draft.version),
        status: body.status || '已发布',
        demandPlan: body.demandPlan || draft.demandPlan,
        supplyPlan: body.supplyPlan || draft.supplyPlan,
        financialConstraint: body.financialConstraint || draft.financialConstraint,
        consensus: body.consensus || draft.consensus,
        approvers: Array.isArray(body.approvers) ? body.approvers : draft.consensus.approvers,
        approvedBy: body.approvedBy || '系统演示用户',
        createdAt: new Date().toISOString(),
      }
      if (!['草案', '待审批', '已发布', '已驳回'].includes(cycle.status)) {
        return send(res, 400, { error: `invalid S&OP status: ${cycle.status}` })
      }
      db.sopCycles = [cycle, ...ensureSopCycles(db)].slice(0, 20)
      event(db, 'sop_cycle_saved', `S&OP ${cycle.cycle} v${cycle.version} ${cycle.status}`, cycle.id)
      await writeDb(db)
      return send(res, 201, cycle)
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

    if (req.method === 'GET' && url.pathname === '/api/forecast-plans') {
      return send(res, 200, db.forecastPlans || [])
    }

    if (req.method === 'POST' && url.pathname === '/api/forecast-plans') {
      const body = await readBody(req)
      const plan = {
        id: body.id || `FCST-${Date.now()}`,
        sku: body.sku,
        name: body.name,
        unit: body.unit,
        method: body.method,
        horizon: Number(body.horizon || 0),
        scenario: body.scenario || 'base',
        promoLift: Number(body.promoLift || 0),
        serviceLevel: Number(body.serviceLevel || 95),
        leadTimeDays: Number(body.leadTimeDays || 14),
        history: Array.isArray(body.history) ? body.history.map(Number).filter(Number.isFinite) : [],
        metrics: body.metrics || {},
        reconciliation: Array.isArray(body.reconciliation) ? body.reconciliation : [],
        procurementSuggestion: body.procurementSuggestion && typeof body.procurementSuggestion === 'object'
          ? {
              supplier: body.procurementSuggestion.supplier || '',
              buyer: body.procurementSuggestion.buyer || '',
              unitPrice: Number(body.procurementSuggestion.unitPrice || 0),
              quantity: Number(body.procurementSuggestion.quantity || 0),
              amount: Number(body.procurementSuggestion.amount || 0),
              priority: body.procurementSuggestion.priority || '中',
              firstStockoutMonth: body.procurementSuggestion.firstStockoutMonth || null,
              safetyFactor: Number(body.procurementSuggestion.safetyFactor || 1),
              basis: body.procurementSuggestion.basis || 'peak-net-shortage',
            }
          : null,
        recommendation: body.recommendation || '',
        createdAt: new Date().toISOString(),
      }
      if (!plan.sku || plan.history.length < 6) {
        return send(res, 400, { error: 'sku and at least 6 history points are required' })
      }
      db.forecastPlans = [plan, ...(db.forecastPlans || [])].slice(0, 20)
      event(db, 'forecast_plan_saved', `预测方案 ${plan.id} 已保存`, plan.sku)
      await writeDb(db)
      return send(res, 201, plan)
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
      result.confidence = aiConfidence(body, db, result)
      event(db, 'ai_chat', `AI answered ${body.moduleId || 'unknown'} question via ${result.provider}`, body.moduleId || 'ai')
      await writeDb(db)
      return send(res, 200, result)
    }

    if (req.method === 'GET' && url.pathname === '/api/purchase-orders') {
      return send(res, 200, normalizePurchaseOrders(db))
    }

    if (req.method === 'GET' && url.pathname === '/api/purchase-requests') {
      return send(res, 200, ensurePurchaseRequests(db))
    }

    if (req.method === 'GET' && url.pathname === '/api/rfqs') {
      return send(res, 200, ensureRfqs(db))
    }

    if (req.method === 'POST' && url.pathname === '/api/rfqs') {
      const body = await readBody(req)
      const rfqs = ensureRfqs(db)
      const id = body.id || nextSequenceId(rfqs, 'id', 'RFQ-26-', 47)
      const duplicate = rfqs.find((item) =>
        item.sourceRequest &&
        body.sourceRequest &&
        item.sourceRequest === body.sourceRequest &&
        !['已授标', '已取消'].includes(item.status)
      )
      if (duplicate) {
        return send(res, 409, {
          error: 'RFQ already exists for purchase request',
          rfq: duplicate.id,
          message: `${body.sourceRequest} 已存在进行中的询价单 ${duplicate.id}`,
        })
      }
      const rfq = {
        id,
        title: body.title || `${body.sourceSku || 'SKU'} 询价`,
        category: body.category || '采购询价',
        suppliers: Number(body.suppliers || 0),
        quoted: Number(body.quoted || 0),
        bestPrice: Number(body.bestPrice || 0),
        bestSupplier: body.bestSupplier || '',
        due: body.due || new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString().slice(0, 10),
        status: body.status || '进行中',
        sourceRequest: body.sourceRequest || '',
        sourceSku: body.sourceSku || '',
        sourceName: body.sourceName || '',
        quantity: Number(body.quantity || 0),
        unit: body.unit || '',
        reason: body.reason || '',
        invitedSuppliers: Array.isArray(body.invitedSuppliers) ? body.invitedSuppliers : [],
        createdAt: new Date().toISOString(),
      }
      if (!rfq.title || rfq.suppliers < 0 || rfq.quoted < 0 || rfq.quoted > rfq.suppliers) {
        return send(res, 400, { error: 'invalid RFQ fields' })
      }
      rfqs.unshift(rfq)
      event(db, 'rfq_created', `询价单 ${rfq.id} 已创建`, rfq.id)
      await writeDb(db)
      return send(res, 201, rfq)
    }

    const rfqStatusMatch = url.pathname.match(/^\/api\/rfqs\/([^/]+)\/status$/)
    if (req.method === 'PATCH' && rfqStatusMatch) {
      const rfqId = decodeURIComponent(rfqStatusMatch[1])
      const body = await readBody(req)
      const rfq = ensureRfqs(db).find((item) => item.id === rfqId)
      if (!rfq) return send(res, 404, { error: 'RFQ not found' })
      rfq.status = body.status || rfq.status
      if (body.bestSupplier) rfq.bestSupplier = body.bestSupplier
      if (typeof body.bestPrice === 'number') rfq.bestPrice = body.bestPrice
      if (rfq.status === '已授标' && !rfq.linkedPo) {
        const request = rfq.sourceRequest
          ? ensurePurchaseRequests(db).find((item) => item.pr === rfq.sourceRequest)
          : null
        const quantity = Number(rfq.quantity || request?.quantity || 1)
        const unitPrice = Number(rfq.bestPrice || request?.unitPrice || 0)
        const poId = nextSequenceId(db.purchaseOrders, 'po', 'PO-2026-', 1300)
        const po = {
          po: poId,
          supplier: rfq.bestSupplier || request?.supplier || '未选择供应商',
          created: todayLabel(),
          eta: request?.requiredDate || rfq.due || '6月15日',
          owner: request?.buyer || request?.requester || '张磊',
          amount: Math.max(0, quantity * unitPrice),
          items: 1,
          received: 0,
          status: '待审批',
          priority: request?.priority || '中',
          paid: false,
          source: 'rfq-award',
          sourceRequest: rfq.sourceRequest || '',
          sourceRfq: rfq.id,
          sourceSku: rfq.sourceSku || request?.sourceSku || '',
          sourceName: rfq.sourceName || request?.sourceName || rfq.title,
          recommendedQty: quantity,
          unit: rfq.unit || request?.unit || '',
          unitPrice,
          reason: `RFQ ${rfq.id} 授标生成，来源 ${rfq.sourceRequest || '询价单'}。${rfq.reason || ''}`.trim(),
          lines: [
            createPoLineFromRfq(rfq, request, poId, 0),
          ],
          approvalSnapshot: {
            source: 'rfq-award',
            summary: `${rfq.id} · ${rfq.bestSupplier || '供应商'} · ${quantity.toLocaleString()} ${rfq.unit || request?.unit || ''} · ${unitPrice ? `${unitPrice}/unit` : '待补价'}`,
            explanation: `RFQ 授标后生成 PO 草稿，保留来源 PR、邀请供应商、授标价格和触发原因。`,
            rfq: {
              id: rfq.id,
              sourceRequest: rfq.sourceRequest || '',
              invitedSuppliers: rfq.invitedSuppliers || [],
              bestSupplier: rfq.bestSupplier || '',
              bestPrice: unitPrice,
              due: rfq.due,
            },
            supplier: {
              name: rfq.bestSupplier || request?.supplier || '',
              unitPrice,
              amount: Math.max(0, quantity * unitPrice),
            },
            createdAt: new Date().toISOString(),
          },
        }
        normalizePurchaseOrder(po)
        db.purchaseOrders.unshift(po)
        rfq.linkedPo = po.po
        if (request && !request.linkedPo) request.linkedPo = po.po
        event(db, 'purchase_order_created', `RFQ ${rfq.id} 授标生成 ${po.po}`, po.po)
      }
      event(db, 'rfq_status', `${rfq.id} 状态更新为 ${rfq.status}`, rfq.id)
      await writeDb(db)
      return send(res, 200, rfq)
    }

    if (req.method === 'POST' && url.pathname === '/api/purchase-requests') {
      const body = await readBody(req)
      if (systemRequestSources.has(body.source) && body.sourceSku) {
        const duplicate = ensurePurchaseRequests(db).find((item) =>
          item.source === body.source &&
          item.sourceSku === body.sourceSku &&
          !['已转PO', '已驳回', '已取消'].includes(item.status)
        )
        if (duplicate) {
          return send(res, 409, {
            error: `${body.source} purchase request already exists`,
            pr: duplicate.pr,
            message: `${body.sourceSku} 已存在未关闭采购申请 ${duplicate.pr}`,
          })
        }
      }
      const request = {
        pr: body.pr || nextSequenceId(ensurePurchaseRequests(db), 'pr', 'PR-2026-', 2400),
        source: body.source || 'manual',
        sourceSku: body.sourceSku || '',
        sourceName: body.sourceName || '',
        supplier: body.supplier || '未选择供应商',
        requester: body.requester || body.owner || '张磊',
        buyer: body.buyer || body.owner || '张磊',
        created: body.created || todayLabel(),
        requiredDate: body.requiredDate || body.eta || '6月15日',
        quantity: Number(body.quantity || body.recommendedQty || 0),
        unit: body.unit || '',
        unitPrice: Number(body.unitPrice || 0),
        amount: Number(body.amount || 0),
        priority: body.priority || '中',
        status: body.status || '待审批',
        reason: body.reason || '',
        forecastBasis: body.forecastBasis || null,
        approvalSnapshot: body.approvalSnapshot || null,
        linkedPo: '',
        approvedAt: '',
        convertedAt: '',
      }
      if (!request.sourceSku && systemRequestSources.has(request.source)) {
        return send(res, 400, { error: `sourceSku is required for ${request.source} purchase requests` })
      }
      if (request.quantity <= 0 || request.amount < 0) {
        return send(res, 400, { error: 'quantity must be positive and amount cannot be negative' })
      }
      if (!purchaseRequestStatuses.has(request.status)) {
        return send(res, 400, { error: `invalid purchase request status: ${request.status}` })
      }
      if (!priorities.has(request.priority)) {
        return send(res, 400, { error: `invalid priority: ${request.priority}` })
      }
      ensurePurchaseRequests(db).unshift(request)
      event(db, 'purchase_request_created', `采购申请 ${request.pr} 已提交审批`, request.pr)
      await writeDb(db)
      return send(res, 201, request)
    }

    const prStatusMatch = url.pathname.match(/^\/api\/purchase-requests\/([^/]+)\/status$/)
    if (req.method === 'PATCH' && prStatusMatch) {
      const prId = decodeURIComponent(prStatusMatch[1])
      const body = await readBody(req)
      const request = ensurePurchaseRequests(db).find((item) => item.pr === prId)
      if (!request) return send(res, 404, { error: 'PR not found' })
      const nextStatus = body.status || request.status
      if (!purchaseRequestStatuses.has(nextStatus)) {
        return send(res, 400, { error: `invalid purchase request status: ${nextStatus}` })
      }
      request.status = nextStatus
      if (body.reason) request.decisionReason = body.reason
      if (request.status === '已批准') request.approvedAt = new Date().toISOString()
      event(db, 'purchase_request_status', `${request.pr} 状态更新为 ${request.status}`, request.pr)
      await writeDb(db)
      return send(res, 200, request)
    }

    const prConvertMatch = url.pathname.match(/^\/api\/purchase-requests\/([^/]+)\/convert-to-po$/)
    if (req.method === 'POST' && prConvertMatch) {
      const prId = decodeURIComponent(prConvertMatch[1])
      const request = ensurePurchaseRequests(db).find((item) => item.pr === prId)
      if (!request) return send(res, 404, { error: 'PR not found' })
      if (request.linkedPo) return send(res, 409, { error: 'purchase request already converted', po: request.linkedPo })
      if (request.status !== '已批准') return send(res, 409, { error: `cannot convert PR with status ${request.status}` })
      const poId = nextSequenceId(db.purchaseOrders, 'po', 'PO-2026-', 1300)
      const requestLines = Array.isArray(request.lines) && request.lines.length > 0
        ? request.lines.map((line, index) => createPoLineFromRequest({ ...request, ...line }, poId, index))
        : [createPoLineFromRequest(request, poId, 0)]
      const po = {
        po: poId,
        supplier: request.supplier,
        created: todayLabel(),
        eta: request.requiredDate,
        owner: request.buyer || request.requester,
        amount: Number(request.amount || 0),
        items: 1,
        received: 0,
        status: '待审批',
        priority: request.priority || '中',
        paid: false,
        source: 'purchase-request',
        sourceRequest: request.pr,
        sourceSku: request.sourceSku || '',
        sourceName: request.sourceName || '',
        recommendedQty: Number(request.quantity || 0),
        unit: request.unit || '',
        unitPrice: Number(request.unitPrice || 0),
        reason: request.reason || '',
        lines: requestLines,
        approvalSnapshot: request.approvalSnapshot || null,
      }
      normalizePurchaseOrder(po)
      db.purchaseOrders.unshift(po)
      request.status = '已转PO'
      request.linkedPo = po.po
      request.convertedAt = new Date().toISOString()
      event(db, 'purchase_request_converted', `采购申请 ${request.pr} 已转为 ${po.po}`, po.po)
      await writeDb(db)
      return send(res, 201, { request, po })
    }

    if (req.method === 'POST' && url.pathname === '/api/purchase-orders') {
      const body = await readBody(req)
      if (body.source === 'forecast' && body.sourceSku) {
        const duplicate = db.purchaseOrders.find((item) =>
          item.source === 'forecast' &&
          item.sourceSku === body.sourceSku &&
          !['已完成', '已取消'].includes(item.status)
        )
        if (duplicate) {
          return send(res, 409, {
            error: 'forecast purchase order already exists',
            po: duplicate.po,
            message: `${body.sourceSku} 已存在预测来源采购订单 ${duplicate.po}`,
          })
        }
      }
      const poId = body.po || nextSequenceId(db.purchaseOrders, 'po', 'PO-2026-', 1300)
      const po = {
        po: poId,
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
        source: body.source || 'manual',
        sourceSku: body.sourceSku || '',
        sourceName: body.sourceName || '',
        recommendedQty: Number(body.recommendedQty || 0),
        unit: body.unit || '',
        unitPrice: Number(body.unitPrice || 0),
        reason: body.reason || '',
        lines: Array.isArray(body.lines) && body.lines.length > 0
          ? body.lines.map((line, index) => normalizePoLine(line, { ...body, po: poId, supplier: body.supplier || '未选择供应商' }, index))
          : [normalizePoLine({
              sku: body.sourceSku || '',
              itemName: body.sourceName || body.reason || '',
              quantityOrdered: Number(body.recommendedQty || body.items || 1),
              quantityReceived: Number(body.received || 0),
              quantityAccepted: Number(body.accepted || body.received || 0),
              quantityRejected: Number(body.rejected || 0),
              unit: body.unit || '',
              unitPrice: Number(body.unitPrice || 0),
              currency: body.currency || 'CNY',
              requiredDate: body.eta || '6月15日',
              promisedDate: body.promisedDate || body.eta || '6月15日',
            }, { ...body, po: poId, supplier: body.supplier || '未选择供应商' }, 0)],
        approvalSnapshot: body.approvalSnapshot || null,
      }
      normalizePurchaseOrder(po)
      if (po.amount < 0 || po.items <= 0 || po.received < 0 || po.received > po.items) {
        return send(res, 400, { error: 'amount/items/received values are invalid' })
      }
      if (!purchaseOrderStatuses.has(po.status)) {
        return send(res, 400, { error: `invalid purchase order status: ${po.status}` })
      }
      if (!priorities.has(po.priority)) {
        return send(res, 400, { error: `invalid priority: ${po.priority}` })
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
      normalizePurchaseOrder(po)
      const nextStatus = body.status || po.status
      const nextReceived = typeof body.received === 'number' ? body.received : po.received
      if (!purchaseOrderStatuses.has(nextStatus)) {
        return send(res, 400, { error: `invalid purchase order status: ${nextStatus}` })
      }
      if (nextReceived < 0 || nextReceived > po.items) {
        return send(res, 400, { error: 'received quantity is invalid' })
      }
      if (Array.isArray(body.lines)) {
        po.lines = body.lines.map((line, index) => normalizePoLine(line, po, index))
        calculatePoHeaderFromLines(po)
      }
      po.status = nextStatus
      po.received = nextReceived
      event(db, 'purchase_order_status', `${po.po} 状态更新为 ${po.status}`, po.po)
      await writeDb(db)
      return send(res, 200, normalizePurchaseOrder(po))
    }

    if (req.method === 'GET' && url.pathname === '/api/receiving-docs') {
      normalizePurchaseOrders(db)
      return send(res, 200, (db.receivingDocs || []).map((grn) => {
        const po = db.purchaseOrders.find((item) => item.po === grn.po)
        if (po) normalizeGrnLines(grn, po, { assumeApplied: postedReceivingStatuses.has(grn.status) })
        return grn
      }))
    }

    if (req.method === 'GET' && url.pathname === '/api/inventory-movements') {
      return send(res, 200, ensureInventoryMovements(db))
    }

    if (req.method === 'GET' && url.pathname === '/api/supplier-performance') {
      return send(res, 200, supplierPerformance(db))
    }

    if (req.method === 'GET' && url.pathname === '/api/supplier-recommendations') {
      return send(res, 200, supplierRecommendations(db, {
        sku: url.searchParams.get('sku') || '',
        quantity: Number(url.searchParams.get('quantity') || 0),
        currentSupplier: url.searchParams.get('supplier') || '',
      }))
    }

    if (req.method === 'POST' && url.pathname === '/api/receiving-docs') {
      const body = await readBody(req)
      const po = db.purchaseOrders.find((item) => item.po === body.po)
      if (!body.po || !po) return send(res, 400, { error: 'valid PO is required for receiving' })
      normalizePurchaseOrder(po)
      const grn = {
        grn: body.grn || nextSequenceId(db.receivingDocs, 'grn', 'GRN-202606-', 430),
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
        lines: Array.isArray(body.lines) ? body.lines : [],
        postedAt: '',
        postedBy: '',
        inventoryApplied: false,
        inventoryMovementIds: [],
      }
      normalizeGrnLines(grn, po, { assumeApplied: false })
      if (postedReceivingStatuses.has(grn.status)) {
        try {
          applyReceivingToPoAndInventory(db, grn, po, {
            allowOverReceipt: Boolean(body.allowOverReceipt),
            postedBy: body.postedBy || body.receiver,
          })
        } catch (error) {
          return send(res, error.status || 400, { error: error.message })
        }
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
      const nextPassed = body.passed !== undefined ? Number(body.passed) : Number(grn.passed || 0)
      const nextFailed = body.failed !== undefined ? Number(body.failed) : Number(grn.failed || 0)
      const nextItems = body.items !== undefined ? Number(body.items) : Number(grn.items || 0)
      if (nextItems <= 0 || nextPassed < 0 || nextFailed < 0 || nextPassed + nextFailed > nextItems) {
        return send(res, 400, { error: 'receiving inspection quantities are invalid' })
      }
      const previousStatus = grn.status
      const po = db.purchaseOrders.find((item) => item.po === grn.po)
      if (!po) return send(res, 400, { error: 'valid PO is required for receiving update' })
      normalizePurchaseOrder(po)
      const wasPosted = postedReceivingStatuses.has(previousStatus)
      const protectedChangeError = postedGrnProtectedChangeError(grn, body, po)
      if (protectedChangeError) return send(res, 400, { error: protectedChangeError })
      const aggregatePatch = !Array.isArray(body.lines) && (
        body.passed !== undefined ||
        body.failed !== undefined ||
        body.items !== undefined ||
        body.sku !== undefined ||
        body.warehouse !== undefined
      )
      Object.assign(grn, body)
      grn.items = nextItems
      grn.passed = nextPassed
      grn.failed = nextFailed
      if (aggregatePatch) {
        grn.lines = [{
          poLineId: body.poLineId || grn.poLineId || '',
          sku: body.sku || grn.sku || po.sourceSku || '',
          itemName: body.sourceName || grn.sourceName || po.sourceName || '',
          receivedQty: postedReceivingStatuses.has(grn.status) ? nextPassed + nextFailed : nextItems,
          acceptedQty: nextPassed,
          rejectedQty: nextFailed,
          unit: grn.unit || po.unit || '',
          warehouseId: warehouseIdFor(grn.warehouse || body.warehouse || ''),
          appliedReceivedQty: wasPosted ? toNumber(grn.lines?.[0]?.appliedReceivedQty || 0) : 0,
          appliedAcceptedQty: wasPosted ? toNumber(grn.lines?.[0]?.appliedAcceptedQty || 0) : 0,
          appliedRejectedQty: wasPosted ? toNumber(grn.lines?.[0]?.appliedRejectedQty || 0) : 0,
        }]
      }
      normalizeGrnLines(grn, po, { assumeApplied: wasPosted && !Array.isArray(grn.lines) })
      if (postedReceivingStatuses.has(grn.status)) {
        try {
          applyReceivingToPoAndInventory(db, grn, po, {
            allowOverReceipt: Boolean(body.allowOverReceipt),
            postedBy: body.postedBy || body.receiver,
          })
        } catch (error) {
          return send(res, error.status || 400, { error: error.message })
        }
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
