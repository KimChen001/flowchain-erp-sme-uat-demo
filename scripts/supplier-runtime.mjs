import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { emptySupplierRuntime } from '../server/repositories/durable-supplier-repository.mjs'
if(!process.argv.includes('--confirm')){console.error('Refusing to reset supplier runtime without --confirm');process.exit(2)}
const file=resolve('data/supplier-master-runtime.json'), procurementFile=resolve('data/procurement-transactions.json')
let procurement={purchaseRequests:[],rfqs:[],purchaseOrders:[],supplierInvoices:[]};try{procurement=JSON.parse(await readFile(procurementFile,'utf8'))}catch(error){if(error.code!=='ENOENT')throw error}
const referenced=new Set();for(const pr of procurement.purchaseRequests||[])for(const line of pr.lines||[])if(line.supplierId)referenced.add(line.supplierId);for(const key of ['rfqs','purchaseOrders','supplierInvoices'])for(const row of procurement[key]||[]){if(row.supplierId)referenced.add(row.supplierId);for(const line of row.lines||[])if(line.supplierId)referenced.add(line.supplierId)}
if(referenced.size){console.error(`Supplier reset refused: ${referenced.size} suppliers are referenced by procurement transactions.`);console.error('Run npm run data:reset:procurement -- --confirm first.');process.exit(3)}
let current=emptySupplierRuntime();try{current=JSON.parse(await readFile(file,'utf8'))}catch(error){if(error.code!=='ENOENT')throw error}
const stamp=new Date().toISOString().replace(/[:.]/g,'-'),backup=resolve(`data/backups/supplier-master-${stamp}.json`);await mkdir(dirname(backup),{recursive:true});try{await copyFile(file,backup)}catch(error){if(error.code!=='ENOENT')throw error;await writeFile(backup,JSON.stringify(current,null,2))}
console.log(`suppliers: ${(current.suppliers||[]).length}`);console.log(`itemSupplierRelationships: ${(current.itemSupplierRelationships||[]).length}`);console.log(`auditEvents: ${(current.auditEvents||[]).length}`);await writeFile(file,JSON.stringify(emptySupplierRuntime(),null,2),'utf8');console.log(`Backup: ${backup}`)
