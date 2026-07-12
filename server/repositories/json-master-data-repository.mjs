import {
  findMasterItem,
  findMasterSupplier,
  listMasterItems,
  listMasterSuppliers,
  listMasterWarehouses,
  listPaymentTerms,
  listTaxCodes,
} from '../domain/master-data.mjs'
import { resolve } from 'node:path'
import { createDurableItemMasterRepository } from './durable-item-master-repository.mjs'

export function createJsonMasterDataRepository(db = {}) {
  const items = createDurableItemMasterRepository({
    dataFile: resolve('data/item-master-runtime.json'),
    seed: listMasterItems(db),
  })
  return {
    mode: 'json',
    adapter: 'json-master-data-v1',
    listItems: () => listMasterItems(db),
    getItem: (idOrSku) => findMasterItem(db, idOrSku),
    listManagedItems: (filters) => items.listItems(filters),
    getManagedItem: (idOrSku) => items.getItem(idOrSku),
    createItem: (input, actor) => items.createItem(input, actor),
    updateItem: (id, input, actor) => items.updateItem(id, input, actor),
    listSuppliers: () => listMasterSuppliers(db),
    getSupplier: (idOrName) => findMasterSupplier(db, idOrName),
    listWarehouses: () => listMasterWarehouses(db),
    listPaymentTerms: () => listPaymentTerms(db),
    listTaxCodes: () => listTaxCodes(db),
  }
}
