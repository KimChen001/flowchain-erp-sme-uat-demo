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
import { createDurableSupplierRepository } from './durable-supplier-repository.mjs'

export function createJsonMasterDataRepository(db = {}) {
  const items = createDurableItemMasterRepository({
    dataFile: resolve('data/item-master-runtime.json'),
    seed: listMasterItems(db),
  })
  const suppliers = createDurableSupplierRepository({ dataFile: resolve('data/supplier-master-runtime.json') })
  return {
    mode: 'json',
    adapter: 'json-master-data-v1',
    listItems: () => listMasterItems(db),
    getItem: (idOrSku) => findMasterItem(db, idOrSku),
    listManagedItems: (filters) => items.listItems(filters),
    getManagedItem: (idOrSku) => items.getItem(idOrSku),
    createItem: (input, actor) => items.createItem(input, actor),
    updateItem: (id, input, actor) => items.updateItem(id, input, actor),
    listSuppliers: (filters) => suppliers.listSuppliers(filters),
    getSupplier: (idOrName, options) => suppliers.getSupplier(idOrName, options),
    createSupplier: (input, actor) => suppliers.createSupplier(input, actor),
    updateSupplier: (id, input, actor) => suppliers.updateSupplier(id, input, actor),
    selectSuppliers: (filters) => suppliers.selectSuppliers(filters),
    listItemSuppliers: (itemId) => suppliers.listItemSuppliers(itemId),
    listSupplierItems: (supplierId) => suppliers.listSupplierItems(supplierId),
    createItemSupplier: async (itemId, input, actor) => suppliers.createItemSupplier(itemId, input, actor, await items.getItem(itemId)),
    updateItemSupplier: (itemId, relationshipId, input, actor) => suppliers.updateItemSupplier(itemId, relationshipId, input, actor),
    approvedSuppliersForItem: (itemId) => suppliers.approvedSuppliersForItem(itemId),
    supplierRuntime: suppliers,
    listWarehouses: () => listMasterWarehouses(db),
    listPaymentTerms: () => listPaymentTerms(db),
    listTaxCodes: () => listTaxCodes(db),
  }
}
