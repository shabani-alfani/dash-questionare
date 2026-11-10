'use strict';
// Mock-only test preload. Never fetches live Kobo data.
global.fetch=async (target,options)=>{
 const url=new URL(String(target));
 if(url.hostname!=='kpi.esmis.moe.go.tz') throw Error('Unexpected URL in mocked integration test');
 if(options?.headers?.Authorization!=='Token synthetic-test-token')throw Error('Unexpected synthetic token');
 const body=url.pathname.endsWith('/data/')
  ? {count:1,next:null,results:[{_id:1,_uuid:'uuid:synthetic',_submission_time:'2026-11-10T08:00:00Z',_attachments:[],school:'Synthetic school',region:'Synthetic region'}]}
  : {content:{survey:[],choices:[]}};
 return {ok:true,status:200,headers:{get:()=>null},json:async()=>body};
};
