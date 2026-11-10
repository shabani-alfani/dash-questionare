/**
 * Self-hosted KoboToolbox dashboard bridge (Node.js >=20).
 * No third-party runtime dependencies; dashboard token and Kobo API token never enter browser JS.
 * HTTPS, RBAC/SSO, back-ups and audit should be handled by the production reverse proxy.
 */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const { createClient, intSetting } = require('./kobo_client.js');
const { createCache } = require('./encrypted_cache.js');

const config = {
  base: (process.env.KOBO_BASE_URL || 'https://kpi.esmis.moe.go.tz').replace(/\/$/, ''),
  uid: process.env.KOBO_ASSET_UID || 'aStHVYV5gmRm6Jt7yLGgzs',
  token: process.env.KOBO_API_TOKEN || '',
  user: process.env.DASHBOARD_USER || '',
  password: process.env.DASHBOARD_PASSWORD || '',
  webhookToken: process.env.KOBO_WEBHOOK_TOKEN || '',
  host: process.env.HOST || '127.0.0.1',
  port: Number(process.env.PORT || 5080),
  poll: Math.max(30, Number(process.env.POLL_SECONDS || 60)),
  max: intSetting(process.env.MAX_SUBMISSIONS, 10000, 1, 100000),
  pageSize: intSetting(process.env.KOBO_PAGE_SIZE, 100, 1, 500),
  requestDelayMs: intSetting(process.env.KOBO_REQUEST_DELAY_MS, 1250, 0, 60000),
  timeoutMs: intSetting(process.env.KOBO_TIMEOUT_MS, 30000, 1000, 120000),
  retries: intSetting(process.env.KOBO_MAX_RETRIES, 2, 0, 5),
};
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema_mapping.json'), 'utf8'));
const snapshot = JSON.parse(fs.readFileSync(path.join(__dirname, 'snapshot.json'), 'utf8'));
const client = createClient({base:config.base,max:config.max,pageSize:config.pageSize,delayMs:config.requestDelayMs,timeoutMs:config.timeoutMs,retries:config.retries});
const cache = createCache({keyHex:process.env.KOBO_CACHE_KEY||'',directory:process.env.KOBO_CACHE_DIR||path.join(__dirname,'.private-cache')});
config.client=client;
config.cache=cache;
const multiform = require('./multiform_backend.js').createMulti(config);
const HEADERS = snapshot.tables['MKUU WA SHULE DODOSO'].headers;
const META_INDEX = HEADERS.indexOf('_id');
const DATA_TABLE_NAME = 'MKUU WA SHULE DODOSO';
let store = {data:null, lastSuccess:null, lastError:null, syncing:false, lastCount:0, cached:false};

