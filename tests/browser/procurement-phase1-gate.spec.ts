import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
async function auth(page:Page){await page.addInitScript(()=>{localStorage.setItem('flowchain:auth-token','phase1');localStorage.setItem('flowchain:current-user',JSON.stringify({id:'procurement-manager',name:'采购经理',role:'采购经理'}))})}
async function supplier(request:APIRequestContext){const code=`P1-${Date.now()}`;const response=await request.post('/api/master-data/suppliers',{headers:{'x-flowchain-role':'manager'},data:{supplierCode:code,supplierName:code,status:'active',email:`${code}@test.local`}});return (await response.json()).supplier}
async function createPr(request:APIRequestContext){const s=await supplier(request);const response=await request.post('/api/procurement/requests',{headers:{'x-flowchain-role':'manager','x-flowchain-user':'procurement-manager'},data:{departmentId:'operations',defaultCurrency:'CNY',lines:[{lineId:'L1',sourceType:'non_catalog_item',lineBasis:'quantity',supplierId:s.id,itemNameSnapshot:'测试服务',unitSnapshot:'项',commodityId:'service',quantity:1,estimatedUnitPrice:20,currency:'CNY',targetWarehouseId:'WH-MAIN',needByDate:'2026-08-01'}]}});expect(response.status()).toBe(201);return response.json()}
test.beforeEach(async({page})=>auth(page))

test('canonical PR direct PO workflow persists through refresh',async({page,request})=>{
  let pr=await createPr(request)
  pr=await (await request.post(`/api/procurement/requests/${pr.id}/submit`,{headers:{'x-flowchain-role':'manager'},data:{expectedVersion:pr.version}})).json()
  pr=await (await request.post(`/api/procurement/requests/${pr.id}/approve`,{headers:{'x-flowchain-role':'manager'},data:{expectedVersion:pr.version}})).json()
  const converted=await request.post(`/api/procurement/requests/${pr.id}/generate-purchase-orders`,{headers:{'x-flowchain-role':'manager'},data:{expectedVersion:pr.version}})
  expect(converted.status()).toBe(201)
  const po=(await converted.json()).createdPurchaseOrders[0]
  await page.goto(`/app/procurement/orders/${po.id}`)
  await expect(page.getByRole('heading',{name:po.id})).toBeVisible()
  await expect(page.getByText(/draft · not_sent/)).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading',{name:po.id})).toBeVisible()
})
test('canonical RFQ page has a real empty state and no synthetic quotes',async({page})=>{await page.goto('/app/procurement/rfq');await expect(page.getByText('暂无询价单')).toBeVisible();await expect(page.getByText(/预计节省|当前最优|供应商排名/)).toHaveCount(0)})
test('canonical procurement pages have no page-level overflow',async({page})=>{for(const width of [768,1024,1280,1440]){await page.setViewportSize({width,height:900});for(const path of ['/app/procurement/requests','/app/procurement/orders','/app/procurement/rfq']){await page.goto(path);const sizes=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));expect(sizes.scroll).toBeLessThanOrEqual(sizes.client)}}})
test('canonical API enforces supplier permissions and expectedVersion',async({request})=>{const s=await supplier(request);const body={departmentId:'operations',defaultCurrency:'CNY',lines:[{lineId:'L1',sourceType:'non_catalog_item',lineBasis:'quantity',supplierId:s.id,itemNameSnapshot:'测试服务',unitSnapshot:'项',commodityId:'service',quantity:1,estimatedUnitPrice:10,currency:'CNY',targetWarehouseId:'WH-MAIN',needByDate:'2026-08-01'}]};expect((await request.post('/api/procurement/requests',{data:body,headers:{'x-flowchain-role':'viewer'}})).status()).toBe(403);const created=await request.post('/api/procurement/requests',{data:body,headers:{'x-flowchain-role':'business-specialist','x-flowchain-user':'u'}});expect(created.status()).toBe(201);const pr=await created.json();expect((await request.post(`/api/procurement/requests/${pr.id}/submit`,{data:{expectedVersion:pr.version},headers:{'x-flowchain-role':'business-specialist'}})).status()).toBe(200);expect((await request.post(`/api/procurement/requests/${pr.id}/cancel`,{data:{expectedVersion:1},headers:{'x-flowchain-role':'business-specialist'}})).status()).toBe(409)})
