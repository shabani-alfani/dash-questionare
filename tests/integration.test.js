'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const os=require('node:os');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
test('one-shot sync fetches five forms serially and persists only encrypted cache',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'dash-questionare-test-'));
 try{
  fs.chmodSync(temp,0o700);
  const result=spawnSync(process.execPath,['--require',path.join(__dirname,'mock_kobo_fetch.cjs'),path.join(__dirname,'../server.js'),'--sync-once'],{
   cwd:path.join(__dirname,'..'),
   env:{...process.env,KOBO_BASE_URL:'https://kpi.esmis.moe.go.tz',KOBO_API_TOKEN:'synthetic-test-token',
     DASHBOARD_USER:'synthetic-user',DASHBOARD_PASSWORD:'synthetic-pass',KOBO_CACHE_KEY:'ef'.repeat(32),KOBO_CACHE_DIR:path.join(temp,'cache'),
     KOBO_PAGE_SIZE:'25',MAX_SUBMISSIONS:'100',KOBO_REQUEST_DELAY_MS:'0'},
   encoding:'utf8',timeout:25000,
  });
  assert.equal(result.status,0,`Expected exit 0. stderr: ${result.stderr.slice(0,1300)} stdout: ${result.stdout.slice(0,1300)}`);
  for(const id of ['mkuu','tathmini','uthibiti','mwalimu','picha']) {
    const file=path.join(temp,'cache',id+'.enc.json');
    assert.ok(fs.statSync(file).isFile(),`Missing encrypted form ${id}`);
    assert.ok(!fs.readFileSync(file,'utf8').includes('Synthetic school'));
  }
  assert.ok(result.stdout.includes('"form": "picha"'));
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
