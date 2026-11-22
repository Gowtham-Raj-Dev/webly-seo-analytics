/* Google data layer: OAuth token per source (Google Identity Services), then Analytics, Search Console, AdSense.
   Everything is read-only and runs in the visitor's browser with THEIR Google account. */
(() => {
  'use strict';
  const CFG = window.PULSE_CONFIG || {};
  const SCOPE = { ga: 'https://www.googleapis.com/auth/analytics.readonly', gsc: 'https://www.googleapis.com/auth/webmasters.readonly', ads: 'https://www.googleapis.com/auth/adsense.readonly' };
  const NAME = { ga: 'Google Analytics', gsc: 'Search Console', ads: 'AdSense' };
  const ENABLE = { ga: ['analyticsdata.googleapis.com', 'analyticsadmin.googleapis.com'], gsc: ['searchconsole.googleapis.com'], ads: ['adsense.googleapis.com'] };
  const TK = 'pulse_tok';
  let T = {}; try { T = JSON.parse(localStorage.getItem(TK) || '{}'); } catch { /* ignore */ }
  const saveT = () => { try { localStorage.setItem(TK, JSON.stringify(T)); } catch { /* ignore */ } };
  class NeedAuth extends Error { constructor(src) { super(`${NAME[src]} needs to be connected again.`); this.src = src; this.need = true; } }
  const tok = (s) => (T[s] && T[s].exp > Date.now() + 30e3 ? T[s].access : null);

  let gisP = null;
  const gis = () => gisP || (gisP = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.onload = res; s.onerror = () => rej(new Error('Could not load Google sign-in (offline?)')); document.head.appendChild(s); }));
  /** Must run inside a click. Opens Google's consent popup for one source. */
  async function connect(src) {
    await gis();
    return new Promise((resolve, reject) => {
      const c = google.accounts.oauth2.initTokenClient({
        client_id: CFG.clientId, scope: SCOPE[src], include_granted_scopes: true,
        callback: (r) => { if (r.error) return reject(new Error(r.error === 'access_denied' ? 'Permission was not given.' : r.error_description || r.error)); T[src] = { access: r.access_token, exp: Date.now() + (r.expires_in || 3600) * 1e3 }; saveT(); resolve(); },
        error_callback: (e) => reject(new Error(e.type === 'popup_closed' ? 'The Google window was closed.' : e.message || 'Google sign-in failed')),
      });
      c.requestAccessToken({ prompt: T[src] ? '' : 'consent' });
    });
  }
  const forget = (src) => { delete T[src]; saveT(); cache.clear(); };

  const cache = new Map();
  const memo = (k, fn) => { if (!cache.has(k)) cache.set(k, fn().catch((e) => { cache.delete(k); throw e; })); return cache.get(k); };
  async function api(src, url, body, method) {
    const t = tok(src); if (!t) throw new NeedAuth(src);
    const r = await fetch(url, { method: method || (body ? 'POST' : 'GET'), headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 401) { delete T[src]; saveT(); throw new NeedAuth(src); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const m = (j.error && j.error.message) || `HTTP ${r.status}`, e = new Error(m);
      if (r.status === 403 && /has not been used|is disabled|accessNotConfigured|SERVICE_DISABLED/i.test(JSON.stringify(j))) { e.enable = ENABLE[src]; e.message = `${NAME[src]} API is not enabled in the Google Cloud project yet.`; }
      throw e;
    }
    return j;
  }

  /* ---------- dates ---------- */
  const iso = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 10); };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  function window2(range) { // previous period then current period, oldest first
    const end = new Date(), days = [];
    for (let i = range * 2 - 1; i >= 0; i--) days.push(iso(addDays(end, -i)));
    return { days, start: days[0], mid: days[range], end: days[days.length - 1], curStart: days[range], prevEnd: days[range - 1] };
  }

  /* ---------- Analytics ---------- */
  const DATA = 'https://analyticsdata.googleapis.com/v1beta', ADMIN = 'https://analyticsadmin.googleapis.com/v1beta';
  const gaProps = () => memo('gaprops', async () => {
    const out = []; let pt = '';
    do { const j = await api('ga', `${ADMIN}/accountSummaries?pageSize=200${pt ? '&pageToken=' + pt : ''}`); for (const a of j.accountSummaries || []) for (const p of a.propertySummaries || []) out.push({ id: p.property, name: p.displayName }); pt = j.nextPageToken || ''; } while (pt);
    return out;
  });
  const gaReport = (prop, body) => memo('gr|' + prop + JSON.stringify(body), () => api('ga', `${DATA}/${prop}:runReport`, { limit: 100000, ...body }).then((j) => (j.rows || []).map((r) => ({ d: r.dimensionValues.map((v) => v.value), m: r.metricValues.map((v) => Number(v.value)) }))));
  const okHost = (h) => h && h !== '(not set)' && h !== 'localhost' && !/^\d+\.\d+\.\d+\.\d+$/.test(h);

  /* ---------- Search Console ---------- */
  const GSC = 'https://www.googleapis.com/webmasters/v3';
  const gscProps = () => memo('gscprops', async () => {
    const j = await api('gsc', `${GSC}/sites`);
    return (j.siteEntry || []).filter((s) => s.permissionLevel !== 'siteUnverifiedUser').map((s) => ({ url: s.siteUrl, domain: s.siteUrl.startsWith('sc-domain:'), host: s.siteUrl.startsWith('sc-domain:') ? s.siteUrl.slice(10) : (() => { try { return new URL(s.siteUrl).hostname; } catch { return s.siteUrl; } })() }));
  });
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function propFor(host, props) {
    const exact = props.find((p) => !p.domain && p.host.replace(/^www\./, '') === host);
    if (exact) return { prop: exact };
    const dom = props.filter((p) => p.domain && (host === p.host || host.endsWith('.' + p.host))).sort((a, b) => b.host.length - a.host.length)[0];
    return dom ? { prop: dom, filter: `^https?://(www\\.)?${reEsc(host)}(/|:|$)` } : null;
  }
  const gscQuery = (m, body) => memo('gq|' + m.prop.url + JSON.stringify(body), async () => {
    const b = { rowLimit: 25000, ...body }; if (m.filter) b.dimensionFilterGroups = [{ filters: [{ dimension: 'page', operator: 'includingRegex', expression: m.filter }] }];
    const j = await api('gsc', `${GSC}/sites/${encodeURIComponent(m.prop.url)}/searchAnalytics/query`, b);
    return j.rows || [];
  });

  /* ---------- AdSense ---------- */
  const ADS = 'https://adsense.googleapis.com/v2';
  const adsAccount = () => memo('adsacc', async () => { const j = await api('ads', `${ADS}/accounts`); const a = (j.accounts || [])[0]; if (!a) throw new Error('No AdSense account found for this Google login.'); return a; });
  async function adsReport(acc, start, end, dims, metrics) {
    const dp = (k, s) => { const [y, m, d] = s.split('-').map(Number); return `${k}.year=${y}&${k}.month=${m}&${k}.day=${d}`; };
    const q = ['dateRange=CUSTOM', dp('startDate', start), dp('endDate', end), ...dims.map((d) => 'dimensions=' + d), ...metrics.map((m) => 'metrics=' + m), 'reportingTimeZone=ACCOUNT_TIME_ZONE'].join('&');
    const j = await memo('ar|' + acc.name + q, () => api('ads', `${ADS}/${acc.name}/reports:generate?${q}`));
    return (j.rows || []).map((r) => r.cells.map((c) => c.value));
  }
  const adsList = (acc, what) => memo('al|' + acc.name + what, () => api('ads', `${ADS}/${acc.name}/${what}`).then((j) => j[what] || []).catch(() => []));

  /* ---------- registry + series ---------- */
  const R = { range: 0, win: null, sites: [], ser: {}, errors: [], ads: null, loaded: false };
  const key = (m, h) => (R.ser[m] = R.ser[m] || {}, R.ser[m][h] = R.ser[m][h] || new Array(R.win.days.length).fill(0));
  const hostMatch = (h, hosts) => (hosts.has(h) ? h : [...hosts].find((x) => h.endsWith('.' + x) || x.endsWith('.' + h)) || null);

  /** Loads daily series for the previous + current period for every connected source. */
  async function load(conn, range) {
    R.range = range; R.win = window2(range); R.ser = {}; R.errors = []; R.ads = null; R.gscMap = {}; R.gaProp = {};
    const idx = new Map(R.win.days.map((d, i) => [d, i])), hosts = new Set();
    const tasks = [];
    if (conn.ga && tok('ga')) tasks.push((async () => {
      for (const p of await gaProps()) {
        try {
          const rows = await gaReport(p.id, { dateRanges: [{ startDate: R.win.start, endDate: R.win.end }], dimensions: [{ name: 'date' }, { name: 'hostName' }], metrics: ['activeUsers', 'sessions', 'screenPageViews', 'userEngagementDuration', 'engagedSessions'].map((name) => ({ name })) });
          for (const r of rows) {
            const h = r.d[1].replace(/^www\./, ''); if (!okHost(h)) continue; const i = idx.get(`${r.d[0].slice(0, 4)}-${r.d[0].slice(4, 6)}-${r.d[0].slice(6)}`); if (i == null) continue;
            hosts.add(h); [['users', 0], ['sessions', 1], ['views', 2], ['sec', 3], ['eng', 4]].forEach(([k, n]) => { key(k, h)[i] += r.m[n]; });
            R.gaProp = R.gaProp || {}; R.gaProp[h] = p.id;
          }
        } catch (e) { R.errors.push(e); }
      }
    })().catch((e) => R.errors.push(e)));
    if (conn.gsc && tok('gsc')) tasks.push((async () => { for (const p of await gscProps()) if (!p.domain) hosts.add(p.host.replace(/^www\./, '')); else hosts.add(p.host); })().catch((e) => R.errors.push(e)));
    if (conn.ads && tok('ads')) tasks.push((async () => {
      const acc = await adsAccount(); R.ads = { acc };
      const rows = await adsReport(acc, R.win.start, R.win.end, ['DATE', 'DOMAIN_NAME'], ['ESTIMATED_EARNINGS', 'IMPRESSIONS', 'CLICKS', 'PAGE_VIEWS']);
      R.ads.raw = rows;
    })().catch((e) => R.errors.push(e)));
    await Promise.all(tasks);
    // AdSense domains
    if (R.ads && R.ads.raw) for (const r of R.ads.raw) { const h = r[1].replace(/^www\./, ''); if (okHost(h)) { const t = hostMatch(h, hosts) || h; hosts.add(t); const i = idx.get(r[0]); if (i != null) { key('rev', t)[i] += +r[2] || 0; key('adimp', t)[i] += +r[3] || 0; key('adclk', t)[i] += +r[4] || 0; key('adpv', t)[i] += +r[5] || 0; } } }
    // Search Console series per site
    if (conn.gsc && tok('gsc')) {
      const props = await gscProps().catch(() => []);
      await Promise.all([...hosts].map(async (h) => {
        const m = propFor(h, props); if (!m) return; R.gscMap[h] = m;
        try { const rows = await gscQuery(m, { startDate: R.win.start, endDate: R.win.end, dimensions: ['date'] }); for (const r of rows) { const i = idx.get(r.keys[0]); if (i == null) continue; key('clicks', h)[i] += r.clicks; key('impr', h)[i] += r.impressions; key('posw', h)[i] += r.position * r.impressions; } } catch (e) { R.errors.push(e); }
      }));
    }
    R.sites = [...hosts].sort().map((d) => ({ d, ga: !!(R.gaProp && R.gaProp[d]), gsc: !!R.gscMap[d], ads: !!(R.ser.rev && R.ser.rev[d]) }));
    R.loaded = true; return R;
  }

  /* ---------- extra breakdowns (cached, called by the views) ---------- */
  async function gaBreakdown(dim, hosts, metric = 'activeUsers', extraDim) {
    const props = new Map(); hosts.forEach((h) => { const p = R.gaProp && R.gaProp[h]; if (p) { if (!props.has(p)) props.set(p, []); props.get(p).push(h); } });
    const agg = new Map();
    await Promise.all([...props].map(async ([pid, hs]) => {
      const rows = await gaReport(pid, { dateRanges: [{ startDate: R.win.mid, endDate: R.win.end }], dimensions: [{ name: dim }, ...(extraDim ? [{ name: extraDim }] : [])], metrics: [{ name: metric }], dimensionFilter: { filter: { fieldName: 'hostName', inListFilter: { values: [...hs, ...hs.map((h) => 'www.' + h)] } } }, orderBys: [{ metric: { metricName: metric }, desc: true }], limit: 30 });
      for (const r of rows) { const k = r.d.join('\u0001'); agg.set(k, (agg.get(k) || 0) + r.m[0]); }
    }));
    return [...agg].map(([k, v]) => ({ k: k.split('\u0001'), v })).sort((a, b) => b.v - a.v).slice(0, 12);
  }
  async function gaRealtime() {
    let total = 0; const pages = new Map();
    for (const p of await gaProps()) {
      const j = await api('ga', `${DATA}/${p.id}:runRealtimeReport`, { metrics: [{ name: 'activeUsers' }], dimensions: [{ name: 'unifiedScreenName' }], limit: 10 }).catch(() => null);
      if (!j) continue; for (const r of j.rows || []) { const n = +r.metricValues[0].value; total += n; pages.set(r.dimensionValues[0].value, (pages.get(r.dimensionValues[0].value) || 0) + n); }
    }
    return { total, pages: [...pages].sort((a, b) => b[1] - a[1]).slice(0, 4) };
  }
  async function keywords(host, dim = 'query') {
    const m = R.gscMap && R.gscMap[host]; if (!m) { if (!tok('gsc')) throw new NeedAuth('gsc'); throw new Error(`${host} is not a Search Console property of this Google account.`); }
    const [cur, prev] = await Promise.all([gscQuery(m, { startDate: R.win.curStart, endDate: R.win.end, dimensions: [dim], rowLimit: 200 }), gscQuery(m, { startDate: R.win.start, endDate: R.win.prevEnd, dimensions: [dim], rowLimit: 1000 })]);
    const pv = new Map(prev.map((r) => [r.keys[0], r.position]));
    return cur.sort((a, b) => b.impressions - a.impressions).slice(0, 100).map((r) => ({ q: r.keys[0], clicks: r.clicks, impr: r.impressions, pos: r.position, prev: pv.get(r.keys[0]) || 0, ctr: r.ctr }));
  }
  async function sitemaps(host) {
    const m = R.gscMap && R.gscMap[host]; if (!m) return [];
    const j = await api('gsc', `${GSC}/sites/${encodeURIComponent(m.prop.url)}/sitemaps`).catch(() => ({}));
    return (j.sitemap || []).map((s) => ({ path: s.path, last: s.lastDownloaded, errors: +s.errors || 0, warnings: +s.warnings || 0, pending: s.isPending, submitted: (s.contents || []).reduce((a, c) => a + (+c.submitted || 0), 0) }));
  }
  async function adsExtras() {
    if (!R.ads) return { sites: [], unpaid: null };
    const [sites, pays] = await Promise.all([adsList(R.ads.acc, 'sites'), adsList(R.ads.acc, 'payments')]);
    const un = pays.find((p) => /\/unpaid$/.test(p.name));
    return { sites, unpaid: un ? parseFloat(String(un.amount || '0').replace(/[^0-9.]/g, '')) : null, currency: un && un.amount ? String(un.amount).replace(/[0-9.,\s]/g, '') : '$' };
  }

  window.PX = { NAME, SCOPE, connect, forget, has: (s) => !!tok(s), R, load, gaBreakdown, gaRealtime, keywords, sitemaps, adsExtras, NeedAuth, clear: () => cache.clear() };
})();
