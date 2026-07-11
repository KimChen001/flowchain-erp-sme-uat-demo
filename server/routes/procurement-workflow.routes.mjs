import { resolve } from 'node:path'
import { createDurableProcurementRepository } from '../repositories/durable-procurement-repository.mjs'
import { createProcurementWorkflowService } from '../services/procurement-workflow-service.mjs'
const repository=createDurableProcurementRepository({dataFile:resolve('data/procurement-transactions.json')})
const service=createProcurementWorkflowService({repository,policyProvider:async()=>({directPurchaseThreshold:50000,rfqRequiredAboveAmount:100000,allowManagerOverride:true})})
const actor=ctx=>ctx.req.headers['x-flowchain-user']||'user-local'
const failure=(send,res,e)=>send(res,e.status||500,{code:e.code||'PERSISTENCE_ERROR',message:e.message,details:e.details||[],entityId:e.entityId,currentStatus:e.currentStatus,currentVersion:e.currentVersion,expectedVersion:e.expectedVersion})
export async function handleProcurementWorkflowRoute(ctx){ const {req,res,url,send,readBody}=ctx
  if(req.method==='GET'&&url.pathname==='/api/procurement/requests') return send(res,200,await repository.list('pr'))||true
  if(req.method==='POST'&&url.pathname==='/api/procurement/requests'){try{return send(res,201,await service.createPurchaseRequest(await readBody(req),actor(ctx)))||true}catch(e){failure(send,res,e);return true}}
  const action=url.pathname.match(/^\/api\/procurement\/requests\/([^/]+)\/(submit|approve|reject|cancel)$/)
  if(req.method==='POST'&&action){try{const b=await readBody(req);const next={submit:'submitted',approve:'approved',reject:'rejected',cancel:'cancelled'}[action[2]];send(res,200,await service.transitionPurchaseRequest(decodeURIComponent(action[1]),next,{...b,actor:actor(ctx)}))}catch(e){failure(send,res,e)}return true}
  const recommendation=url.pathname.match(/^\/api\/procurement\/requests\/([^/]+)\/path-recommendation$/)
  if(req.method==='GET'&&recommendation){try{send(res,200,await service.recommendPath(decodeURIComponent(recommendation[1]),actor(ctx)))}catch(e){failure(send,res,e)}return true}
  const rfq=url.pathname.match(/^\/api\/procurement\/requests\/([^/]+)\/rfqs$/)
  if(req.method==='POST'&&rfq){try{send(res,201,await service.createRfqFromPurchaseRequest(decodeURIComponent(rfq[1]),await readBody(req),actor(ctx)))}catch(e){failure(send,res,e)}return true}
  const po=url.pathname.match(/^\/api\/procurement\/requests\/([^/]+)\/direct-purchase-order$/)
  if(req.method==='POST'&&po){try{send(res,201,await service.createDirectPoFromPurchaseRequest(decodeURIComponent(po[1]),await readBody(req),actor(ctx)))}catch(e){failure(send,res,e)}return true}
  if(req.method==='GET'&&url.pathname==='/api/procurement/rfqs') return send(res,200,await repository.list('rfq'))||true
  if(req.method==='GET'&&url.pathname==='/api/procurement/orders') return send(res,200,await repository.list('po'))||true
  const poAction=url.pathname.match(/^\/api\/procurement\/orders\/([^/]+)\/(submit|approve|issue|cancel)$/)
  if(req.method==='POST'&&poAction){try{const b=await readBody(req);const next={submit:'pending_approval',approve:'approved',issue:'issued',cancel:'cancelled'}[poAction[2]];send(res,200,await service.transitionPurchaseOrder(decodeURIComponent(poAction[1]),next,{...b,actor:actor(ctx)}))}catch(e){failure(send,res,e)}return true}
  const rfqAction=url.pathname.match(/^\/api\/procurement\/rfqs\/([^/]+)\/(open|cancel)$/)
  if(req.method==='POST'&&rfqAction){try{const b=await readBody(req);send(res,200,await service.transitionRfq(decodeURIComponent(rfqAction[1]),rfqAction[2]==='open'?'open':'cancelled',{...b,actor:actor(ctx)}))}catch(e){failure(send,res,e)}return true}
  return false }
