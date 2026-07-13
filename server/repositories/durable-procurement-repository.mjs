import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { procurementError } from '../domain/procurement-workflow.mjs'
const clone = value => structuredClone(value)
export const emptyProcurementRuntime = () => ({
  schemaVersion: 2, revision: 0, initialized: true, purchaseRequests: [], rfqs: [],
  purchaseOrders: [], receipts: [], supplierInvoices: [], matchRecords: [],
  purchaseReturns: [], workItems: [], auditEvents: [], auditEntries: [],
  idempotencyRecords: [], updatedAt: null,
})
async function atomicWrite(file, doc) { const temp = `${file}.tmp-${process.pid}-${Date.now()}`; try { await mkdir(dirname(file),{recursive:true}); await writeFile(temp,JSON.stringify(doc,null,2),'utf8'); await rename(temp,file) } catch (cause) { await rm(temp,{force:true}).catch(()=>{}); throw procurementError('PERSISTENCE_ERROR','采购交易持久化失败',[],500,{cause}) } }
export function createDurableProcurementRepository({ dataFile, seed = emptyProcurementRuntime() }) {
  let document
  async function load() { if (document) return document; try { document=JSON.parse(await readFile(dataFile,'utf8')) } catch (e) { if(e.code!=='ENOENT') throw e; document=clone(seed) }
    document = { ...emptyProcurementRuntime(), ...document, initialized: true }
    for (const key of ['purchaseRequests','rfqs','purchaseOrders','receipts','supplierInvoices','matchRecords','purchaseReturns','workItems','auditEvents','auditEntries','idempotencyRecords']) if (!Array.isArray(document[key])) document[key]=[]
    return document }
  async function save() { document.revision=Number(document.revision||0)+1; document.updatedAt=new Date().toISOString(); await atomicWrite(dataFile,document) }
  const collection = kind => ({ pr:'purchaseRequests', rfq:'rfqs', po:'purchaseOrders' })[kind]
  return {
    mode:'json', adapter:'durable-procurement-runtime-v2',
    async list(kind){ return clone((await load())[collection(kind)]) },
    async get(kind,id){ return clone((await load())[collection(kind)].find(x => x.id===id) || null) },
    async transact(fn){ const doc=await load(); const backup=clone(doc); try { const result=await fn(doc); await save(); return clone(result) } catch(e){ document=backup; throw e } },
    async findLinkedRfq(prId){ return clone((await load()).rfqs.find(x => x.sourcePrId===prId && !['cancelled','closed'].includes(x.status)) || null) },
    async findLinkedPo(prId){ return clone((await load()).purchaseOrders.find(x => x.sourcePrId===prId && x.status!=='cancelled') || null) },
    async findLinkedPos(prId){ return clone((await load()).purchaseOrders.filter(x => x.sourcePrId===prId && x.status!=='cancelled')) },
    async idempotency(key){ return clone((await load()).idempotencyRecords.find(x=>x.key===key) || null) },
    async snapshot(){ return clone(await load()) }, _dataFile:dataFile,
  }
}
