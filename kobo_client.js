/** Kobo API v2 read-only client: bounded pagination, same-origin validation, retry and pacing. */
'use strict';
const { URL } = require('node:url');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function intSetting(value, defaultValue, min, max) {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : defaultValue;
}
function createClient(opts = {}) {
  const base = new URL(opts.base || 'https://kpi.esmis.moe.go.tz');
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
    throw new Error('KOBO_BASE_URL must be an HTTPS origin without credentials or a path');
  }
  const pageSize = intSetting(opts.pageSize, 100, 1, 500);
  const delayMs = intSetting(opts.delayMs, 1250, 0, 60000);
  const timeoutMs = intSetting(opts.timeoutMs, 30000, 1000, 120000);
  const retries = intSetting(opts.retries, 2, 0, 5);
  const max = intSetting(opts.max, 10000, 1, 100000);
  const requestFetch = opts.fetchImpl || fetch;
  const wait = opts.sleepImpl || sleep;
  let lastRequest = 0;

  function pathFor(uid) {
    if (!/^[A-Za-z0-9_-]{5,80}$/.test(uid)) throw new Error('Invalid Kobo asset UID');
    return `/api/v2/assets/${uid}/data/`;
  }
  function validUrl(url, expectedPath) {
    if (url.origin !== base.origin || url.pathname !== expectedPath || url.username || url.password || url.hash)
      throw new Error('Kobo pagination URL rejected (unexpected origin or path)');
    return url;
  }
  async function request(url, token) {
    if (!token) throw new Error('Kobo read-only API token is missing');
    for (let attempt = 0; attempt <= retries; attempt++) {
      const elapsed = Date.now() - lastRequest;
      if (delayMs > elapsed && lastRequest > 0) await wait(delayMs - elapsed);
      lastRequest = Date.now();
      let res;
      try {
        res = await requestFetch(url, {
          method: 'GET',
          headers: { Authorization: `Token ${token}`, Accept: 'application/json' },
          signal: AbortSignal.timeout(timeoutMs),
          redirect: 'error',
        });
      } catch (err) {
        if (attempt === retries) throw new Error(`Kobo network failure: ${err?.name || 'request failed'}`);
        await wait(Math.min(10000, 1000 * (2 ** attempt)));
        continue;
      }
      if (res.ok) {
        try { return await res.json(); }
        catch { throw new Error('Kobo returned invalid JSON'); }
      }
      const status = Number(res.status);
      if ((status === 429 || (status >= 500 && status <= 599)) && attempt < retries) {
        const retryHeader = Number(res.headers?.get?.('retry-after'));
        const waitMs = Number.isFinite(retryHeader) && retryHeader > 0
          ? Math.min(60000, retryHeader * 1000)
          : Math.min(10000, 1000 * (2 ** attempt));
        await wait(waitMs);
        continue;
      }
      throw new Error(`Kobo API returned HTTP ${status}`);
    }
    throw new Error('Kobo retry limit reached');
  }
  async function fetchAll(uid, token) {
    const exactPath = pathFor(uid);
    let next = new URL(exactPath + `?limit=${pageSize}`, base);
    const visited = new Set();
    const items = [];
    let page = 0;
    while (next) {
      validUrl(next, exactPath);
      if (visited.has(next.href)) throw new Error('Kobo pagination loop detected');
      visited.add(next.href);
      const body = await request(next, token);
      if (!body || !Array.isArray(body.results)) throw new Error('Kobo results array missing');
      items.push(...body.results);
      if (items.length > max) throw new Error(`MAX_SUBMISSIONS exceeded: ${max}; no truncated analytics published`);
      if (++page > max + 1) throw new Error('Unexpected Kobo pagination length');
      next = body.next ? new URL(body.next, base) : null;
    }
    return items;
  }
  async function metadata(uid, token) {
    const exactPath = `/api/v2/assets/${uid}/`;
    if (!/^[A-Za-z0-9_-]{5,80}$/.test(uid)) throw new Error('Invalid Kobo asset UID');
    return request(validUrl(new URL(exactPath, base), exactPath), token);
  }
  return { fetchAll, metadata, validUrl, pathFor };
}
module.exports = { createClient, intSetting };
