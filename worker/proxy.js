/* Cloudflare Worker: the page-fetch proxy for production (browsers cannot read other websites because of CORS).
   Deploy:  cd worker && npx wrangler deploy      (free plan: 100k requests/day)
   Then put the worker URL in site/config.js -> proxy.  Same API as dev-server.js:
     GET /?u=<url>&m=get|head  ->  { ok, status, url, ms, size, ct, text } */
const ALLOWED_ORIGINS = ['https://webly.codelove.in', 'http://localhost:5500']; // change when the final name is chosen

const blockedHost = (h) => {
  h = h.replace(/^\[|\]$/g, '').toLowerCase();
  if (!h.includes('.') && !h.includes(':')) return true;
  if (/\.(local|internal|localhost)$/.test(h)) return true;
  if (/^(10|127|0)\./.test(h) || /^169\.254\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  return h === '::1' || /^(fc|fd|fe80)/.test(h);
};

async function run(u, mode) {
  const t0 = Date.now(); let cur = u, method = mode === 'head' ? 'HEAD' : 'GET', r;
  for (let hop = 0; hop < 6; hop++) {
    const x = new URL(cur);
    if (!/^https?:$/.test(x.protocol) || blockedHost(x.hostname)) throw new Error('blocked');
    r = await fetch(x, { method, redirect: 'manual', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'Mozilla/5.0 (compatible; WeblyBot/1.0; +https://webly.codelove.in)' } });
    if ([301, 302, 303, 307, 308].includes(r.status) && r.headers.get('location')) { cur = new URL(r.headers.get('location'), cur).href; if (method === 'HEAD' && r.status === 303) method = 'GET'; continue; }
    if (method === 'HEAD' && [400, 403, 405, 501].includes(r.status)) { method = 'GET'; continue; }
    break;
  }
  const ct = r.headers.get('content-type') || '';
  let text = '', size = 0;
  if (mode !== 'head' && /text|json|xml|javascript/i.test(ct)) { const b = await r.arrayBuffer(); size = b.byteLength; text = new TextDecoder().decode(b.slice(0, 2e6)); }
  else { try { await r.body?.cancel(); } catch {} }
  return { ok: r.status >= 200 && r.status < 300, status: r.status, url: cur, ms: Date.now() - t0, size, ct, text };
}

export default {
  async fetch(req) {
    const origin = req.headers.get('origin') || '';
    const cors = { 'access-control-allow-origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0], 'content-type': 'application/json', vary: 'origin' };
    if (req.method === 'OPTIONS') return new Response(null, { headers: { ...cors, 'access-control-allow-methods': 'GET' } });
    if (origin && !ALLOWED_ORIGINS.includes(origin)) return new Response('{"error":"origin not allowed"}', { status: 403, headers: cors });
    const q = new URL(req.url).searchParams, u = q.get('u') || '';
    try { return new Response(JSON.stringify(await run(u, q.get('m') || 'get')), { headers: cors }); }
    catch (e) { return new Response(JSON.stringify({ ok: false, status: 0, url: u, ms: 0, size: 0, text: '', error: e.name === 'TimeoutError' ? 'timeout' : e.message }), { headers: cors }); }
  },
};
