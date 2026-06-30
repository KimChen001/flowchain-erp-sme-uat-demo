import {
  findMasterItem,
  findMasterSupplier,
  listMasterItems,
  listMasterSuppliers,
  listMasterWarehouses,
  listPaymentTerms,
  listTaxCodes,
} from '../domain/master-data.mjs'

export function createJsonMasterDataRepository(db = {}) {
  return {
    listItems: () => listMasterItems(db),
    getItem: (idOrSku) => findMasterItem(db, idOrSku),
    listSuppliers: () => listMasterSuppliers(db),
    getSupplier: (idOrName) => findMasterSupplier(db, idOrName),
    listWarehouses: () => listMasterWarehouses(db),
    listPaymentTerms: () => listPaymentTerms(db),
    listTaxCodes: () => listTaxCodes(db),
  }
}
