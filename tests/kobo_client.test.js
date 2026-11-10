'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const { createClient }=require('../kobo_client');
const uid='aStHVYV5gmRm6Jt7yLGgzs';
const endpoint=`https://kpi.esmis.moe.go.tz/api/v2/assets/${uid}/data/`;
const response=(body,status=200,headers={})=>({ok:status>=200&&status<300,status,headers:{get:name=>headers[name.toLowerCase()]??null},json:async()=>body});
const clientWith=(fetchImpl,max=100)=>createClient({base:'https://kpi.esmis.moe.go.tz',pageSize:2,max,delayMs:0,retries:1,fetchImpl,sleepImpl:async()=>{}});
test('paginates across pages with auth and limit',async()=>{
  const calls=[];
  const api=clientWith(async (url,opt)=>{
    calls.push({url:String(url),opt});
    return calls.length===1?
      response({results:[{_id:1},{_id:2}],next:endpoint+'?limit=2&start=2'}):
      response({results:[{_id:3}],next:null});
  });
  const items=await api.fetchAll(uid,'token-in-memory');
  assert.deepEqual(items.map(x=>x._id),[1,2,3]);
  assert.equal(calls.length,2);
  assert.equal(calls[0].opt.headers.Authorization,'Token token-in-memory');
  assert.equal(calls[0].opt.redirect,'error');
});
test('rejects cross-origin pagination before making a second request',async()=>{
  let calls=0;
  const api=clientWith(async()=>{calls++;return response({results:[{_id:1}],next:'https://evil.example/steal'})});
  await assert.rejects(api.fetchAll(uid,'token'),/pagination URL rejected/);
  assert.equal(calls,1);
});
test('rejects unexpected path and pagination loops',async()=>{
  const api=clientWith(async()=>response({results:[{_id:1}],next:endpoint+'?limit=2'}));
  await assert.rejects(api.fetchAll(uid,'token'),/loop detected/);
  assert.throws(()=>api.validUrl(new URL('https://kpi.esmis.moe.go.tz/api/v2/users/'),`/api/v2/assets/${uid}/data/`),/rejected/);
});
test('fails without truncation when local max is exceeded',async()=>{
  const api=clientWith(async()=>response({results:[{_id:1},{_id:2}],next:null}),1);
  await assert.rejects(api.fetchAll(uid,'token'),/MAX_SUBMISSIONS exceeded/);
});
test('does not retry authentication errors',async()=>{
  let attempts=0;
  const api=clientWith(async()=>{attempts++;return response({},403)});
  await assert.rejects(api.fetchAll(uid,'token'),/HTTP 403/);
  assert.equal(attempts,1);
});
test('retries 429 once and eventually succeeds',async()=>{
  let attempts=0;
  const api=clientWith(async()=>{attempts++;return attempts===1?response({},429,{'retry-after':'1'}):response({results:[],next:null})});
  assert.deepEqual(await api.fetchAll(uid,'token'),[]);
  assert.equal(attempts,2);
});
test('enforces HTTPS-only Kobo API origin',()=>{
  assert.throws(()=>createClient({base:'http://kpi.esmis.moe.go.tz'}),/HTTPS origin/);
  assert.throws(()=>createClient({base:'https://username:password@kpi.esmis.moe.go.tz'}),/HTTPS origin/);
});
