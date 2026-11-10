/** Multi-survey read-only Kobo analytics bridge. No external runtime dependencies. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname,'survey_catalog.json'),'utf8'));
const isObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const isPresent=v=>v!==undefined&&v!==null&&v!=='';
const SYS_KEYS=new Set(['_attachments','_geolocation','_validation_status','_notes','_tags']);
// Authoritative geographic choice labels from the existing headteacher XLSForm mapping.
// Only codes actually present in a form are included in its response: avoids shipping
// the full ~29,000-school directory to every browser.
const officialChoices = require('./schema_mapping.json').choices || {};
const officialCodeLabels = new Map();
for (const list of ['regions','districts','wards','schools']) {
  for (const [code,label] of Object.entries(officialChoices[list]||{})) {
    if(typeof label==='string'&&label.trim())officialCodeLabels.set(code,label.trim());
  }
}
function resolvedChoiceFields(fields,rows) {
  return fields.map(field=>{
    const codes=new Set();
    for(const row of rows){
      const v=row[field.key];if(!isPresent(v))continue;
      // Only geographic code-like tokens are mapped here. Normal Kobo choices take precedence.
      for(const word of String(v).split(/\s+/))if(/^(?:reg|dist|ward|sch)_/.test(word))codes.add(word);
    }
    if(!codes.size)return field;
    const choices={...(field.choices||{})};
    for(const code of codes)if(officialCodeLabels.has(code))choices[code]=officialCodeLabels.get(code);
    return {...field,choices};
  });
}
function attachmentLooksImage(att){
 const mime=String(att?.mimetype||att?.mime_type||att?.content_type||'').toLowerCase();
 const name=String(att?.filename||att?.media_file_basename||att?.download_url||'').split('?')[0];
 return mime.startsWith('image/') || /\.(?:jpe?g|png|webp|gif)$/i.test(name) || (!mime&&!/\.(?:mp3|wav|mp4|m4a|pdf|zip)$/i.test(name));
}

function textLabel(v,otherwise='') {
  if(typeof v==='string')return v.replace(/<[^>]+>/g,'').trim()||otherwise;
  if(Array.isArray(v))return textLabel(v.find(x=>typeof x==='string')||v[0],otherwise);
  if(isObject(v))return textLabel(v['sw']||v['Swahili']||v['Swahili (sw)']||v['English']||Object.values(v)[0],otherwise);
  return otherwise;
}
function normalizeDef(content) {
  const survey=Array.isArray(content?.survey)?content.survey:[];
  const rawChoices=Array.isArray(content?.choices)?content.choices:[];
  const choices={};
  for(const c of rawChoices) {
    const list=String(c.list_name||'');const code=String(c.name??'');
    if(list&&code){(choices[list] ||= {})[code]=textLabel(c.label||c['label::Swahili']||c['label::sw'],code)}
  }
  const stack=[];const fields=[];const repeats=[];const notes=[];const groups=[];
  for(const row of survey) {
    if(!isObject(row))continue;
    const type=String(row.type||'').trim();const name=String(row.name||'').trim();
    const label=textLabel(row.label||row['label::Swahili']||row['label::sw'],name);
    if(type==='begin_group'||type==='begin_repeat'){
      stack.push({name,label,type});
      if(type==='begin_repeat')repeats.push({path:stack.map(x=>x.name).filter(Boolean).join('/'),label:label||name});
      else groups.push({path:stack.map(x=>x.name).filter(Boolean).join('/'),label:label||name});
    } else if(type==='end_group'||type==='end_repeat'){
      if(stack.length)stack.pop();
    } else if(type==='note'){
      notes.push({path:[...stack.map(x=>x.name),name].filter(Boolean).join('/'),label});
    } else if(type&&name){
      const list=type.startsWith('select_one ')||type.startsWith('select_multiple ')?type.split(' ').slice(1).join(' '):'';
      const rep=stack.findIndex(x=>x.type==='begin_repeat');
      fields.push({key:[...stack.map(x=>x.name),name].filter(Boolean).join('/'),label,type,list,
        group:stack.filter(x=>x.type==='begin_group').map(x=>x.label).join(' / ')||'Maswali ya jumla',
        repeat:rep<0?null:stack.slice(0,rep+1).map(x=>x.name).join('/'),choices:choices[list]||{}});
    }
  }
  return {fields,repeats,notes,groups};
}
function flattenRows(items){
  const rows=[];const repeatRows=new Map();
  function scan(obj,out,submission,prefix='',depth=0) {
    if(!isObject(obj)||depth>16)return;
    for(const [name,value] of Object.entries(obj)) {
      const key=prefix?`${prefix}/${name}`:name;
      if(name==='_attachments')continue;
      if(Array.isArray(value)&&value.every(x=>isObject(x))) {
        if(!repeatRows.has(key))repeatRows.set(key,[]);
        for(const child of value){
          const row={'_parent_uuid':submission._uuid||'', '_parent_id':submission._id||''};
          scan(child,row,submission,'',depth+1);
          repeatRows.get(key).push(row);
        }
      } else if(isObject(value))scan(value,out,submission,key,depth+1);
      else if(Array.isArray(value))out[key]=value.map(x=>String(x??'')).join(' ');
      else out[key]=value;
    }
  }
  for(const item of items){
    const row={};scan(item,row,item);rows.push(row);
  }
  return {rows,repeatRows};
}
function mergeFields(defFields,rows,source){
  // Resolve duplicate leaf names only when a unique match exists, never guess across repeating year groups.
  const keys=new Set();for(const row of rows)for(const k of Object.keys(row))keys.add(k);
  const all=Array.from(keys);const result=[];const used=new Set();
  for(const field of defFields) {
    if(field.repeat)continue;
    let key=field.key;
    if(!keys.has(key)){
      const suffix=all.filter(k=>k.endsWith('/'+field.key)||field.key.endsWith('/'+k));
      if(suffix.length===1)key=suffix[0];
      else {
        const name=field.key.split('/').at(-1);
        const leafMatches=all.filter(k=>k.split('/').at(-1)===name);
        if(leafMatches.length===1)key=leafMatches[0];
      }
    }
    if(used.has(key))continue;
    result.push({...field,key});used.add(key);
  }
  for(const key of all)if(!used.has(key)){
    result.push({key,label:key.split('/').at(-1).replace(/_/g,' '),group:key.startsWith('_')?'System metadata':'Other / API fields',type:'auto',list:'',choices:{},source});
    used.add(key);
  }
  return result;
}
function asRepeatData(defs,repeatMap){
  const repeats=[];
  const declared=new Map(defs.repeats.map(r=>[r.path,r]));
  const declaredFields=defs.fields.filter(x=>x.repeat);
  for(const [key,rows] of repeatMap.entries()) {
    const match=declared.get(key)||Array.from(declared.values()).find(x=>x.path.endsWith('/'+key)||key.endsWith('/'+x.path));
    let defsInside=declaredFields.filter(x=>x.repeat===match?.path).map(x=>({...x,key:x.key.startsWith((match?.path||key)+'/')?x.key.slice((match?.path||key).length+1):x.key}));
    repeats.push({key,label:match?.label||key,fields:mergeFields(defsInside,rows,'repeat'),rows});
  }
  for(const rep of defs.repeats)if(!repeats.some(x=>x.key===rep.path))repeats.push({key:rep.path,label:rep.label,fields:declaredFields.filter(x=>x.repeat===rep.path).map(x=>({...x,key:x.key.slice(rep.path.length+1)})),rows:[]});
  return repeats;
}
function createMulti(config){
  const base=config.base.replace(/\/$/,'');
  const forms=Object.fromEntries(catalog.forms.map(f=>[f.id,{...f,rows:[],repeats:[],fields:f.fields,groups:f.groups,notes:f.notes,lastSuccess:null,lastError:null,syncing:false,cached:false,metadataSource:f.metadataOrigin,metaLastAttempt:0,definitions:null}]));
  const tokens={mkuu:process.env.KOBO_TOKEN_MKUU||config.token,tathmini:process.env.KOBO_TOKEN_TATHMINI||config.token,uthibiti:process.env.KOBO_TOKEN_UTHIBITI||config.token,mwalimu:process.env.KOBO_TOKEN_MWALIMU||config.token,picha:process.env.KOBO_TOKEN_PICHA||config.token};
  const max=config.max;
  const client=config.client;
  const cache=config.cache;
  function defFor(f){return f.definitions||{fields:f.fields,groups:f.groups,notes:f.notes,repeats:f.repeats};}
  function getStatus(f){return {id:f.id,title:f.title,uid:f.uid,count:f.rows.length,lastSuccess:f.lastSuccess,lastError:f.lastError,syncing:f.syncing,cached:f.cached,metadataSource:f.metadataSource,fields:f.fields.length,repeats:f.repeats.length,online:!!f.lastSuccess,stale:f.cached || (f.lastSuccess?Date.now()-Date.parse(f.lastSuccess)>config.poll*3000:true)};}
  async function getMeta(f) {
    if(Date.now()-f.metaLastAttempt<3600000)return;
    f.metaLastAttempt=Date.now();
    try {
      const meta=await client.metadata(f.uid,tokens[f.id]);
      const parsed=normalizeDef(meta.content);
      if(parsed.fields.length){
        // Supplied XLSForms remain authoritative coverage manifests: live API labels improve them,
        // but must not silently discard a component missing in the current Kobo asset revision.
        if(f.id==='tathmini'||f.id==='uthibiti'){
          const baseline=catalog.forms.find(x=>x.id===f.id);
          const merged=new Map(baseline.fields.map(x=>[x.key,x]));
          for(const field of parsed.fields)merged.set(field.key,field);
          const byPath=(list)=>Array.from(new Map(list.map(x=>[x.path,x])).values());
          f.definitions={fields:[...merged.values()],groups:byPath([...baseline.groups,...parsed.groups]),notes:byPath([...baseline.notes,...parsed.notes]),repeats:byPath([...baseline.repeats,...parsed.repeats])};
          f.metadataSource='Kobo API + supplied XLSForm (full coverage)';
        } else {f.definitions=parsed;f.metadataSource='Kobo API live questionnaire definition';}
        f.metaLastAttempt=Date.now()+82800000;
      }
      else throw Error('No question definitions returned');
    }catch(err){console.warn(`Survey ${f.id}: using supplied schema fallback (${String(err.message).slice(0,90)})`)}
  }
  function ingest(id,items,{cached=false,syncedAt=null}={}){
    const f=forms[id];if(!f)return;
    f._attachmentRefs=new Map(items.map(item=>[String(item._id),Array.isArray(item._attachments)?item._attachments:[]]));
    const {rows,repeatRows}=flattenRows(items);
    const def=defFor(f);
    rows.forEach((row,i)=>{
      const refs=Array.isArray(items[i]._attachments)?items[i]._attachments:[];
      row._photo_indexes=refs.map((att,idx)=>attachmentLooksImage(att)?idx:-1).filter(idx=>idx>=0);
      row._attachment_count=refs.length;
      row._photo_count=row._photo_indexes.length;
    });
    f.rows=rows;f.fields=resolvedChoiceFields(mergeFields(def.fields,rows,f.metadataSource),rows);
    f.repeats=asRepeatData(def,repeatRows);
    for (const rep of f.repeats)rep.fields=resolvedChoiceFields(rep.fields,rep.rows);
    f.groups=def.groups;f.notes=def.notes;
    f.lastError=null;f.lastSuccess=syncedAt||new Date().toISOString();f.cached=cached;
  }
  async function fetchItems(f) {
    return client.fetchAll(f.uid,tokens[f.id]);
  }
  async function syncForm(f){
    if(f.syncing)return;f.syncing=true;
    try{
      const items=await fetchItems(f);
      await getMeta(f);
      ingest(f.id,items);
      if(cache.enabled)try{cache.save(f.id,{syncedAt:f.lastSuccess,items});}catch(err){console.warn(`Survey ${f.id} encrypted cache write failed: ${err.message}`)}
      console.log(`Survey ${f.id}: synced ${items.length} submissions, ${f.fields.length} fields, ${f.repeats.length} repeats`);
    }catch(err){f.lastError=String(err.message||err);console.error(`Survey ${f.id}: sync error ${f.lastError}`)}
    finally{f.syncing=false}
  }
  let syncRunning=false;
  async function syncOtherForms(){
    if(syncRunning)return;syncRunning=true;
    try{for(const id of ['tathmini','uthibiti','mwalimu','picha'])await syncForm(forms[id]);}
    finally{syncRunning=false}
  }
  function handle(req,res,url,send){
    if(url.pathname==='/api/multiform/list')return send(res,200,JSON.stringify({forms:catalog.forms.map(c=>getStatus(forms[c.id])),serverTime:new Date().toISOString()}));
    const id=url.searchParams.get('form');
    if(!Object.hasOwn(forms,id))return send(res,404,JSON.stringify({error:'Unknown form'}));
    const f=forms[id];
    if(url.pathname==='/api/multiform/media-stats'){
      const withPhotos=f.rows.filter(r=>r._photo_count>0);
      return send(res,200,JSON.stringify({form:id,records:f.rows.length,recordsWithPhotos:withPhotos.length,
        images:withPhotos.reduce((n,r)=>n+r._photo_count,0),lastSuccess:f.lastSuccess,lastError:f.lastError,
        note:'Attachments are fetched individually using the authenticated, same-origin proxy.'}));
    }
    if(url.pathname==='/api/multiform/data'){
      if(!f.lastSuccess)return send(res,503,JSON.stringify({error:'Survey has not synchronized',form:id,reason:f.lastError}));
      return send(res,200,JSON.stringify({id,title:f.title,uid:f.uid,syncAt:f.lastSuccess,lastError:f.lastError,metadataSource:f.metadataSource,fields:f.fields,groups:f.groups,notes:f.notes,repeats:f.repeats,rows:f.rows}));
    }
    if(url.pathname==='/api/multiform/attachment')return serveAttachment(req,res,url,f,send);
    return send(res,404,JSON.stringify({error:'Not found'}));
  }
  async function serveAttachment(req,res,url,f,send){
    // Client supplies only a synced record ID and array index. It cannot choose a URL.
    const submitted=url.searchParams.get('submission');const index=Number(url.searchParams.get('index'));
    if(!/^\d{1,15}$/.test(String(submitted))||!Number.isSafeInteger(index)||index<0||index>50)
      return send(res,400,JSON.stringify({error:'Invalid attachment parameters'}));
    const refs=f._attachmentRefs?.get(String(submitted));const att=refs?.[index];
    if(!att||!attachmentLooksImage(att))return send(res,404,JSON.stringify({error:'Image attachment not found'}));
    const baseUrl=new URL(base);
    // KoboToolbox v2 normally returns a download URL under this submission's API scope.
    // Some installations put a separate media hostname in the download_url; only the
    // scoped API pathname is ever rebased to the already configured HTTPS Kobo host.
    const prefix=`/api/v2/assets/${f.uid}/data/${submitted}/attachments/`;
    const possible=[att.download_small_url,att.download_large_url,att.download_url].filter(Boolean);
    if(!possible.length)return send(res,404,JSON.stringify({error:'Kobo has no attachment download URL'}));
    let lastCode=502;
    for(const original of possible){
      let target;
      try{
        const candidate=new URL(original,baseUrl);
        // URL may advertise an internal HTTP scheme; it is rebased onto the trusted Kobo base.
        if(!candidate.pathname.startsWith(prefix))continue;
        // Never send authorization tokens to an arbitrary host.
        target=new URL(candidate.pathname+candidate.search,baseUrl);
      }catch{continue}
      try{
        const resp=await fetch(target,{headers:{Authorization:`Token ${tokens[f.id]}`,Accept:'image/avif,image/webp,image/png,image/jpeg,image/gif,*/*'},
          redirect:'error',signal:AbortSignal.timeout(30000)});
        if(!resp.ok){lastCode=resp.status;continue}
        const type=(resp.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
        if(!['image/jpeg','image/png','image/webp','image/gif','application/octet-stream'].includes(type)){lastCode=415;continue}
        const maxSize=12*1024*1024;
        if(Number(resp.headers.get('content-length')||0)>maxSize){lastCode=413;continue}
        const chunks=[];let total=0;
        for await(const chunk of resp.body){total+=chunk.length;if(total>maxSize){lastCode=413;break}chunks.push(chunk)}
        if(total>maxSize)continue;
        const bytes=Buffer.concat(chunks,total);
        const detected=bytes.subarray(0,3).equals(Buffer.from([0xff,0xd8,0xff]))?'image/jpeg':
          bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':
          bytes.subarray(0,4).toString('ascii')==='GIF8'?'image/gif':
          (bytes.subarray(0,4).toString('ascii')==='RIFF'&&bytes.subarray(8,12).toString('ascii')==='WEBP')?'image/webp':null;
        if(!detected){lastCode=415;continue}
        res.writeHead(200,{'Content-Type':detected,'Content-Length':total,'Cache-Control':'private, no-store',
          'X-Content-Type-Options':'nosniff','Content-Disposition':'inline','Referrer-Policy':'no-referrer'});
        return res.end(bytes);
      }catch(err){lastCode=502}
    }
    // No URLs, Kobo tokens, media_file paths or filenames in public error messages.
    console.warn(`Kobo image unavailable: form=${f.id} submission=${submitted} status=${lastCode}`);
    return send(res,502,JSON.stringify({error:'Image unavailable from Kobo',upstreamStatus:lastCode}));
  }
  function acceptMain(items,options={}){
    ingest('mkuu',items,options);
  }
  function restoreCache() {
    if(!cache.enabled)return;
    for(const id of ['tathmini','uthibiti','mwalimu','picha']) {
      try {
        const saved=cache.load(id);
        if(saved && Array.isArray(saved.items)) ingest(id,saved.items,{cached:true,syncedAt:saved.syncedAt});
      } catch(err) {console.warn(`Survey ${id}: local cache unavailable (${err.message})`)}
    }
  }
  // Attachment references are refreshed inside per-form ingest without being exposed to the UI.
  const oldIngest=ingest;
  // set references from API fetch before ingest in syncForm (provided below by wrapper).
  function start(){setTimeout(()=>syncOtherForms().catch(e=>console.error('Multiform sync:',e)),15000);setInterval(()=>syncOtherForms().catch(e=>console.error('Multiform sync:',e)),config.poll*1000+15000);}
  return {start,handle,acceptMain,restoreCache,syncOtherForms,forms,ingest:oldIngest};
}
module.exports={createMulti,normalizeDef,flattenRows,mergeFields};
