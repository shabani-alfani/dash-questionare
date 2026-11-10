'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createCache}=require('../encrypted_cache');
test('encrypted cache roundtrip never writes raw PII as plaintext',()=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'kobo-cache-test-'));
  try {
    fs.chmodSync(home,0o700);
    const cache=createCache({keyHex:'ab'.repeat(32),directory:path.join(home,'.private-cache')});
    cache.save('mkuu',{items:[{_id:1,full_name:'SENSITIVE_EXAMPLE_NAME'}],syncedAt:'2026-11-10T00:00:00Z'});
    assert.equal(fs.statSync(path.join(home,'.private-cache')).mode & 0o777,0o700);
    const file=path.join(home,'.private-cache/mkuu.enc.json');
    assert.equal(fs.statSync(file).mode & 0o777,0o600);
    assert.ok(!fs.readFileSync(file,'utf8').includes('SENSITIVE_EXAMPLE_NAME'));
    assert.equal(cache.load('mkuu').items[0].full_name,'SENSITIVE_EXAMPLE_NAME');
    assert.throws(()=>createCache({keyHex:'cd'.repeat(32),directory:path.join(home,'.private-cache')}).load('mkuu'));
  } finally { fs.rmSync(home,{recursive:true,force:true}); }
});
test('cache is disabled when KOBO_CACHE_KEY is absent',()=>{
  const cache=createCache({keyHex:''});
  assert.equal(cache.enabled,false);
  assert.equal(cache.load('mkuu'),null);
});
test('invalid key is not accepted',()=>{
  assert.throws(()=>createCache({keyHex:'password'}),/64 hexadecimal/);
});
