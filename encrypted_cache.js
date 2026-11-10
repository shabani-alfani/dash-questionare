/** Opt-in encrypted local cache for potentially sensitive Kobo submissions (AES-256-GCM). */
'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
function createCache({ keyHex, directory } = {}) {
  if (!keyHex) return { enabled:false, save:()=>{}, load:()=>null };
  if (!/^[a-f\d]{64}$/i.test(keyHex)) throw new Error('KOBO_CACHE_KEY must be exactly 64 hexadecimal characters');
  const key = Buffer.from(keyHex, 'hex');
  const folder = path.resolve(directory || path.join(process.cwd(), '.private-cache'));
  const safeName = id => {
    if (!/^[a-z][a-z0-9_-]{1,49}$/i.test(id)) throw Error('Invalid cache key');
    return path.join(folder, `${id}.enc.json`);
  };
  function ensureDirectory() {
    fs.mkdirSync(folder,{recursive:true,mode:0o700});
    const st=fs.lstatSync(folder);
    if (!st.isDirectory() || st.isSymbolicLink() || (st.mode & 0o077) !== 0)
      throw Error('Local cache directory must be private (mode 0700) and not a symlink');
  }
  function save(id, data) {
    ensureDirectory();
    const name=safeName(id);
    const iv=crypto.randomBytes(12);
    const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
    cipher.setAAD(Buffer.from('kobo-cache-v1:'+id));
    const raw=Buffer.from(JSON.stringify(data),'utf8');
    const sealed=Buffer.concat([cipher.update(raw),cipher.final()]);
    const obj={version:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:sealed.toString('base64')};
    const temp=path.join(folder,`.${id}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`);
    try {
      fs.writeFileSync(temp,JSON.stringify(obj),{encoding:'utf8',mode:0o600,flag:'wx'});
      fs.renameSync(temp,name);
    } finally { if(fs.existsSync(temp))fs.unlinkSync(temp); }
  }
  function load(id) {
    ensureDirectory();
    const name=safeName(id);
    if (!fs.existsSync(name)) return null;
    const st=fs.lstatSync(name);
    if (!st.isFile() || st.isSymbolicLink() || (st.mode & 0o077)!==0)
      throw new Error('Refusing unsafe cache file permissions');
    const obj=JSON.parse(fs.readFileSync(name,'utf8'));
    if (obj.version !== 1) throw new Error('Unsupported cache format');
    const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(obj.iv,'base64'));
    decipher.setAAD(Buffer.from('kobo-cache-v1:'+id));
    decipher.setAuthTag(Buffer.from(obj.tag,'base64'));
    const raw=Buffer.concat([decipher.update(Buffer.from(obj.ciphertext,'base64')),decipher.final()]);
    return JSON.parse(raw.toString('utf8'));
  }
  return {enabled:true, save, load};
}
module.exports={createCache};
