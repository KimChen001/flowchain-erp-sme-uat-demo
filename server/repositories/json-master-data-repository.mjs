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
import { createDurableCustomerRepository } from './durable-customer-repository.mjs'

export function createJsonMasterDataRepository(db = {}, options = {}) {
  const items = createDurableItemMasterRepository({
    dataFile: options.itemDataFile || resolve('data/item-master-runtime.json'),
  })
  const suppliers = createDurableSupplierRepository({ dataFile: options.supplierDataFile || resolve('data/supplier-master-runtime.json') })
  const customers = createDurableCustomerRepository({ dataFile: options.customerDataFile || resolve('data/customer-master-runtime.json') })
  return {
    mode: 'json',
    adapter: 'json-master-data-v1',
    listItems: () => listMasterItems(db),
    getItem: (idOrSku) => findMasterItem(db, idOrSku),
    listManagedItems: (filters) => items.listItems(filters),
    getManagedItem: (idOrSku) => items.getItem(idOrSku),
    createItem: (input, actor) => items.createItem(input, actor),
    updateItem: (id, input, actor) => items.updateItem(id, input, actor),
    listCustomers: (filters) => customers.listCustomers(filters),
    getCustomer: (id) => customers.getCustomer(id),
    createCustomer: (input, actor) => customers.createCustomer(input, actor),
    updateCustomer: (id, input, actor) => customers.updateCustomer(id, input, actor),
    listSuppliers: (filters) => suppliers.listSuppliers(filters),
    getSupplier: (idOrName, options) => suppliers.getSupplier(idOrName, options),
    createSupplier: (input, actor) => suppliers.createSupplier(input, actor),
    updateSupplier: (id, input, actor) => suppliers.updateSupplier(id, input, actor),
    selectSuppliers: (filters) => suppliers.selectSuppliers(filters),
    listItemSuppliers: (itemId) => suppliers.listItemSuppliers(itemId),
    listSupplierItems: async (supplierId) => Promise.all((await suppliers.listSupplierItems(supplierId)).map(async (relationship) => ({
      ...relationship,
      item: await items.getItem(relationship.itemId),
    }))),
    createItemSupplier: async (itemId, input, actor) => suppliers.createItemSupplier(itemId, input, actor, await items.getItem(itemId)),
    updateItemSupplier: async (itemId, relationshipId, input, actor) => suppliers.updateItemSupplier(itemId, relationshipId, input, actor, await items.getItem(itemId)),
    approvedSuppliersForItem: (itemId) => suppliers.approvedSuppliersForItem(itemId),
    supplierRuntime: suppliers,
    itemRuntime: items,
    customerRuntime: customers,
    listWarehouses: () => listMasterWarehouses(db),
    listPaymentTerms: () => listPaymentTerms(db),
    listTaxCodes: () => listTaxCodes(db),
  }
}
