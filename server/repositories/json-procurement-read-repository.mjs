import {
  buildProcurementDocumentLinks,
  buildProcurementDocuments,
  buildProcurementFollowups,
  buildProcurementSummary,
  filterProcurementRows,
  getProcurementDocument,
  isProcurementDocumentType,
  normalizeProcurementDocumentType,
} from '../domain/procurement-read-model.mjs'

export function createJsonProcurementReadRepository(db = {}) {
  return {
    listDocuments: (filters = {}) => filterProcurementRows(buildProcurementDocuments(db), filters),
    getDocument: (type, id) => getProcurementDocument(db, type, id),
    listLinks: (filters = {}) => filterProcurementRows(buildProcurementDocumentLinks(db), filters),
    listFollowups: (filters = {}) => filterProcurementRows(buildProcurementFollowups(db), filters),
    getSummary: () => buildProcurementSummary(db),
    normalizeDocumentType: (type) => normalizeProcurementDocumentType(type),
    isDocumentType: (type) => isProcurementDocumentType(type),
  }
}
