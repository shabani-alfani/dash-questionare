/* Elimu Analytics: opt-in complete multi-survey analysis, leaving original Mkuu wa Shule views intact. */
(()=>{
'use strict';
const FORMS=[
 ['mkuu','Dodoso la Mkuu wa Shule'],
 ['tathmini','Tathmini Uthibiti Ubora'],
 ['uthibiti','Uthibiti Ubora'],
 ['mwalimu','Dodoso la Mwalimu'],
 ['picha','Dodoso la Picha']
];
const M={form:'mkuu',mode:false,page:'overview',data:null,status:{},loading:false,error:'',filters:{region:'',district:'',ward:'',village:'',school:''},geoLevel:'region',search:'',group:'',fieldPage:0,recordPage:0,repeatPage:0,repeat:'',selectedField:'',selectedRepeatField:'',selectedRecord:'',mediaId:'',showAllFields:false,showAllRecords:false,showAllRepeat:false,showAllAnswers:false,answerPage:0,answerSearch:'',listSearch:'',sort:'count',requestId:0,moduleId:'',moduleSub:'',moduleSearch:'',moduleFieldPage:0,showAllModuleFields:false,detailBack:'questions'};
const $=s=>document.getElementById(s);
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nfmt=n=>new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(Number(n)||0);
const exists=v=>v!==undefined&&v!==null&&String(v).trim()!=='';
const unique=a=>[...new Set(a.filter(exists).map(String))];
const num=v=>(typeof v==='number'&&Number.isFinite(v))?v:(typeof v==='string'&&v.trim()!==''&&/^-?(?:\d+\.?\d*|\.\d+)$/.test(v.trim()))?Number(v):null;
const percent=(a,b)=>b?(100*a/b).toFixed(1):'0.0';
const short=s=>String(s??'').length>150?String(s).slice(0,147)+'…':String(s??'');
const out=(s)=>E(short(s));
const enc=s=>encodeURIComponent(s);
const findField=key=>M.data?.fields.find(f=>f.key===key);
const displayValue=(v,field)=>{
 if(!exists(v))return '—';
 const text=String(v), choices=field?.choices||{};
 if(field?.type?.startsWith('select_multiple '))return text.split(/\s+/).filter(Boolean).map(x=>choices[x]||x).join(', ');
 return choices[text]||text;
};
const fieldValue=(row,key)=>key?row[key]:undefined;
const getRows=()=>M.data?.rows||[];
const sortedCount=(items)=>{
 const map=new Map();for(const x of items){if(!exists(x))continue;const k=String(x);map.set(k,(map.get(k)||0)+1)}
 return [...map].map(([value,count])=>({value,count})).sort((a,b)=>b.count-a.count||a.value.localeCompare(b.value,'sw'));
};
function chooseGeo(){
 const fs=M.data?.fields||[];
 function score(f,level){
   const k=f.key.toLowerCase(),l=f.label.toLowerCase();
   let s=0;
   const pats={region:/\b(region|mkoa)\b|a1\.\s*mkoa/,district:/\b(district|halmashauri|wilaya)\b|a2\.\s*halmashauri/,ward:/\b(ward|kata)\b/,village:/\b(mtaa|kijiji|village|street|kitongoji)\b/,school:/\b(school|shule)\b|a3\.\s*jina la shule/};
   if(pats[level].test(k))s+=11;
   // The label must identify the geographic field, not merely mention it inside a narrative question.
   const lead={region:/^(?:[A-Z]\d+[a-z]?\.\s*)?(?:mkoa|region)\b/i,district:/^(?:[A-Z]\d+[a-z]?\.\s*)?(?:halmashauri|wilaya|district)\b/i,ward:/^(?:[A-Z]\d+[a-z]?\.\s*)?(?:kata|ward)\b/i,village:/^(?:[A-Z]\d+[a-z]?\.\s*)?(?:mtaa|kijiji|village|street|kitongoji)\b/i,school:/^(?:[A-Z]\d+[a-z]?\.\s*)?(?:jina la shule|school name|school|shule)\b/i};
   if(lead[level].test(f.label))s+=9;
   const exact={region:/(^|\/)(region|mkoa)$/,district:/(^|\/)(district|halmashauri|wilaya)$/,ward:/(^|\/)(ward|kata)$/,village:/(^|\/)(mtaa|kijiji|village|street|kitongoji)$/,school:/(^|\/)(school|school_name|shule)$/};
   if(exact[level].test(k))s+=15;
   if(/other|nyingine|_url|_id|registration|namba|ngazi|level|number|idadi|idadi_ya_shule|question|maoni|mhojiwa|wanafunzi|walimu/i.test(k))s-=17;
   if(/ngazi|other|namba|idadi|wanafunzi|walimu|mhojiwa|utendaji/i.test(l))s-=7;
   if(level==='school'&&/jina la shule|school_name|school$/.test(k+' '+l))s+=12;
   if(level==='region'&&/\bregion\b/i.test(k))s+=10;
   if(level==='district'&&/\bdistrict\b/i.test(k))s+=10;
   if(level==='ward'&&/\bward\b/i.test(k))s+=10;
   return s;
 }
 const out={};for(const level of ['region','district','ward','village','school']){
   const rank=fs.map(f=>({f,score:score(f,level)})).sort((a,b)=>b.score-a.score);
   out[level]=rank[0]?.score>5?rank[0].f.key:null;
 }
 return out;
}
let geo={};
function filterRows(){
 const rows=getRows();return rows.filter(r=>(!M.filters.region||String(fieldValue(r,geo.region))===M.filters.region)&&(!M.filters.district||String(fieldValue(r,geo.district))===M.filters.district)&&(!M.filters.ward||String(fieldValue(r,geo.ward))===M.filters.ward)&&(!M.filters.village||String(fieldValue(r,geo.village))===M.filters.village)&&(!M.filters.school||String(fieldValue(r,geo.school))===M.filters.school));
}
function optionList(values,current,placeholder,field){return `<option value="">${E(placeholder)}</option>`+unique(values).sort((a,b)=>displayValue(a,field).localeCompare(displayValue(b,field),'sw')).map(v=>`<option value="${E(v)}" ${v===current?'selected':''}>${E(displayValue(v,field))}</option>`).join('')}
function filterHTML(){
 const rows=getRows();const names={region:'Mkoa',district:'Wilaya / Halmashauri',ward:'Kata',village:'Mtaa / Kijiji',school:'Shule'};
 const levels=M.form==='picha'?['region','district','ward','village','school']:['region','district','ward','school'];
 let progressive=rows;
 const controls=levels.map(level=>{
  const key=geo[level],present=!!key;
  const opts=present?optionList(progressive.map(r=>fieldValue(r,key)),M.filters[level],`${names[level]} zote`,findField(key)):
    `<option value="">${names[level]} — ${level==='village'?'haijakusanywa kwenye dodoso':'hakuna field'}</option>`;
  const html=`<div class="mf-filter-item"><label>${E(names[level])}</label><select data-mf-filter="${level}" aria-label="Chuja ${names[level]}" ${present?'':'disabled'}>${opts}</select></div>`;
  if(key&&M.filters[level])progressive=progressive.filter(r=>String(fieldValue(r,key))===M.filters[level]);
  return html;
 }).join('');
 return `<div class="mf-toolbar mf-location-filters">${controls}<button data-mf-reset="1">↺ Reset filters</button></div>`;
}
function statusLine(){
 const d=M.data,st=M.status[M.form]||{};
 const time=d?.syncAt?new Date(d.syncAt).toLocaleString('sw-TZ',{dateStyle:'medium',timeStyle:'short'}):'—';
 return `<div class="mf-statusline"><span>Chanzo: <strong>Kobo API v2</strong></span><span>Sync: <strong>${E(time)}</strong></span><span>Data definition: <strong>${E(d?.metadataSource||'—')}</strong></span>${st.lastError?`<span style="color:#b86e13">Sync warning: ${E(st.lastError)}</span>`:''}</div>`;
}
function stat(label,value,hint){return `<div class="mf-stat"><small>${E(label)}</small><strong>${E(value)}</strong><em>${E(hint)}</em></div>`}
function panel(title,caption,body,opts={}){return `<section class="mf-card ${opts.wide?'wide':''}"><div class="mf-card-top"><h3>${E(title)}</h3>${opts.action||''}</div>${caption?`<p class="mf-caption">${E(caption)}</p>`:''}${body}</section>`}
function barRows(items,maxRows=20,field=null){const all=items.slice(0,maxRows);const max=Math.max(1,...items.map(x=>x.count));return all.length?all.map(x=>`<div class="mf-bar"><span title="${E(displayValue(x.value,field))}">${E(displayValue(x.value,field))}</span><div class="mf-track"><div class="mf-fill" style="width:${Math.max(.6,x.count/max*100)}%"></div></div><b>${nfmt(x.count)}</b></div>`).join(''):`<div class="mf-empty">Hakuna majibu yanayolingana na filters.</div>`}
function scrollTable(headers,rows,height='h500'){
 return `<div class="mf-scroll ${height}"><table class="mf-table"><thead><tr>${headers.map(h=>`<th>${E(h)}</th>`).join('')}</tr></thead><tbody>`+(rows.length?rows.map(c=>`<tr>${c.map(v=>`<td>${v}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${headers.length}">Hakuna rekodi kwa vigezo hivi.</td></tr>`)+`</tbody></table></div>`;
}
function paginate(items,page,size,showAll=false){const total=items.length;const pages=Math.max(1,Math.ceil(total/size));const current=Math.max(0,Math.min(page,pages-1));return {rows:showAll?items:items.slice(current*size,(current+1)*size),page:current,pages,total}}
function pager(kind,p,showAll){return `<div class="mf-pager"><span>${nfmt(p.total)} total · ${showAll?'Orodha nzima':'Page '+(p.page+1)+' / '+p.pages}</span><div class="mf-pagination-controls"><button class="mf-action" data-mf-page="${kind}:prev" ${showAll||p.page===0?'disabled':''}>← Previous</button><button class="mf-action" data-mf-page="${kind}:next" ${showAll||p.page+1>=p.pages?'disabled':''}>Next →</button><button class="mf-action" data-mf-toggleall="${kind}">${showAll?'Show pages':'View full list'}</button></div></div>`}
function locationItems(rows,level){
 if(level==='village'&&geo.village)return sortedCount(rows.map(r=>fieldValue(r,geo.village)));
 if(level==='village'){
   const parents=new Set(rows.map(r=>String(r._uuid||r._id||'')));
   const relevant=(M.data?.repeats||[]).filter(r=>/village|kijiji|mtaa|vitongoji|eneo/i.test(r.key+' '+r.label));
   let items=[];
   for(const rep of relevant)for(const record of rep.rows){
     if(!parents.has(String(record._parent_uuid||record._parent_id||'')))continue;
     const candidates=rep.fields.filter(f=>!f.key.startsWith('_')&&/name|jina|eneo|kijiji|mtaa|vitongoji/i.test(f.key+' '+f.label));
     const k=(candidates[0]||rep.fields.find(f=>!f.key.startsWith('_')))?.key;
     if(k)items.push(record[k]);
   }
   return sortedCount(items);
 }
 const k=geo[level];return k?sortedCount(rows.map(r=>fieldValue(r,k))):[];
}
function locationPanel(rows,level,caption){
 const items=locationItems(rows,level);const field=findField(geo[level]);
 return panel(({region:'Mikoa',district:'Halmashauri / Wilaya',ward:'Kata',village:'Vijiji / Mitaa / Vitongoji',school:'Shule'})[level],caption||`${nfmt(items.length)} tofauti · scroll kwa orodha`,
 `<div class="mf-scroll">${barRows(items,items.length,field)}</div>`,{action:`<button class="mf-action" data-mf-full="${level}">View full list (${nfmt(items.length)})</button>`});
}
function overview(){
 const rows=filterRows(),total=getRows().length;
 const answered=M.data.fields.filter(f=>rows.some(r=>exists(r[f.key]))).length;
 const repeats=(M.data?.repeats||[]).reduce((n,r)=>n+r.rows.length,0);
 const cards=`<div class="mf-grid">${stat('Submissions',nfmt(rows.length),`Kati ya ${nfmt(total)} zilizopokelewa`)}${stat('Mikoa',nfmt(locationItems(rows,'region').length),'Mikoa yenye majibu')}${stat('Maswali / Fields',nfmt(M.data.fields.length),`${nfmt(answered)} zenye angalau jibu`)}${stat('Repeat records',nfmt(repeats),'Zote zilizovutwa kwenye Kobo')}</div>`;
 const banner=M.data.metadataSource.includes('export headers')?`<div class="mf-warn">Question labels za export ni fallback. Dashboard itatumia labels na choices halisi ikipata questionnaire definition kutoka Kobo API.</div>`:'';
 return cards+banner+`<div class="mf-module-overview-grid">${moduleCatalog().map(m=>moduleSummaryCard(m,rows)).join('')}</div><div class="mf-panels">${locationPanel(rows,'region','Usambazaji wa submissions kwa mkoa · scroll orodha yote')}${locationPanel(rows,'district','Usambazaji wa submissions kwa halmashauri · scroll orodha yote')}${locationPanel(rows,'ward','Kata zote zilizojibu · scroll orodha yote')}${locationPanel(rows,'school','Shule zote zilizojibu · scroll orodha yote')}${locationPanel(rows,'village','Maeneo kutoka repeat groups, inapopatikana')}${panel('Coverage ya maswali','Majibu si sawa na ukamilifu wa fomu kutokana na skip logic.',`<div class="mf-scroll">${barRows(sortedCount(M.data.fields.filter(f=>rows.some(r=>exists(r[f.key]))).map(f=>f.group)),99999)}</div>`,{action:`<button class="mf-action" data-mfnav="questions">Analyze all questions</button>`})}</div>`;
}
function locations(){
 const rows=filterRows();const levels=['region','district','ward','village','school'];
 const items=locationItems(rows,M.geoLevel);const field=findField(geo[M.geoLevel]);
 const levelOptions=levels.map(l=>`<option value="${l}" ${M.geoLevel===l?'selected':''}>${E({region:'Mikoa',district:'Halmashauri / Wilaya',ward:'Kata',village:'Vijiji / Mitaa',school:'Shule'}[l])}</option>`).join('');
 const view=items.filter(x=>displayValue(x.value,field).toLowerCase().includes(M.listSearch.toLowerCase()));
 const lines=view.map((x,i)=>[E(i+1),E(displayValue(x.value,field)),E(nfmt(x.count)),E(percent(x.count,rows.length))+'%']);
 return `<div class="mf-grid">${stat('Submissions',nfmt(rows.length),'Filtered records')}${stat('Mikoa',nfmt(locationItems(rows,'region').length),'Unique')}${stat('Wilaya',nfmt(locationItems(rows,'district').length),'Unique')}${stat('Shule',nfmt(locationItems(rows,'school').length),'Unique')}</div>`+
 panel('Geographical Full List',`${nfmt(items.length)} maeneo; orodha yote kuanzia la kwanza hadi la mwisho.`,
 `<div class="mf-toolbar"><select id="mfGeoLevel">${levelOptions}</select><input id="mfListSearch" placeholder="Tafuta mkoa, halmashauri, kata, kijiji au shule..." value="${E(M.listSearch)}"><button data-mf-csv="geo">Export full CSV</button></div>${scrollTable(['#','Eneo','Submissions','% ya records'],lines,'h600')}<div class="mf-pager">Showing ${nfmt(view.length)} / ${nfmt(items.length)} locations. Scroll or search for any value.</div>`,{wide:true});
}
function fieldStats(field,rows){const values=rows.map(r=>r[field.key]).filter(exists);const numbers=values.map(num).filter(x=>x!==null);return {filled:values.length,numeric:!!values.length&&(numbers.length/values.length>.85||/^(integer|decimal|calculate)$/.test(field.type)),values,numbers,distinct:unique(values).length}}

// Executive v5: module catalog built from the LIVE questionnaire structure and
// the verified XLSForm fallback, with 100% field assignment (including metadata).
const TEACHER_FALLBACK={A:'Utambulisho na Profaili ya Mwalimu',B:'Wanafunzi na Ufundishaji',C:'Ufundishaji na Mafunzo',D:'Makazi na Usafiri wa Mwalimu',E:'Vifaa vya Kufundishia',F:'Vitabu na Miongozo',G:'Mahudhurio na Huduma za Shule',H:'Umbali na Ufikiaji',I:'Changamoto na Mapendekezo'};
let moduleCache={data:null,form:'',list:[]};
function systemField(f){return /^_|^meta\/|^__|^start$|^end$|^today$|^device_id$|^_index$|^_uuid$|^_id$|^_submission_time$|^tarehe_ya_ujazaji$|^_photo_|^_attachment_/i.test(f.key)}
function moduleCatalog(){
 const d=M.data;if(!d)return [];
 if(moduleCache.data===d&&moduleCache.form===M.form)return moduleCache.list;
 const fields=d.fields||[],groups=d.groups||[];
 const allGroups=groups.filter(g=>g.path&&g.label);
 const byPath=new Map(allGroups.map(g=>[g.path,g.label]));
 const roots=unique(allGroups.map(g=>g.path.split('/')[0]));
 const specialA4=M.form==='tathmini'&&roots.length===1&&roots[0].toLowerCase()==='a4';
 const moduleMap=new Map();
 function ensure(id,label){if(!moduleMap.has(id))moduleMap.set(id,{id,label,fields:[],repeats:[],notes:[]});return moduleMap.get(id)}
 function infer(f){
  const key=String(f.key||''), lower=key.toLowerCase();
  if(systemField(f))return ['__meta','Taarifa za Mfumo na Metadata'];
  if(M.form==='picha'){
   if(/picha|image|photo|pakia|_url\b|\burl\b/i.test(key+' '+f.label))return ['photo-media','B. Picha za Miundombinu'];
   if(/gps|latitude|longitude|altitude|precision|geopoint/i.test(key+' '+f.label))return ['photo-gps','C. Mahali na GPS ya Shule'];
   return ['photo-school','A. Utambulisho wa Shule'];
  }
  if(M.form==='mwalimu'){
   // Prefer a matching authoritative Kobo group label whenever it exists.
   const declared=allGroups.filter(g=>key===g.path||key.startsWith(g.path+'/')).sort((a,b)=>b.path.length-a.path.length)[0];
   if(declared){const root=declared.path.split('/')[0],groupLabel=byPath.get(root)||declared.label;
     const letter=(root.match(/^([a-i])(?:[_\d.-]|$)/i)||String(groupLabel).match(/^([a-i])[.\s:-]/i))?.[1]?.toUpperCase();
     if(letter)return ['teach-'+letter,groupLabel];
   }
   // Export field codes are a documented fallback when live groups cannot identify a section.
   const match=lower.match(/^(?:module[_-]?)?([a-i])(?:\d|_|\/|$)/);
   const initial=match?.[1]?.toUpperCase();
   if(initial)return ['teach-'+initial,initial+'. '+TEACHER_FALLBACK[initial]];
   if(/^(somo|darasa|school_level)/.test(lower))return ['teach-A','A. '+TEACHER_FALLBACK.A];
   if(/^(region|district|ward|school|registration|intro)/.test(lower))return ['teach-A','A. '+TEACHER_FALLBACK.A];
  }
  if(specialA4){
   if(lower.startsWith('a4/')){
    const part=key.split('/')[1];
    if(part==='yr_2425')return ['a4/yr_2425',byPath.get('a4/yr_2425')||'A4 · Mwaka wa Fedha 2024/25'];
    if(part==='yr_2526')return ['a4/yr_2526',byPath.get('a4/yr_2526')||'A4 · Mwaka wa Fedha 2025/26'];
    if(part==='taarifa_mwanzo')return ['a4/taarifa_mwanzo',byPath.get('a4/taarifa_mwanzo')||'A4 · Taarifa za Mwanzo'];
    if(part)return ['a4/'+part,byPath.get('a4/'+part)||'A4 · '+part.replace(/_/g,' ')];
   }
   return ['a4-general','A4 · Taarifa za Jumla'];
  }
  // Prefer verified XLSForm / live Kobo top-level group paths over free-text guessing.
  if(roots.length){
   let best='';for(const g of allGroups)if((key===g.path||key.startsWith(g.path+'/'))&&g.path.length>best.length)best=g.path;
   if(best){const first=best.split('/')[0];const topLabel=byPath.get(first)||first;
    if(M.form==='mwalimu'){
      const hit=(first+' '+topLabel).match(/\b([A-I])(?:\.|\s|$)/i);
      if(hit){const letter=hit[1].toUpperCase();return ['teach-'+letter,topLabel.length>3?topLabel:letter+'. '+TEACHER_FALLBACK[letter]]}
    }
    return [first,topLabel];
   }
  }
  if(M.form==='mwalimu'){
   const g=String(f.group||'');const hit=g.match(/(?:^|\s)([A-I])\s*[.\-:]/i);
   if(hit){const letter=hit[1].toUpperCase();return ['teach-'+letter,g.split('/')[0].trim()||letter+'. '+TEACHER_FALLBACK[letter]]}
  }
  if(M.form==='uthibiti'){
   const match=lower.match(/^([a-g])(?:\/|_|\d)/);if(match){const r=match[1].toUpperCase();return [r,byPath.get(r)||r+'. Maswali ya '+r]}
  }
  if(M.form==='mkuu'){
   const match=lower.match(/^module_([a-z])(?:\/|$)/);if(match)return ['module_'+match[1], 'Module '+match[1].toUpperCase()];
  }
  return ['__general','Maswali ya Jumla / Nyingine'];
 }
 for(const f of fields){const [id,label]=infer(f);ensure(id,label).fields.push(f)}
 // Repeat groups are linked under the closest relevant section; never silently excluded.
 for(const rep of d.repeats||[]){
   let id='__repeat';const path=rep.key||'';
   if(specialA4&&path.startsWith('a4/'))id=path.split('/').slice(0,2).join('/');
   else if(M.form==='uthibiti')id=path.split('/')[0];
   else if(M.form==='mwalimu'){
     const a=path.match(/^(?:module_)?([a-i])(?:[\d_/]|$)/i);
     if(a)id='teach-'+a[1].toUpperCase();
   }
   const found=moduleMap.get(id)||ensure('__repeat','Repeat Groups na Jedwali Zinazojirudia');
   found.repeats.push(rep);
 }
 for(const note of d.notes||[]){
   const path=note.path||'';
   if(!path)continue;
   const matching=[...moduleMap.values()].filter(m=>path===m.id||path.startsWith(m.id+'/')).sort((a,b)=>b.id.length-a.id.length);
   if(matching.length)matching[0].notes.push(note);
 }
 const list=[...moduleMap.values()].filter(m=>m.fields.length||m.repeats.length);
 // Metadata and miscellaneous always follow substantive modules.
 list.sort((a,b)=>{
   const last=k=>k.startsWith('__')?1:0;
   if(last(a.id)!==last(b.id))return last(a.id)-last(b.id);
   const order=M.form==='picha'?['photo-school','photo-media','photo-gps']:
       M.form==='tathmini'?['a4/taarifa_mwanzo','a4-general','a4/yr_2425','a4/yr_2526','a4/domains']:[];
   const ai=order.indexOf(a.id),bi=order.indexOf(b.id);
   if(ai!==bi)return (ai<0?999:ai)-(bi<0?999:bi);
   return a.id.localeCompare(b.id,'en',{numeric:true});
 });
 moduleCache={data:d,form:M.form,list};
 return list;
}
function moduleSummaryCard(mod,rows){
 const answered=mod.fields.filter(f=>rows.some(r=>exists(r[f.key]))).length;
 return `<button class="mf-module-overview" type="button" data-mf-module="${E(mod.id)}"><span class="mf-module-big">${E(mod.id.replace('teach-','').toUpperCase().slice(0,3))}</span><span class="mf-module-text"><strong>${E(mod.label)}</strong><small>${nfmt(mod.fields.length)} fields · ${nfmt(answered)} with answers${mod.repeats.length?' · '+nfmt(mod.repeats.length)+' repeat groups':''}</small></span><span class="mf-module-arrow">→</span></button>`;
}
function dynamicSidebar(){
 const nav=$('mfNewNav');if(!nav)return;
 const modules=moduleCatalog();const title=FORMS.find(x=>x[0]===M.form)?.[1]||M.form;
 nav.innerHTML=`<div class="mf-side-form">${E(title)}<small>${nfmt(modules.length)} moduli · ${nfmt(M.data?.fields.length||0)} fields</small></div>`+
 `<div class="side-label">Uongozi</div>`+
 [['overview','▦','Executive Overview'],['progress','◷','Submission Progress']].map(([page,sym,label])=>`<button type="button" class="nav-btn ${M.page===page?'active':''}" data-mfnav="${page}"><span class="nav-icon">${sym}</span>${E(label)}</button>`).join('')+
 `<div class="side-label">Moduli za Dodoso (${nfmt(modules.length)})</div>`+
 `<div class="mf-side-modules">${modules.map((mod,i)=>`<button type="button" class="nav-btn mf-module-nav ${M.page==='module'&&M.moduleId===mod.id?'active':''}" data-mf-module="${E(mod.id)}" title="${E(mod.label)}"><span class="nav-icon">${E(mod.id.startsWith('teach-')?mod.id.slice(-1):/^[A-Z]$/.test(mod.id)?mod.id:String(i+1))}</span><span class="mf-module-nav-name">${E(mod.label)}</span><em>${nfmt(mod.fields.length)}</em></button>`).join('')}</div>`+
 `<div class="side-label">Data & Audit</div>`+
 [['locations','◎','Full Geographic Lists'],['questions','≡','Full Analysis / All Questions'],['submissions','☷','View All Data'],['repeats','⊞','Repeat Groups'],...(M.form==='picha'?[['media','▣','Picha / Attachments']]:[]),['quality','✓','Data Quality']].map(([page,sym,label])=>`<button type="button" class="nav-btn ${M.page===page||M.page==='detail'&&page===M.detailBack?'active':''}" data-mfnav="${page}"><span class="nav-icon">${sym}</span>${E(label)}</button>`).join('')+
 `<button type="button" class="nav-btn mf-switch-back" id="mfBackClassic">← Mkuu wa Shule</button>`;
}
function progress(){
 const rows=filterRows(),times=rows.map(r=>r._submission_time||r._submitted_at||r._submission_date||'').filter(exists);
 const days=times.map(t=>{const d=new Date(t);return Number.isFinite(d.getTime())?d.toISOString().slice(0,10):null}).filter(Boolean);
 const sorted=sortedCount(days).sort((a,b)=>a.value.localeCompare(b.value));
 const last=sorted.at(-1)?.value||'—';
 const modules=moduleCatalog();
 const matrix=modules.map(mod=>{
   const answered=mod.fields.filter(f=>rows.some(r=>exists(r[f.key]))).length;
   return [`<button class="mf-action" data-mf-module="${E(mod.id)}">${E(mod.label)}</button>`,E(mod.fields.length),E(answered),E(percent(answered,mod.fields.length))+'%',E(mod.repeats.length)];
 });
 return `<div class="mf-grid">${stat('Submissions',nfmt(rows.length),'Kulingana na filters')}${stat('Siku za submissions',nfmt(sorted.length),'Tarehe tofauti zilizorekodiwa')}${stat('Submission ya mwisho',last,'Tarehe inayopatikana kwenye rekodi')}${stat('Moduli',nfmt(modules.length),'Zote zinaweza kufunguliwa')}</div>`+
 `<div class="mf-panels">`+
 panel('Mwenendo wa Submissions','Tarehe za submissions zilizochujwa; hakuna makadirio.',`<div class="mf-scroll h500">${barRows(sorted.slice().reverse(),sorted.length)}</div>`,{action:`<button class="mf-action" data-mf-csv="records">Export records</button>`})+
 panel('Coverage kwa kila Moduli','Field yenye jibu angalau moja si sawa na fomu iliyokamilika.',scrollTable(['Moduli','Fields','Zenye majibu','%','Repeat'],matrix,'h500'))+
 `</div>`;
}
function modulePage(){
 const mod=moduleCatalog().find(x=>x.id===M.moduleId)||moduleCatalog()[0];if(!mod)return `<div class="mf-empty">Hakuna fields za moduli zilizopatikana.</div>`;
 M.moduleId=mod.id;
 const rows=filterRows();let fs=mod.fields;
 const allSubgroups=unique(fs.map(f=>f.group||'Maswali ya jumla')).sort((a,b)=>a.localeCompare(b,'sw'));
 if(M.moduleSub&&allSubgroups.includes(M.moduleSub))fs=fs.filter(f=>(f.group||'Maswali ya jumla')===M.moduleSub);
 const q=M.moduleSearch.toLocaleLowerCase('sw').trim();if(q)fs=fs.filter(f=>(f.label+' '+f.key+' '+f.group).toLocaleLowerCase('sw').includes(q));
 const coverage=mod.fields.map(f=>({f,...fieldStats(f,rows)}));
 const answered=coverage.filter(st=>st.filled>0).length;
 const p=paginate(fs,M.moduleFieldPage,45,M.showAllModuleFields);
 const lines=p.rows.map((f,i)=>{const st=fieldStats(f,rows);return [E((M.showAllModuleFields?i:p.page*45+i)+1),`<div class="mf-name">${E(f.label)}<span class="mf-code">${E(f.key)}</span></div>`,E(f.group||'—'),E(st.filled)+' / '+E(rows.length),E(percent(st.filled,rows.length))+'%',`<button class="mf-action" data-mf-question="${E(enc(f.key))}">Analyze</button>`]});
 const candidate=coverage.filter(x=>x.filled>0&&(/select_|select_one|select_multiple|boolean|yesno/i.test(x.f.type)||(!x.numeric&&x.distinct>1&&x.distinct<=15))&&x.distinct<=35).slice(0,4);
 const numeric=coverage.filter(x=>x.numeric&&x.numbers.length>0&&!/^_/.test(x.f.key)).slice(0,4);
 const choiceCards=candidate.map(({f})=>{
  const vals=[];for(const r of rows){const value=r[f.key];if(!exists(value))continue;if(f.type?.startsWith('select_multiple '))vals.push(...String(value).split(/\s+/));else vals.push(value)}
  const counts=sortedCount(vals);return panel(f.label,`${nfmt(counts.length)} thamani tofauti · ${nfmt(vals.length)} majibu`, `<div class="mf-scroll">${barRows(counts,counts.length,f)}</div>`,{action:`<button class="mf-action" data-mf-question="${E(enc(f.key))}">All answers</button>`});
 }).join('');
 const numericCards=numeric.map(({f,numbers})=>{
  const sorted=numbers.slice().sort((a,b)=>a-b),sum=numbers.reduce((a,b)=>a+b,0),mean=sum/numbers.length,median=(sorted[Math.floor((sorted.length-1)/2)]+sorted[Math.floor(sorted.length/2)])/2;
  return panel(f.label,`${nfmt(numbers.length)} numeric answers · ${E(f.key)}`,`<div class="mf-numgrid"><span><small>Jumla Σ</small><b>${nfmt(sum)}</b></span><span><small>Wastani</small><b>${nfmt(mean)}</b></span><span><small>Median</small><b>${nfmt(median)}</b></span><span><small>Min / Max</small><b>${nfmt(sorted[0])} / ${nfmt(sorted.at(-1))}</b></span></div>`,{action:`<button class="mf-action" data-mf-question="${E(enc(f.key))}">All answers</button>`});
 }).join('');
 const repeatCards=mod.repeats.length?panel('Repeat groups zinazohusiana na moduli hii','Jedwali zinazorudiwa zinahifadhi rekodi za ndani tofauti na submissions kuu.',`<div class="mf-repeat-quick">${mod.repeats.map(rep=>`<button class="mf-action" data-mf-repeat="${E(enc(rep.key))}">${E(rep.label)} · ${nfmt(rep.rows?.length||0)} records</button>`).join('')}</div>`):'';
 const notes=mod.notes.length?panel('Maelekezo ya Moduli','Notes kutoka XLSForm / Kobo questionnaire metadata.',`<div class="mf-scroll">${mod.notes.map(n=>`<div class="mf-record mf-note-record">${E(n.label)}</div>`).join('')}</div>`,{wide:true}):'';
 const others=moduleCatalog();const position=others.findIndex(x=>x.id===mod.id);
 const navigation=`<div class="mf-module-heading"><div><div class="mf-eyebrow">MODULI ${position+1} / ${others.length}</div><h2>${E(mod.label)}</h2><p>Kila field, majibu na component ndani ya moduli hii inaweza kufunguliwa; geo filters za juu zinatumika.</p></div><div class="mf-module-next"><button class="mf-action" ${position===0?'disabled':''} data-mf-module="${E(others[Math.max(0,position-1)].id)}">← Previous module</button><button class="mf-action" ${position+1===others.length?'disabled':''} data-mf-module="${E(others[Math.min(others.length-1,position+1)].id)}">Next module →</button></div></div>`;
 const selectors=`<div class="mf-toolbar"><select id="mfSubgroupSelect" aria-label="Chagua kundi ndani ya moduli"><option value="">Makundi yote (${nfmt(allSubgroups.length)})</option>${allSubgroups.map(g=>`<option value="${E(g)}" ${M.moduleSub===g?'selected':''}>${E(g)}</option>`).join('')}</select><input id="mfModuleSearch" placeholder="Tafuta swali au component katika moduli hii" value="${E(M.moduleSearch)}"><button data-mf-resetmodule="1">Clear</button></div>`;
 const table=panel('Maswali yote ya moduli','Hapa hakuna Top 10 truncation. Tumia pagination au View full list kuona swali la mwisho.',selectors+scrollTable(['#','Swali / Field','Kundi','Answered','Coverage','Analysis'],lines,'h600')+pager('module',p,M.showAllModuleFields),{wide:true});
 const noData=rows.length===0?`<div class="mf-warn"><strong>Hakuna submissions bado.</strong> Moduli, maswali na makundi yote yanaonekana kutokana na Kobo/XLSForm. Charts zitaanza kuonyesha majibu baada ya submissions kupatikana.</div>`:'';
 const photoHint=M.form==='picha'?`<div class="mf-warn">Picha zinapatikana kwenye <button class="mf-action" data-mfnav="media">Picha / Attachments</button>. Tumia Mkoa → Halmashauri → Kata → Shule kuona gallery.</div>`:'';
 return navigation+`<div class="mf-grid">${stat('Submissions',nfmt(rows.length),'Kwa filters zilizopo')}${stat('Maswali / Fields',nfmt(mod.fields.length),'Yote yaliyopangwa kwa moduli')}${stat('Fields zenye data',nfmt(answered),'Angalau jibu moja')}${stat('Makundi madogo',nfmt(allSubgroups.length),'Subsections / components')}</div>`+
 noData+photoHint+`<div class="mf-panels">${choiceCards}${numericCards}</div>`+repeatCards+table+notes;
}

function questionList(){
 const rows=filterRows();const all=M.data.fields;const groups=unique(all.map(f=>f.group)).sort((a,b)=>a.localeCompare(b,'sw'));
 const query=M.search.trim().toLowerCase();
 const fields=all.filter(f=>(!M.group||f.group===M.group)&&(!query||(f.label+' '+f.key+' '+f.group).toLowerCase().includes(query)));
 const p=paginate(fields,M.fieldPage,40,M.showAllFields);
 const lines=p.rows.map((f,i)=>{
   const st=fieldStats(f,rows);const code=E(f.key),label=E(f.label);
   return [`<b>${E(M.showAllFields?i+1:i+1+p.page*40)}</b>`,`<div class="mf-name">${label}<span class="mf-code">${code}</span></div>`,E(short(f.group)),E(st.filled)+' / '+E(rows.length),E(percent(st.filled,rows.length))+'%',`<button class="mf-action" data-mf-question="${E(enc(f.key))}">Analyze</button>`];
 });
 const notes=M.data.notes||[];
 return `<div class="mf-grid">${stat('Maswali / fields',nfmt(all.length),'Hakuna yaliyoondolewa')}${stat('Groups',nfmt(groups.length),'Sections na subgroups')}${stat('Maswali yanayolingana',nfmt(fields.length),'Filters / search')}${stat('Submissions',nfmt(rows.length),'Sio idadi ya shule za nchi')}</div>`+
 panel('Full Questionnaire Analysis','Chagua swali lolote kuona frequency, numeric statistics, majibu yote, na raw values.',
 `<div class="mf-toolbar"><input id="mfFieldSearch" placeholder="Search swali, component, code, section..." value="${E(M.search)}"><select id="mfGroupSelect"><option value="">All sections (${nfmt(groups.length)})</option>${groups.map(g=>`<option value="${E(g)}" ${M.group===g?'selected':''}>${E(g)}</option>`).join('')}</select><button data-mf-clearfields="1">Clear</button></div>`+
 scrollTable(['#','Swali / Field','Section','Filled','%','Details'],lines,'h600')+pager('field',p,M.showAllFields),{wide:true})+
 (notes.length?panel('Maelekezo / Notes','Maelekezo yote kutoka questionnaire schema, sio maswali ya kujazwa.',`<div class="mf-scroll">${notes.map(n=>`<div class="mf-record" style="padding:8px 0;border-bottom:1px solid #edf2f7"><b>${E(n.path)}</b><div>${E(n.label)}</div></div>`).join('')}</div>`,{wide:true}):'');
}
function responseValues(field,rows){
 const entries=[];for(const r of rows)if(exists(r[field.key]))entries.push({raw:r[field.key],shown:displayValue(r[field.key],field),id:r._id||'',time:r._submission_time||''});
 return entries;
}
function fieldDetail(){
 const rows=filterRows();let f=findField(M.selectedField),repeat=null;
 if(M.selectedRepeatField&&M.repeat){repeat=M.data.repeats.find(r=>r.key===M.repeat);f=repeat?.fields.find(x=>x.key===M.selectedRepeatField);}
 if(!f)return `<div class="mf-warn">Field not found.</div>`;
 const targetRows=repeat?repeat.rows.filter(r=>new Set(rows.map(x=>String(x._uuid||x._id))).has(String(r._parent_uuid||r._parent_id))):rows;
 const st=fieldStats(f,targetRows),vals=responseValues(f,targetRows);
 const numeric=st.numeric&&st.numbers.length;
 const summary=numeric?{
   sum:st.numbers.reduce((a,b)=>a+b,0),average:st.numbers.reduce((a,b)=>a+b,0)/st.numbers.length,min:Math.min(...st.numbers),max:Math.max(...st.numbers)
 }:null;
 const valuesForFrequency=[];
 for(const v of vals){if(f.type?.startsWith('select_multiple '))valuesForFrequency.push(...String(v.raw).split(/\s+/).filter(Boolean));else valuesForFrequency.push(v.raw)}
 const freq=sortedCount(valuesForFrequency);
 const filtered=vals.filter(v=>String(v.shown).toLowerCase().includes(M.answerSearch.toLowerCase()));
 const p=paginate(filtered,M.answerPage,75,M.showAllAnswers);
 const answerLines=p.rows.map((v,i)=>[E(M.showAllAnswers?i+1:i+1+p.page*75),E(v.shown),E(v.id),E(v.time)]);
 const bars=panel('Full frequency distribution',`${nfmt(freq.length)} unique answers · scroll to last response value`,
 `<div class="mf-scroll h500">${barRows(freq,freq.length,f)}</div>`,{action:`<button class="mf-action" data-mf-csv="answers">Export counts</button>`});
 const raw=panel('Full responses','Hapa kila jibu la swali lililochaguliwa linaweza kufikiwa; including unique free text.',
 `<div class="mf-toolbar"><input id="mfAnswerSearch" value="${E(M.answerSearch)}" placeholder="Search answers..."></div>${scrollTable(['#','Answer','Submission ID','Submitted'],answerLines,'h500')}${pager('answer',p,M.showAllAnswers)}`);
 return `<div class="mf-toolbar"><button data-mf-back="1">← Back to ${M.detailBack==='module'?'module':'all questions'}</button><span class="mf-tag">${repeat?'REPEAT GROUP · ':''}${E(f.type)}</span></div>`+
 `<section class="mf-card"><h3>${E(f.label)}</h3><p class="mf-note">${E(f.group)} · <code>${E(f.key)}</code></p></section>`+
 `<div class="mf-grid">${stat('Answered',nfmt(st.filled),`${percent(st.filled,targetRows.length)}% records`)}${stat('Not answered / N/A',nfmt(targetRows.length-st.filled),'May be skip logic')}${stat('Distinct values',nfmt(st.distinct),'Unique raw answers')}${stat('Records in scope',nfmt(targetRows.length),repeat?'Repeat rows':'Filtered submissions')}</div>`+
 (summary?`<div class="mf-grid">${stat('Sum',nfmt(summary.sum),'Interpret only if additive')}${stat('Average',nfmt(summary.average),'Mean numeric value')}${stat('Minimum',nfmt(summary.min),'Observed value')}${stat('Maximum',nfmt(summary.max),'Observed value')}</div>`:'')+
 `<div class="mf-panels">${bars}${raw}</div>`;
}
function recordMatches(r,query){return !query||Object.values(r).some(v=>v!==null&&v!==undefined&&String(v).toLowerCase().includes(query));}
function submissions(){
 const rows=filterRows(),q=M.search.toLowerCase();const chosen=rows.filter(r=>recordMatches(r,q));
 const p=paginate(chosen,M.recordPage,75,M.showAllRecords);
 const table=p.rows.map((r,i)=>[
 E(M.showAllRecords?i+1:i+1+p.page*75),E(r._id||'—'),E(displayValue(fieldValue(r,geo.region),findField(geo.region))),E(displayValue(fieldValue(r,geo.district),findField(geo.district))),E(displayValue(fieldValue(r,geo.ward),findField(geo.ward))),E(displayValue(fieldValue(r,geo.school),findField(geo.school))),`<button class="mf-action" data-mf-record="${E(enc(String(r._id||r._uuid||'')))}">Full record</button>`]);
 return panel('All submitted records','View first to last record, with searchable full detail for every submitted field.',
 `<div class="mf-toolbar"><input id="mfRecordSearch" placeholder="Search school, region, ID, any data value..." value="${E(M.search)}"><button data-mf-csv="records">Export displayed columns CSV</button></div>`+
 scrollTable(['#','Submission ID','Mkoa','Halmashauri','Kata','Shule','Details'],table,'h600')+pager('record',p,M.showAllRecords),{wide:true});
}
function repeats(){
 const rows=filterRows(),parentIds=new Set(rows.map(r=>String(r._uuid||r._id||'')));const repeats=M.data.repeats||[];
 const selected=repeats.find(r=>r.key===M.repeat)||repeats[0];
 if(!selected)return panel('Repeat groups','No repeat groups defined for this survey.','<p class="mf-empty">Hakuna repeat group kwenye definition.</p>',{wide:true});
 M.repeat=selected.key;
 const items=selected.rows.filter(r=>parentIds.has(String(r._parent_uuid||r._parent_id)));
 const p=paginate(items,M.repeatPage,75,M.showAllRepeat);
 const fields=selected.fields.filter(f=>!f.key.startsWith('_')).slice(0,15);
 const data=p.rows.map((r,i)=>[E(M.showAllRepeat?i+1:i+1+p.page*75),...fields.map(f=>E(short(displayValue(r[f.key],f))))]);
 return `<div class="mf-grid">${stat('Repeat groups',nfmt(repeats.length),'Zilizopo na zilizodeclared')}${stat('Selected repeat records',nfmt(items.length),'Hii ndiyo repeat iliyochaguliwa')}${stat('Repeat fields',nfmt(selected.fields.length),'Kila column ya repeat')}${stat('Selected submissions',nfmt(rows.length),'Parent records')}</div>`+
 panel('Repeat groups zote','Chagua group yoyote, ikiwa ni pamoja na repeat yenye 0 records.',`<div class="mf-scroll">${repeats.map(rep=>`<button class="mf-module-button" data-mf-repeat="${E(enc(rep.key))}">${E(rep.label)}<span>${nfmt(rep.rows?.length||0)} records</span></button>`).join('')}</div>`,{wide:true})+
 panel('Repeat table · '+selected.label,'Full list ya repeat records na maswali yake.',
 `<div class="mf-toolbar"><select id="mfRepeatSelect">${repeats.map(r=>`<option value="${E(r.key)}" ${r.key===selected.key?'selected':''}>${E(r.label)} (${r.rows.length})</option>`).join('')}</select><button data-mf-csv="repeat">Export repeat CSV</button></div>`+
 scrollTable(['#',...fields.map(f=>f.label)],data,'h600')+pager('repeat',p,M.showAllRepeat),{wide:true})+
 panel('Analyze every repeat field','Bonyeza field kufungua frequency na orodha ya majibu yote.',`<div class="mf-scroll h500">${selected.fields.map(f=>`<button class="mf-module-button" data-mf-repeatfield="${E(enc(f.key))}">${E(f.label)}<span>${E(f.type)}</span></button>`).join('')}</div>`,{wide:true});
}
function media(){
 const rows=filterRows();const names={region:'Mkoa',district:'Halmashauri / Wilaya',ward:'Kata',village:'Mtaa / Kijiji',school:'Shule'};
 const levels=['region','district','ward','village','school'];
 const totalImages=rows.reduce((sum,r)=>sum+(Array.isArray(r._photo_indexes)?r._photo_indexes.length:Number(r._photo_count||0)),0);
 const imageRecords=rows.filter(r=>(r._photo_count||0)>0);
 // Image manifest is built entirely from read-only Kobo _attachments, and image requests stay authenticated.
 const all=[];for(const r of imageRecords){
   const indexes=Array.isArray(r._photo_indexes)?r._photo_indexes:Array.from({length:Math.min(10,r._photo_count||0)},(_,i)=>i);
   for(const i of indexes)all.push({id:String(r._id),index:i,row:r});
 }
 const query=M.search.toLocaleLowerCase('sw');
 const chosen=all.filter(x=>!query||recordMatches(x.row,query));
 const p=paginate(chosen,M.recordPage,24,false);
 const selection=levels.filter(level=>geo[level]&&M.filters[level]).map(level=>`${names[level]}: ${displayValue(M.filters[level],findField(geo[level]))}`);
 const crumbs=`<div class="mf-breadcrumb"><b>Ngazi ya picha</b> ${selection.length?selection.map(s=>`<span>${E(s)}</span>`).join(''):'<span>Tanzania nzima · chagua Mkoa kuanza kuchuja</span>'}</div>`;
 let next='region';for(const level of levels){if(!geo[level])continue;next=level;if(!M.filters[level])break;}
 const items=geo[next]?sortedCount(rows.map(r=>r[geo[next]])):[];
 const drill=geo[next]?panel(`Chagua ${names[next]}`,`${items.length} maeneo/shule kwenye ngazi hii · bonyeza kuchuja picha.`,
   `<div class="mf-scroll mf-drill-scroll">${items.map(x=>`<button class="mf-module-button" data-mf-drill="${E(next)}" data-mf-value="${E(enc(x.value))}"><span class="mf-drill-label">${E(displayValue(x.value,findField(geo[next])))}</span><span>${nfmt(x.count)} submissions</span></button>`).join('')||'<div class="mf-empty">Hakuna data za eneo hili.</div>'}</div>`,{wide:true}):'';
 const tile=p.rows.map((x)=>{
   const r=x.row;const school=displayValue(fieldValue(r,geo.school),findField(geo.school));
   const district=displayValue(fieldValue(r,geo.district),findField(geo.district));
   const url=`/api/multiform/attachment?form=picha&submission=${enc(x.id)}&index=${x.index}`;
   return `<figure class="mf-photo mf-image-tile"><button type="button" class="mf-photo-button" data-mf-lightbox="${E(enc(url))}" data-mf-photolabel="${E(enc(school))}" aria-label="Fungua picha ya ${E(school)}"><img src="${E(url)}" loading="lazy" decoding="async" alt="Picha ya miundombinu ya ${E(school)}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><span class="mf-image-error" style="display:none">Picha haijapatikana kwenye Kobo. Hakiki media-stats na attachment API.</span></button><figcaption><b>${E(school)}</b><small>${E(district)} · Submission ${E(x.id)} · Picha ${x.index+1}</small></figcaption></figure>`;
 }).join('');
 const note=(!geo.village)?'<div class="mf-warn">Dodoso hili halina field ya Mtaa/Kijiji kwenye metadata inayopatikana; hatujaibuni. Picha zinaweza kuchujwa kwa Mkoa → Halmashauri → Kata (ikiwa imejazwa) → Shule. Mtaa/Kijiji itapatikana tu pale itakapokusanywa kwenye Kobo.</div>':'';
 const summary=`<div class="mf-grid">${stat('Submissions zilizochujwa',nfmt(rows.length),'Kwa eneo ulilochagua')}${stat('Shule zenye picha',nfmt(imageRecords.length),'Submitted records with photo attachments')}${stat('Picha zote',nfmt(totalImages),'Hesabu ya attachments za picha')}${stat('Picha zinazoonyeshwa',`${p.rows.length} / ${chosen.length}`,'Chagua Next kuona zinazofuata')}</div>`;
 const gallery=panel('Gallery ya Picha · '+(selection.at(-1)||'Tanzania'),'Picha zinaonekana katika ngazi yoyote iliyochaguliwa, kuanzia mkoa mpaka shule. Images 24 per page for performance.',
  `<div class="mf-toolbar"><input id="mfRecordSearch" value="${E(M.search)}" placeholder="Tafuta shule, mkoa, wilaya, kata au submission..."></div><div class="mf-media-grid">${tile||'<div class="mf-empty">Hakuna picha za Kobo kwa vigezo hivi. Hakiki attachments kwenye submissions halisi.</div>'}</div>`+
   pager('record',p,false),{wide:true});
 return crumbs+summary+note+drill+gallery+panel('Full register · shule zote',
   `${nfmt(imageRecords.length)} records zenye picha, search na scroll kwa orodha nzima.`,
   `<div class="mf-scroll h500">${scrollTable(['Shule','Halmashauri','Picha','Preview'],imageRecords.map(r=>[
      E(displayValue(fieldValue(r,geo.school),findField(geo.school))),
      E(displayValue(fieldValue(r,geo.district),findField(geo.district))),
      E(r._photo_count),
      `<button class="mf-action" data-mf-media="${E(enc(String(r._id)))}">View images</button>`
   ]),'h500')}</div>`,{wide:true});
}
function quality(){
 const rows=filterRows(),all=M.data.fields;
 const stats=all.map(f=>({f,...fieldStats(f,rows)})).sort((a,b)=>a.filled-b.filled);
 const lines=stats.map(x=>[E(x.f.label),E(x.f.group),E(x.filled),E(rows.length-x.filled),E(percent(x.filled,rows.length))+'%',`<button class="mf-action" data-mf-question="${E(enc(x.f.key))}">Analyze</button>`]);
 return `<div class="mf-warn">Blank ≠ missing automatically. Skip logic, conditional groups, calculations, and non-applicable questions affect completion. This is field coverage, not an official completeness score.</div>`+
 `<div class="mf-grid">${stat('Submissions',nfmt(rows.length),'Within current filters')}${stat('Fields',nfmt(all.length),'Question + metadata fields')}${stat('Fields with data',nfmt(stats.filter(s=>s.filled>0).length),'At least one recorded value')}${stat('Blank across all',nfmt(stats.filter(s=>s.filled===0).length),'Can include N/A or notes')}</div>`+
 panel('Full field-level data coverage','From least-answered to most-answered; no columns are omitted.',scrollTable(['Field','Section','Answered','Blank / N/A','Rate','Analyze'],lines,'h600'),{wide:true});
}
function recordModal(record){
 const fields=M.data.fields,lines=fields.map(f=>[E(f.label),E(f.key),E(displayValue(record[f.key],f))]);
 openModal('Full submission · '+String(record._id||record._uuid),`<p class="mf-note">All fields are shown, including unanswered / not applicable. Nested repeat data may be inspected under Repeat Groups.</p>`+scrollTable(['Question','Code','Answer'],lines,'h600'));
}
function openModal(title,html){closeModal();const wrap=document.createElement('div');wrap.id='mfModal';wrap.className='mf-drawer-back';wrap.setAttribute('role','dialog');wrap.setAttribute('aria-modal','true');wrap.innerHTML=`<div class="mf-drawer"><div class="mf-drawer-head"><h2>${E(title)}</h2><button class="mf-action" id="mfCloseModal">Close ✕</button></div><div class="mf-drawer-main">${html}</div></div>`;document.body.appendChild(wrap);$('mfCloseModal').onclick=closeModal;wrap.addEventListener('click',e=>{if(e.target===wrap)closeModal()});}
function closeModal(){const x=$('mfModal');if(x)x.remove()}
function openFullList(level){const rows=filterRows();const items=locationItems(rows,level);const f=findField(geo[level]);M.listSearch='';const renderList=(q='')=>{
   const matches=items.filter(x=>displayValue(x.value,f).toLowerCase().includes(q.toLowerCase()));
   const lines=matches.map((x,i)=>[E(i+1),E(displayValue(x.value,f)),E(x.count),E(percent(x.count,rows.length))+'%']);
   $('mfModalList').innerHTML=scrollTable(['#','Value','Submissions','%'],lines,'h600')+`<div class="mf-pager">${matches.length} / ${items.length} values · scroll to the last</div>`;
 };
 openModal('Full List · '+({region:'Mikoa',district:'Halmashauri / Wilaya',ward:'Kata',village:'Vijiji / Mitaa',school:'Shule'}[level]),`<div class="mf-toolbar"><input id="mfModalSearch" placeholder="Tafuta kwenye orodha yote..."></div><div id="mfModalList"></div>`);
 renderList();$('mfModalSearch').oninput=e=>renderList(e.target.value);
}
function loadButton(label,handler){return `<button class="mf-action" ${handler}>${E(label)}</button>`}
function render(){
 if(!M.mode)return;
 const pc=$('pageContent');$('filters').classList.add('mf-hidden');
 const titles={overview:'Executive Overview',progress:'Submission Progress',module:'Uchambuzi wa Moduli',locations:'Full Geographic Lists',questions:'Complete Question Explorer',detail:'Question-by-Question Analysis',submissions:'All Submissions',repeats:'Repeat Groups',media:'Photographic Evidence',quality:'Data Quality & Coverage'};
 const title=M.data?.title||FORMS.find(x=>x[0]===M.form)?.[1]||'Dashboard';
 const activeMod=M.page==='module'?moduleCatalog().find(x=>x.id===M.moduleId):null;
 $('pageTitle').textContent=activeMod?.label||title;
 $('crumb').textContent=activeMod?title+' / '+activeMod.label:title;
 $('pageSubtitle').textContent=activeMod?'Uchambuzi wa kila kipengele cha moduli · submissions, frequencies na full question list':'Complete questionnaire analysis · maeneo yote, maswali yote, na full dataset lists';
 if(M.loading){pc.innerHTML=`<div class="mf-card"><h3>Loading live Kobo data...</h3><p class="mf-caption">${E(title)} · reading ${E(M.form)} submissions</p></div>`;return}
 if(!M.data){dynamicSidebar();pc.innerHTML=`<div class="mf-warn">${E(M.error||'Data za dodoso hili bado hazijasawazishwa kutoka Kobo. Hakiki API token permissions kwenye service logs.')}</div>`;return}
 geo=chooseGeo();dynamicSidebar();
 const header=`${statusLine()}${filterHTML()}`;
 const sections={overview,progress,module:modulePage,locations,questions:questionList,detail:fieldDetail,submissions,repeats,media,quality};
 const body=(sections[M.page]||overview)();
 pc.innerHTML=header+body;
 document.querySelectorAll('[data-mfnav]').forEach(x=>x.classList.toggle('active',x.dataset.mfnav===M.page));
 updateStatusLabel();
}
function setMode(enabled){
 M.mode=enabled;document.body.classList.toggle('mf-generic',enabled);
 $('mfLegacyNav').classList.toggle('mf-hidden',enabled);
 $('mfNewNav').classList.toggle('mf-hidden',!enabled);
 $('filters').classList.toggle('mf-hidden',enabled);
}
async function refreshStatuses(){
 try{const r=await fetch('/api/multiform/list',{cache:'no-store',credentials:'same-origin'});if(!r.ok)throw Error('HTTP '+r.status);const data=await r.json();
 M.status=Object.fromEntries((data.forms||[]).map(x=>[x.id,x]));updateStatusLabel();
 if(M.mode&&M.data&&M.status[M.form]?.lastSuccess&&M.status[M.form].lastSuccess!==M.data.syncAt)await loadForm(M.form,false);
 }catch(err){console.warn('Multi-form status unavailable',err)}
}
function updateStatusLabel(){
 if(!M.mode)return;const x=M.status[M.form];if(!x)return;
 const stamp=x.lastSuccess?new Date(x.lastSuccess).toLocaleTimeString('sw-TZ',{hour:'2-digit',minute:'2-digit'}):'pending';
 $('syncLabel').textContent=`${x.online?'KOBO API':'WAITING'} · ${stamp}`;$('syncDot').style.background=x.online&&!x.lastError?'#19b49c':'#dc9d32';
 $('sideSync').textContent=`${M.form}: ${nfmt(x.count)} submissions · ${stamp}`;
}
async function loadForm(id,reset=true){
 const seq=++M.requestId;M.loading=true;M.error='';if(reset){M.data=null;M.group='';M.search='';M.filters={region:'',district:'',ward:'',village:'',school:''};M.fieldPage=0;M.recordPage=0;M.repeatPage=0;M.repeat='';M.page='overview';M.moduleId='';M.moduleSub='';M.moduleSearch='';M.moduleFieldPage=0;M.geoLevel='region';}
 render();
 try{const res=await fetch('/api/multiform/data?form='+enc(id),{cache:'no-store',credentials:'same-origin'});
 const data=await res.json();if(seq!==M.requestId)return;
 if(!res.ok)throw Error(data.reason||data.error||`HTTP ${res.status}`);
 if(!Array.isArray(data.fields)||!Array.isArray(data.rows))throw Error('Unexpected API data format');
 M.data=data;M.loading=false;M.error='';geo=chooseGeo();render();
 }catch(err){if(seq!==M.requestId)return;M.loading=false;M.data=null;M.error=err.message;render();}
}
function setPage(page){
 M.mode=true;M.page=page;M.search='';M.answerSearch='';M.fieldPage=0;M.recordPage=0;M.repeatPage=0;M.answerPage=0;M.selectedRepeatField='';
 setMode(true);if(!M.data)loadForm(M.form,false);else render();window.scrollTo({top:0,behavior:'smooth'});$('sidebar').classList.remove('open');
}
function changeForm(id){
 if($('mfFormSelect'))$('mfFormSelect').value=id;
 if(!FORMS.some(x=>x[0]===id))return;
 M.form=id;M.data=null;M.requestId++;
 if(id==='mkuu'){
  setMode(false);M.page='overview';state.page='overview';renderFilters();renderPageOnly();$('syncLabel').textContent='KOBO API';
 } else {setMode(true);loadForm(id,true)}
 window.scrollTo({top:0,behavior:'smooth'});
}
function csvValue(x){const s=String(x??'');return /[",\n\r]/.test(s)?'"'+s.replaceAll('"','""')+'"':s}
function downloadCSV(name,headers,rows){const csv='\ufeff'+[headers,...rows].map(row=>row.map(csvValue).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function exportCSV(kind){
 const rows=filterRows(),label=M.form;
 if(kind==='geo'){
   const items=locationItems(rows,M.geoLevel);const f=findField(geo[M.geoLevel]);downloadCSV(`${label}_${M.geoLevel}_full.csv`,['Name','Count'],items.map(x=>[displayValue(x.value,f),x.count]));
 }else if(kind==='records'){
   const fields=['_id',geo.region,geo.district,geo.ward,geo.school].filter(Boolean);
   downloadCSV(`${label}_records.csv`,fields,rows.map(r=>fields.map(x=>r[x]??'')));
 }else if(kind==='answers'){
   const f=findField(M.selectedField);if(!f)return;
   const items=sortedCount(filterRows().map(r=>r[f.key]).filter(exists));downloadCSV(`${label}_${f.key.replaceAll('/','_')}_counts.csv`,['Value','Count'],items.map(x=>[displayValue(x.value,f),x.count]));
 }else if(kind==='repeat'){
   const rep=M.data.repeats.find(x=>x.key===M.repeat);if(!rep)return;
   const fields=rep.fields.map(x=>x.key);downloadCSV(`${label}_${rep.key.replaceAll('/','_')}.csv`,fields,rep.rows.map(r=>fields.map(k=>r[k]??'')));
 }
}
// Full 453-column classic Headteacher data view, without changing the legacy analytical modules.
const classicAll={search:'',page:0,size:50,showAll:false};
function classicAllRecords(){
 const rows=valRows(),all=rows.filter(r=>{
  const q=classicAll.search.trim().toLocaleLowerCase('sw');
  return !q||[r[5],r[6],r[7],r[9],r[10],r[11],r[443],r[445]].some(v=>String(v??'').toLocaleLowerCase('sw').includes(q));
 });
 const p=paginate(all,classicAll.page,classicAll.size,classicAll.showAll);
 const start=classicAll.showAll?0:p.page*classicAll.size;
 const body=p.rows.map((r,i)=>[
  E(start+i+1),E(r[5]),E(r[6]),E(r[7]||r[8]),E(r[9]||r[10]),E(r[11]),
  `<button type="button" class="mf-action" data-mf-classic-record="${start+i}">View all 453 fields</button>`
 ]);
 $('pageTitle').textContent='Mkuu wa Shule · View All Data';
 $('pageSubtitle').textContent='Kila shule, kila submission na kila column ya dodoso — 453 fields';
 $('crumb').textContent='Mkuu wa Shule / View All Data';
 $('pageContent').innerHTML=`<div class="mf-grid">${stat('Submissions zilizochujwa',nfmt(rows.length),'Mikoa na halmashauri zilizo kwenye filter')}${stat('Records zinazoonekana',nfmt(all.length),'Search ndani ya filter')}${stat('Fields / Columns','453','Taarifa zote za Kobo export')}${stat('Records kwa page',classicAll.showAll?'Zote':nfmt(classicAll.size),'Pagination + scroll')}</div>`+
 panel('All School Submissions',`Unapobonyeza View all 453 fields utaona majibu yote ya shule hiyo, hadi column ya mwisho.`,
 `<div class="mf-toolbar"><input id="mfClassicSearch" value="${E(classicAll.search)}" placeholder="Tafuta mkoa, halmashauri, kata, shule au namba ya usajili..."><button type="button" data-mf-classic-export="1">Export all 453 fields CSV</button></div>`+
 scrollTable(['#','Mkoa','Halmashauri','Kata','Shule','Registration','All data'],body,'h600')+
 pager('classic',p,classicAll.showAll),{wide:true});
 // Store the rendered search matches to provide stable row selection.
 window.__mfClassicVisible=all;
}
function openClassicRecord(i){
 const r=window.__mfClassicVisible?.[i];if(!r)return;
 const lines=HDR.map((label,index)=>[E(index+1),E(label),E(r[index]??'—')]);
 openModal('Mkuu wa Shule · '+String(r[9]||r[10]||'Submission'),
 `<p class="mf-note">Full details: ${HDR.length} columns. Blank fields may be non-applicable due to skip logic.</p>`+
 scrollTable(['#','Swali / Column','Jibu'],lines,'h600'));
}
function exportClassicAll(){
 const rows=valRows();downloadCSV('mkuu_wa_shule_full_453_fields.csv',HDR,rows.map(r=>r.map(v=>v??'')));
}
function installDOM(){
 const intro=document.querySelector('.page-intro');
 const formSwitcher=document.createElement('div');formSwitcher.className='survey-switch';formSwitcher.innerHTML=`<label for="mfFormSelect">Chagua Dodoso</label><select id="mfFormSelect" aria-label="Chagua dodoso la kufanyiwa uchambuzi">${FORMS.map(([id,name])=>`<option value="${id}">${E(name)}</option>`).join('')}</select><span class="survey-caption">5 surveys · live Kobo API</span>`;
 intro.insertBefore(formSwitcher,intro.firstChild);
 const sidebar=$('sidebar');const existing=[...sidebar.children];const legacy=document.createElement('div');legacy.id='mfLegacyNav';
 for(const node of existing.slice(1)){if(node.classList.contains('side-bottom'))break;legacy.appendChild(node)}
 const modern=document.createElement('div');modern.id='mfNewNav';modern.className='mf-hidden';modern.innerHTML=`<div class="side-label">Complete analysis</div>`+
 [['overview','▦','Executive Overview'],['locations','◎','Mikoa · Wilaya · Kata · Shule'],['questions','≡','Maswali & Components'],['submissions','☷','All Submissions'],['repeats','⊞','Repeat Groups'],['media','▣','Picha / Attachments'],['quality','✓','Data Quality']].map(([page,sym,name])=>`<button class="nav-btn" data-mfnav="${page}"><span class="nav-icon">${sym}</span>${E(name)}</button>`).join('')+
 `<button class="nav-btn" id="mfBackClassic" style="margin-top:15px" type="button">← Original Mkuu Dashboard</button>`;
 sidebar.insertBefore(legacy,sidebar.querySelector('.side-bottom'));sidebar.insertBefore(modern,legacy);
 const extra=document.createElement('button');extra.className='nav-btn';extra.type='button';extra.dataset.mfnav='questions';extra.innerHTML='<span class="nav-icon">≡</span> Full Analysis / All Questions';legacy.appendChild(extra);
 const place=document.createElement('button');place.className='nav-btn';place.dataset.mfnav='locations';place.innerHTML='<span class="nav-icon">◎</span> Full Geographic Lists';legacy.appendChild(place);
 const viewAll=document.createElement('button');viewAll.className='nav-btn';viewAll.type='button';viewAll.id='mfClassicViewAll';viewAll.innerHTML='<span class="nav-icon">☷</span> View All Data · Shule zote';legacy.appendChild(viewAll);
 const oldFooter=document.querySelector('.footer');if(oldFooter)oldFooter.textContent='DATA GOVERNANCE: Dashboard ya ndani inayotumia Kobo REST API. Submissions ni takwimu za waliojazisha, si kiwango cha kitaifa cha response bila denominator rasmi. Blank values zinaweza kutokana na skip logic. Usiweke public bila access controls na audit.';
 $('mfFormSelect').addEventListener('change',e=>changeForm(e.target.value));
 document.addEventListener('click',e=>{if(e.target.closest('#mfBackClassic'))changeForm('mkuu')});
 const originalRenderPageOnly=renderPageOnly;
 renderPageOnly=function(){if(M.mode){render();return}if(state.page==='allrecords'){classicAllRecords();return}return originalRenderPageOnly()};
 document.addEventListener('click',e=>{
  if(e.target.closest('#mfClassicViewAll')){M.form='mkuu';setMode(false);state.page='allrecords';classicAll.page=0;classicAll.search='';renderPageOnly();window.scrollTo({top:0,behavior:'smooth'});return}
  const cRec=e.target.closest('[data-mf-classic-record]');if(cRec){openClassicRecord(Number(cRec.dataset.mfClassicRecord));return}
  if(e.target.closest('[data-mf-classic-export]')){exportClassicAll();return}
  if(e.target.closest('[data-nav]')&&M.form==='mkuu'){setMode(false);return}
  const moduleNav=e.target.closest('[data-mf-module]');if(moduleNav){e.preventDefault();const wanted=moduleNav.dataset.mfModule;if(moduleCatalog().some(mod=>mod.id===wanted)){M.moduleId=wanted;M.moduleSub='';M.moduleSearch='';M.moduleFieldPage=0;M.showAllModuleFields=false;setPage('module')}return}
  const nav=e.target.closest('[data-mfnav]');if(nav){e.preventDefault();setPage(nav.dataset.mfnav);return}
  const full=e.target.closest('[data-mf-full]');if(full){openFullList(full.dataset.mfFull);return}
  const drill=e.target.closest('[data-mf-drill]');if(drill){
    const level=drill.dataset.mfDrill;M.filters[level]=decodeURIComponent(drill.dataset.mfValue);
    const levels=['region','district','ward','village','school'];const i=levels.indexOf(level);
    levels.slice(i+1).forEach(k=>M.filters[k]='');M.recordPage=0;M.search='';render();return;
  }
  const lb=e.target.closest('[data-mf-lightbox]');if(lb){
    const url=decodeURIComponent(lb.dataset.mfLightbox);
    const label=decodeURIComponent(lb.dataset.mfPhotolabel||'Picha ya Shule');
    if(!url.startsWith('/api/multiform/attachment?form=picha&'))return;
    openModal('Picha · '+label,`<div class="mf-zoom"><img src="${E(url)}" alt="${E(label)}"><p>Image inasomwa kwa authenticated Kobo proxy · ${E(label)}</p></div>`);return;
  }
  const q=e.target.closest('[data-mf-question]');if(q){M.detailBack=M.page==='module'?'module':'questions';M.selectedField=decodeURIComponent(q.dataset.mfQuestion);M.selectedRepeatField='';M.answerSearch='';M.answerPage=0;M.page='detail';render();window.scrollTo({top:0,behavior:'smooth'});return}
  const rfield=e.target.closest('[data-mf-repeatfield]');if(rfield){M.detailBack='repeats';M.selectedRepeatField=decodeURIComponent(rfield.dataset.mfRepeatfield);M.answerSearch='';M.answerPage=0;M.page='detail';render();return}
  const back=e.target.closest('[data-mf-back]');if(back){M.page=M.selectedRepeatField?'repeats':M.detailBack;M.selectedRepeatField='';render();return}
  const rep=e.target.closest('[data-mf-repeat]');if(rep){M.repeat=decodeURIComponent(rep.dataset.mfRepeat);M.repeatPage=0;render();return}
  const record=e.target.closest('[data-mf-record]');if(record){const id=decodeURIComponent(record.dataset.mfRecord);const found=getRows().find(x=>String(x._id||x._uuid)===id);if(found)recordModal(found);return}
  const media=e.target.closest('[data-mf-media]');if(media){M.mediaId=decodeURIComponent(media.dataset.mfMedia);M.search=M.mediaId;M.recordPage=0;render();return}
  const cp=e.target.closest('[data-mf-page^="classic:"]');if(cp){const dir=cp.dataset.mfPage.split(':')[1];classicAll.page=Math.max(0,classicAll.page+(dir==='next'?1:-1));renderPageOnly();return}
  if(e.target.closest('[data-mf-toggleall="classic"]')){classicAll.showAll=!classicAll.showAll;classicAll.page=0;renderPageOnly();return}
  const pg=e.target.closest('[data-mf-page]');if(pg){const [kind,dir]=pg.dataset.mfPage.split(':');const k={field:'fieldPage',record:'recordPage',repeat:'repeatPage',answer:'answerPage',module:'moduleFieldPage'}[kind];if(k){M[k]=Math.max(0,M[k]+(dir==='next'?1:-1));render()};return}
  const toggle=e.target.closest('[data-mf-toggleall]');if(toggle){const k={field:'showAllFields',record:'showAllRecords',repeat:'showAllRepeat',answer:'showAllAnswers',module:'showAllModuleFields'}[toggle.dataset.mfToggleall];if(k){M[k]=!M[k];render()}return}
  if(e.target.closest('[data-mf-reset]')){M.filters={region:'',district:'',ward:'',village:'',school:''};render();return}
  if(e.target.closest('[data-mf-resetmodule]')){M.moduleSub='';M.moduleSearch='';M.moduleFieldPage=0;render();return}
   if(e.target.closest('[data-mf-clearfields]')){M.search='';M.group='';M.fieldPage=0;render();return}
  const csv=e.target.closest('[data-mf-csv]');if(csv){exportCSV(csv.dataset.mfCsv);return}
  if(e.target.closest('#refreshBtn')&&M.mode){e.stopImmediatePropagation();e.preventDefault();refreshStatuses().then(()=>loadForm(M.form,false));}
 },true);
 document.addEventListener('change',e=>{
   const f=e.target.closest('[data-mf-filter]');if(f){const level=f.dataset.mfFilter;M.filters[level]=f.value;const levels=['region','district','ward','village','school'];const index=levels.indexOf(level);for(let i=index+1;i<levels.length;i++)M.filters[levels[i]]='';M.fieldPage=0;M.recordPage=0;M.repeatPage=0;render();return}
   if(e.target.id==='mfGeoLevel'){M.geoLevel=e.target.value;M.listSearch='';render();return}
   if(e.target.id==='mfGroupSelect'){M.group=e.target.value;M.fieldPage=0;render();return}
   if(e.target.id==='mfRepeatSelect'){M.repeat=e.target.value;M.repeatPage=0;render();return}
   if(e.target.id==='mfSubgroupSelect'){M.moduleSub=e.target.value;M.moduleFieldPage=0;render();return}
 });
 let t=null;document.addEventListener('input',e=>{
   if(e.target.id==='mfClassicSearch'){
      const value=e.target.value,at=e.target.selectionStart;clearTimeout(t);
      t=setTimeout(()=>{classicAll.search=value;classicAll.page=0;renderPageOnly();const x=$('mfClassicSearch');if(x){x.focus();try{x.setSelectionRange(at,at)}catch{}}},250);return;
   }
   const keys={'mfFieldSearch':['search','fieldPage'],'mfRecordSearch':['search','recordPage'],'mfListSearch':['listSearch',null],'mfAnswerSearch':['answerSearch','answerPage'],'mfModuleSearch':['moduleSearch','moduleFieldPage']};
   const v=keys[e.target.id];if(!v)return;
   const value=e.target.value,focusId=e.target.id,at=e.target.selectionStart;
   clearTimeout(t);t=setTimeout(()=>{M[v[0]]=value;if(v[1])M[v[1]]=0;render();const input=$(focusId);if(input){input.focus();try{input.setSelectionRange(at,at)}catch{}}},260);
 });
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
 refreshStatuses();setInterval(refreshStatuses,60000);
}
installDOM();
})();
