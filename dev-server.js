/* Local dev server: serves ./site on :5500 (the port already allowed in the Google OAuth client)
   and a safe page-fetch proxy at /api/fetch?u=<url>&m=get|head  (same API as worker/proxy.js).
   Run: node dev-server.js */
const http = require('http'), fs = require('fs'), path = require('path'), dns = require('dns').promises, net = require('net');
const ROOT = path.join(__dirname, 'site'), PORT = process.env.PORT || 5500;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.txt': 'text/plain', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml' };

const isPrivateIp = (ip) => {
  if (net.isIPv6(ip)) return ip === '::1' || /^(fc|fd|fe80)/i.test(ip) || /^::ffff:(10|127|169\.254|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(ip);
  const p = ip.split('.').map(Number);
  return p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127);
};
async function checkUrl(u) {
  let x; try { x = new URL(u); } catch { throw new Error('bad url'); }
  if (!/^https?:$/.test(x.protocol)) throw new Error('only http(s)');
  const h = x.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(h)) { if (isPrivateIp(h)) throw new Error('blocked address'); return x; }
  if (!h.includes('.') || /\.(local|internal|localhost)$/i.test(h)) throw new Error('blocked host');
  const addrs = await dns.lookup(h, { all: true }); if (addrs.some((a) => isPrivateIp(a.address))) throw new Error('blocked address');
  return x;
}
async function proxy(u, mode) {
  const t0 = Date.now(); let cur = u, method = mode === 'head' ? 'HEAD' : 'GET', r;
  for (let hop = 0; hop < 6; hop++) {
    const x = await checkUrl(cur);
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 15000);
    try {
      r = await fetch(x, { method, redirect: 'manual', signal: ctl.signal, headers: { 'user-agent': 'Mozilla/5.0 (compatible; WeblyBot/1.0; +https://webly.codelove.in)', accept: 'text/html,application/xhtml+xml,application/xml,*/*' } });
    } finally { clearTimeout(timer); }
    if ([301, 302, 303, 307, 308].includes(r.status) && r.headers.get('location')) { cur = new URL(r.headers.get('location'), cur).href; if (method === 'HEAD' && r.status === 303) method = 'GET'; continue; }
    if (method === 'HEAD' && [400, 403, 405, 501].includes(r.status)) { method = 'GET'; continue; }
    break;
  }
  const ct = r.headers.get('content-type') || '';
  let text = '', size = 0;
  if (mode !== 'head' && /text|json|xml|javascript/i.test(ct)) {
    const buf = Buffer.from(await r.arrayBuffer()); size = buf.length; text = buf.subarray(0, 2e6).toString('utf8');
  } else { try { await r.body?.cancel(); } catch {} }
  return { ok: r.status >= 200 && r.status < 300, status: r.status, url: cur, ms: Date.now() - t0, size, ct, text };
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/fetch') {
    res.setHeader('content-type', 'application/json'); res.setHeader('access-control-allow-origin', '*');
    try { res.end(JSON.stringify(await proxy(url.searchParams.get('u') || '', url.searchParams.get('m') || 'get'))); }
    catch (e) { res.end(JSON.stringify({ ok: false, status: 0, url: url.searchParams.get('u'), ms: 0, size: 0, text: '', error: e.name === 'AbortError' ? 'timeout' : e.cause?.code || e.message })); }
    return;
  }
  // Every page (/dashboard, /tools/..., /sites/) is the same single page app; scripts/build-pages.js writes a copy
  // per URL for GitHub Pages. Locally, any path without a file extension that has no file serves index.html.
  let f = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!f.startsWith(ROOT)) { res.statusCode = 403; return res.end(); }
  if (!path.extname(url.pathname) && !fs.existsSync(path.join(f, 'index.html')) && !fs.existsSync(f)) f = path.join(ROOT, 'index.html');
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.statusCode = 404; return res.end('Not found'); }
  res.setHeader('content-type', MIME[path.extname(f)] || 'application/octet-stream'); res.setHeader('cache-control', 'no-store');
  fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log('Webly dev server: http://localhost:' + PORT));
