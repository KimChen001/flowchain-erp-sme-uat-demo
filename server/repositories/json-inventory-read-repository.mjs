import {
  buildInventoryExceptions,
  buildInventoryItems,
  buildInventoryLots,
  buildInventoryMovements,
  buildInventorySerials,
  buildInventorySummary,
  filterInventoryRows,
  getInventoryItemBySku,
} from '../domain/inventory-read.mjs'

export function createJsonInventoryReadRepository(db = {}) {
  return {
    listItems: (filters = {}) => filterInventoryRows(buildInventoryItems(db), filters),
    listInventoryItems: (filters = {}) => filterInventoryRows(buildInventoryItems(db), filters),
    getItem: (idOrSku) => getInventoryItemBySku(db, idOrSku),
    getInventoryItem: (idOrSku) => getInventoryItemBySku(db, idOrSku),
    listLots: (filters = {}) => filterInventoryRows(buildInventoryLots(db), filters),
    listSerials: (filters = {}) => filterInventoryRows(buildInventorySerials(db), filters),
    listMovements: (filters = {}) => filterInventoryRows(buildInventoryMovements(db), filters),
    listExceptions: (filters = {}) => filterInventoryRows(buildInventoryExceptions(db), filters),
    getSummary: () => buildInventorySummary(db),
  }
}
