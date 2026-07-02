export const DATA_MODES = Object.freeze({
  demo: 'demo',
  empty: 'empty',
  user: 'user',
  test: 'test',
})

const VALID_DATA_MODES = new Set(Object.values(DATA_MODES))

export function createEmptyDataset({ mode = DATA_MODES.empty } = {}) {
  return {
    __dataMode: mode,
    users: [],
    purchaseOrders: [],
    purchaseRequests: [],
    rfqs: [],
    receivingDocs: [],
    supplierInvoices: [],
    suppliers: [],
    products: [],
    inventoryMovements: [],
    inventoryExceptions: [],
    forecastPlans: [],
    marketPrices: [],
    marketSignals: [],
    sopCycles: [],
    events: [],
    auditLog: [],
    actionDrafts: [],
  }
}

export function resolveFlowchainDataMode(env = process.env) {
  const raw = String(env.FLOWCHAIN_DATA_MODE || '').trim().toLowerCase()
  const mode = VALID_DATA_MODES.has(raw) ? raw : DATA_MODES.demo
  return {
    mode,
    requestedMode: raw || null,
    isDefaulted: !raw,
    isValid: !raw || VALID_DATA_MODES.has(raw),
    dataSource: mode === DATA_MODES.demo
      ? 'scm-demo'
      : mode === DATA_MODES.test
        ? 'in-memory-test'
        : `${mode}-dataset`,
    readsDemoData: mode === DATA_MODES.demo,
    writable: mode === DATA_MODES.demo || mode === DATA_MODES.test,
  }
}

export function shouldReadDemoData(dataMode) {
  return dataMode?.mode === DATA_MODES.demo
}