function getRaw(root, key) {
  if (!root || typeof root !== 'object') return null;
  if (Object.prototype.hasOwnProperty.call(root,key)) return root[key];
  const parts=String(key).split('/');
  let cur=root;
  for (const part of parts) { if(cur && typeof cur==='object' && part in cur)cur=cur[part];else {cur=undefined;break} }
  if(cur!==undefined)return cur;
  const short=parts[parts.length-1];
  if (Object.prototype.hasOwnProperty.call(root,short))return root[short];
  // Kobo repeat entries may expose full form paths or relative group prefixes.
  for(const [k,v] of Object.entries(root))if(k.endsWith('/'+short))return v;
  return null;
}
function excelSerial(value) {
  if (value===undefined||value===null||value==='')return null;
  if(typeof value==='number')return value;
  const d=new Date(value);
  return Number.isFinite(d.getTime()) ? d.getTime()/86400000+25569 : null;
}
function normalizedAnswer(obj,source) {
  if(!obj||obj.kind==='legacy_column')return null;
  if(obj.kind==='meta') {
    if(obj.key==='meta/rootUuid')return getRaw(source,'meta/rootUuid')|| (source._uuid?'uuid:'+source._uuid:null);
    return getRaw(source,obj.key);
  }
  const v=getRaw(source,obj.key);
  if(obj.kind==='note')return null;
  if(obj.component==='latitude'||obj.component==='longitude'||obj.component==='altitude'||obj.component==='precision'){
    const arr=typeof v==='string'?v.trim().split(/\s+/):Array.isArray(v)?v:[];
    const i={latitude:0,longitude:1,altitude:2,precision:3}[obj.component];
    return arr.length>i&&!isNaN(+arr[i])?Number(arr[i]):null;
  }
  if(obj.component==='url')return null;
  if(obj.kind==='geopoint')return typeof v==='string'?v:Array.isArray(v)?v.join(' '):null;
  if(obj.kind==='start'||obj.kind==='end'||obj.kind==='today'||obj.kind==='date')return excelSerial(v);
  if(obj.kind==='select_one'||obj.kind.startsWith('select_one ')) {
    if(v===null||v===undefined||v==='')return null;
    const dict=schema.choices[obj.list]||{};
    return dict[String(v)]||v;
  }
  if(obj.kind.startsWith('select_multiple ')) {
    if(v===null||v===undefined||v==='')return null;
    const tokens=Array.isArray(v)?v.map(String):String(v).split(/\s+/).filter(Boolean);
    if(obj.component==='choice')return tokens.includes(String(obj.choice))?1:0;
    return tokens.map(t=>(schema.choices[obj.list]||{})[t]||t).join(' ');
  }
  return v===undefined||v===''?null:v;
}
function convertSubmission(item) {
  const row=schema.columns.map(field=>normalizedAnswer(field,item));
  row[444]=excelSerial(item._submission_time);
  row[452]=null;
  return row;
}
function convertRepeats(items) {
  const out={};
  for(const [name,table] of Object.entries(snapshot.tables)) if(name!==DATA_TABLE_NAME)out[name]={headers:table.headers,rows:[]};
  for(const [idx,item] of items.entries()) {
    for(const [name,info] of Object.entries(schema.repeats)) {
      const rawRepeats=getRaw(item,info.rawPath);
      if(!Array.isArray(rawRepeats))continue;
      const target=out[name]; if(!target)continue;
      const nh=info.fields.length;
      for (let j=0;j<rawRepeats.length;j++) {
        const child=rawRepeats[j];
        const user=info.fields.map(field=>normalizedAnswer(field,child));
        const extra=target.headers.slice(nh).map(col=>{
          if(col==='_index')return idx+1;
          if(col==='_parent_table_name')return DATA_TABLE_NAME;
          if(col==='_parent_index')return idx+1;
          if(col==='_submission__id')return item._id??null;
          if(col==='_submission__uuid')return item._uuid??null;
          if(col==='_submission__submission_time')return excelSerial(item._submission_time);
          if(col==='_submission__validation_status')return item._validation_status??null;
          if(col==='_submission__notes')return item._notes??null;
          if(col==='_submission__status')return item._status??null;
          if(col==='_submission__submitted_by')return item._submitted_by??null;
          if(col==='_submission___version__')return item.__version__??null;
          if(col==='_submission__tags')return item._tags??null;
          if(col==='_submission_meta/rootUuid')return getRaw(item,'meta/rootUuid')||(item._uuid?'uuid:'+item._uuid:null);
          return null;
        });
        target.rows.push([...user,...extra]);
      }
    }
  }
  return out;
}
function normalizeResults(items) {
  const rows=items.map(convertSubmission);
  for(let i=0;i<rows.length;i++)rows[i][452]=i+1;
  return {
    source:'Kobo API v2',syncAt:new Date().toISOString(),uid:config.uid,
    tables:{[DATA_TABLE_NAME]:{headers:HEADERS,rows},...convertRepeats(items)},
  };
}
function restoreMainCache() {
  if (!cache.enabled) return;
  try {
    const cached=cache.load('mkuu');
    if (!cached || !Array.isArray(cached.items)) return;
    const normalized=normalizeResults(cached.items);
    normalized.syncAt=cached.syncedAt || null;
    store.data=normalized;store.lastSuccess=normalized.syncAt;store.lastCount=cached.items.length;store.cached=true;
    multiform.acceptMain(cached.items,{cached:true,syncedAt:normalized.syncAt});
    console.log(`Restored ${cached.items.length} encrypted cached headteacher submissions (stale until live sync)`);
  } catch (err) { console.warn(`Local headteacher cache cannot be read: ${err.message}`); }
}
async function sync() {
  if(store.syncing)return;
  store.syncing=true;
  try {
    const items=await client.fetchAll(config.uid,process.env.KOBO_TOKEN_MKUU||config.token);
    try { multiform.acceptMain(items); } catch (err) { console.error('Multi-form indexing failed:', err.message); }
    const latest=normalizeResults(items);
    store.data=latest;store.lastSuccess=latest.syncAt;store.lastCount=items.length;store.lastError=null;store.cached=false;
    if(cache.enabled)try{cache.save('mkuu',{syncedAt:store.lastSuccess,items});}catch(err){console.warn('Encrypted cache write failed:',err.message)}
    console.log(`[${store.lastSuccess}] Kobo sync OK: ${items.length} submissions`);
  } catch(error) {
    store.lastError=String(error.message || error);
    console.error(`[${new Date().toISOString()}] Kobo sync failed: ${store.lastError}`);
  } finally{store.syncing=false}
}
function safeEquals(a,b){if(!a||!b)return false;let aa=Buffer.from(String(a)),bb=Buffer.from(String(b));return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb)}
function basicAuth(req){const v=req.headers.authorization||'';const encoded=v.startsWith('Basic ')?v.slice(6):'';let identity='';try{identity=Buffer.from(encoded,'base64').toString('utf8')}catch{}const i=identity.indexOf(':');if(i<0)return false;return safeEquals(identity.slice(0,i),config.user)&&safeEquals(identity.slice(i+1),config.password)}
function send(res,code,body,contentType='application/json; charset=utf-8'){
  res.writeHead(code,{
    'Content-Type':contentType,'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',
    'Content-Security-Policy':"default-src 'self'; style-src 'unsafe-inline' 'self'; script-src 'unsafe-inline' 'self'; img-src data: 'self'; base-uri 'none'; frame-ancestors 'none'",
  });
  res.end(body);
}
function serve(req,res) {
  const url=new URL(req.url,'http://localhost');
  const pathname=url.pathname;
  if(pathname==='/api/internal/kobo/webhook'&&req.method==='POST') {
    if(!config.webhookToken||!safeEquals(req.headers['x-kobo-webhook-token'],config.webhookToken))return send(res,401,JSON.stringify({error:'Unauthorized webhook'}));
    if(Number(req.headers['content-length'])>1024*1024)return send(res,413,JSON.stringify({error:'Request too large'}));
    // No need to trust webhook body; use it to trigger a fresh authenticated pull from Kobo.
    req.on('data',()=>{});
    req.on('end',()=>{send(res,202,JSON.stringify({accepted:true,action:'sync scheduled'}));setTimeout(sync,1000)});
    return;
  }
  if(!basicAuth(req)){
    res.setHeader('WWW-Authenticate','Basic realm="Kobo Analytics Internal"');
    return send(res,401,JSON.stringify({error:'Authentication required'}));
  }
  if(req.method!=='GET')return send(res,405,JSON.stringify({error:'Method not allowed'}));
  if(pathname==='/multiform.js')return send(res,200,fs.readFileSync(path.join(__dirname,'multiform.js'),'utf8'),'text/javascript; charset=utf-8');
  if(pathname==='/multiform.css')return send(res,200,fs.readFileSync(path.join(__dirname,'multiform.css'),'utf8'),'text/css; charset=utf-8');
  if(pathname.startsWith('/api/multiform/'))return multiform.handle(req,res,url,send);
  if(pathname==='/api/dashboard/health')return send(res,200,JSON.stringify({online:!!store.data,syncing:store.syncing,lastSuccess:store.lastSuccess,lastError:store.lastError,records:store.lastCount,cached:store.cached,stale:store.cached || (store.lastSuccess ? Date.now()-Date.parse(store.lastSuccess)>config.poll*3*1000 : true)}));
  if(pathname==='/api/dashboard/data')return store.data?send(res,200,JSON.stringify(store.data)):send(res,503,JSON.stringify({error:'Kobo not synchronized',reason:store.lastError}));
  if(pathname==='/'||pathname==='/index.html')return send(res,200,fs.readFileSync(path.join(__dirname,'index.html'),'utf8'),'text/html; charset=utf-8');
  return send(res,404,JSON.stringify({error:'Not found'}));
}
let fullSyncRunning=false;
async function syncAll() {
  if(fullSyncRunning)return;
  fullSyncRunning=true;
  try {
    await sync();
    await multiform.syncOtherForms();
  } finally { fullSyncRunning=false; }
}
function start(){
  if(!config.token || !config.user || !config.password || config.password.startsWith('PUT_') || config.token.startsWith('PUT_')) {
    console.error('Configure KOBO_API_TOKEN, DASHBOARD_USER and DASHBOARD_PASSWORD. No placeholder values.');
    process.exitCode=1;
    return;
  }
  restoreMainCache();
  multiform.restoreCache();
  if(process.argv.includes('--sync-once')) {
    if(!cache.enabled) {
      console.error('--sync-once requires KOBO_CACHE_KEY, otherwise downloaded data would be discarded at exit.');
      process.exitCode=2;
      return;
    }
    syncAll().then(()=>{
      const results=Object.values(multiform.forms).map(f=>({form:f.id,records:f.rows.length,lastError:f.lastError,lastSuccess:f.lastSuccess}));
      console.log(JSON.stringify({headteacher:{count:store.lastCount,lastError:store.lastError},forms:results},null,2));
      if(store.lastError || results.some(f=>f.lastError))process.exitCode=1;
    }).catch(err=>{console.error('Sync failed:',err.message);process.exitCode=1});
    return;
  }
  const s=http.createServer(serve);
  s.listen(config.port,config.host,()=>console.log(`Internal dashboard at http://${config.host}:${config.port}; polling every ${config.poll}s; encrypted cache ${cache.enabled?'enabled':'disabled'}`));
  syncAll().catch(err=>console.error('Dashboard sync failed:',err.message));
  setInterval(()=>syncAll().catch(err=>console.error('Dashboard sync failed:',err.message)),config.poll*1000);
}
if(require.main===module)start();
module.exports={getRaw,excelSerial,normalizedAnswer,convertSubmission,convertRepeats,normalizeResults,schema,config};
