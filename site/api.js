/* Google data layer: OAuth token per source (Google Identity Services), then Analytics, Search Console, AdSense.
   Everything is read-only and runs in the visitor's browser with THEIR Google account.
   A "window" W (built in app.js) describes the time range: W.keys (primary, hourly for today/yesterday else daily),
   W.dkeys (always daily), N = chart points per period, n = points of the chosen range. Series arrays hold 2N values. */
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
      const e = new Error((j.error && j.error.message) || `HTTP ${r.status}`);
      if (r.status === 403 && /has not been used|is disabled|accessNotConfigured|SERVICE_DISABLED/i.test(JSON.stringify(j))) { e.enable = ENABLE[src]; e.message = `${NAME[src]} API is not enabled in the Google Cloud project yet.`; }
      throw e;
    }
    return j;
  }
  const sum = (a) => a.reduce((x, y) => x + y, 0);

  /* ---------- Analytics ---------- */
  const DATA = 'https://analyticsdata.googleapis.com/v1beta', ADMIN = 'https://analyticsadmin.googleapis.com/v1beta';
  const gaProps = () => memo('gaprops', async () => {
    const out = []; let pt = '';
    do { const j = await api('ga', `${ADMIN}/accountSummaries?pageSize=200${pt ? '&pageToken=' + pt : ''}`); for (const a of j.accountSummaries || []) for (const p of a.propertySummaries || []) out.push({ id: p.property, name: p.displayName }); pt = j.nextPageToken || ''; } while (pt);
    return out;
  });
  const gaReport = (prop, body) => memo('gr|' + prop + JSON.stringify(body), () => api('ga', `${DATA}/${prop}:runReport`, { limit: 100000, ...body }).then((j) => (j.rows || []).map((r) => ({ d: r.dimensionValues.map((v) => v.value), m: r.metricValues.map((v) => Number(v.value)) }))));
  const okHost = (h) => h && h !== '(not set)' && h !== 'localhost' && !/^\d+\.\d+\.\d+\.\d+$/.test(h);
  const gaKey = (s, hourly) => (hourly ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)} ${s.slice(8, 10)}` : `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}`);
  const GA_M = ['activeUsers', 'sessions', 'screenPageViews', 'userEngagementDuration', 'engagedSessions', 'newUsers'];
  const GA_S = ['users', 'sessions', 'views', 'sec', 'eng', 'newu'];

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
    const b = { rowLimit: 25000, ...body }; if (m.filter) b.dimensionFilterGroups = [{ filters: [{ dimension: 'page', operator: 'includingRegex', expression: m.filter }, ...((body.dimensionFilterGroups && body.dimensionFilterGroups[0] && body.dimensionFilterGroups[0].filters) || [])] }];
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
  const ADS_M = ['ESTIMATED_EARNINGS', 'PAGE_VIEWS', 'IMPRESSIONS', 'CLICKS'];

  /* ---------- registry + series ---------- */
  const R = { win: null, sites: [], ser: {}, dser: {}, errors: [], ads: null, loaded: false, gaProp: {}, gscMap: {} };
  const put = (store, len, key, host, i, v) => { const s = store[key] = store[key] || {}; (s[host] = s[host] || new Array(len).fill(0))[i] += v; };
  const hostMatch = (h, hosts) => (hosts.has(h) ? h : [...hosts].find((x) => h.endsWith('.' + x) || x.endsWith('.' + h)) || null);

  /** Loads series for the previous + current period for every connected source. */
  async function load(conn, W) {
    R.win = W; R.ser = {}; R.dser = {}; R.errors = []; R.ads = null; R.gscMap = {}; R.gaProp = {};
    const idx = new Map(W.keys.map((k, i) => [k, i])), didx = new Map(W.dkeys.map((k, i) => [k, i])), hosts = new Set(), tasks = [];
    if (conn.ga && tok('ga')) tasks.push((async () => {
      for (const p of await gaProps()) {
        try {
          const rows = await gaReport(p.id, { dateRanges: [{ startDate: W.start, endDate: W.end }], dimensions: [{ name: W.hourly ? 'dateHour' : 'date' }, { name: 'hostName' }], metrics: GA_M.map((name) => ({ name })) });
          for (const r of rows) {
            const h = r.d[1].replace(/^www\./, ''); if (!okHost(h)) continue; const i = idx.get(gaKey(r.d[0], W.hourly)); if (i == null) continue;
            hosts.add(h); GA_S.forEach((k, n) => put(R.ser, W.keys.length, k, h, i, r.m[n])); R.gaProp[h] = p.id;
          }
        } catch (e) { R.errors.push(e); }
      }
    })().catch((e) => R.errors.push(e)));
    if (conn.gsc && tok('gsc')) tasks.push((async () => { for (const p of await gscProps()) hosts.add(p.domain ? p.host : p.host.replace(/^www\./, '')); })().catch((e) => R.errors.push(e)));
    if (conn.ads && tok('ads')) tasks.push((async () => { const acc = await adsAccount(); R.ads = { acc }; R.ads.raw = await adsReport(acc, W.dkeys[0], W.dkeys[W.dkeys.length - 1], ['DATE', 'DOMAIN_NAME'], ADS_M); })().catch((e) => R.errors.push(e)));
    await Promise.all(tasks);
    const dl = W.dkeys.length;
    if (R.ads && R.ads.raw) for (const r of R.ads.raw) { const h = r[1].replace(/^www\./, ''); if (!okHost(h)) continue; const t = hostMatch(h, hosts) || h; hosts.add(t); const i = didx.get(r[0]); if (i == null) continue; put(R.dser, dl, 'rev', t, i, +r[2] || 0); put(R.dser, dl, 'adpv', t, i, +r[3] || 0); put(R.dser, dl, 'adimp', t, i, +r[4] || 0); put(R.dser, dl, 'adclk', t, i, +r[5] || 0); }
    if (conn.gsc && tok('gsc')) {
      const props = await gscProps().catch(() => []);
      await Promise.all([...hosts].map(async (h) => {
        const m = propFor(h, props); if (!m) return; R.gscMap[h] = m;
        try { const rows = await gscQuery(m, { startDate: W.dkeys[0], endDate: W.dkeys[dl - 1], dimensions: ['date'] }); for (const r of rows) { const i = didx.get(r.keys[0]); if (i == null) continue; put(R.dser, dl, 'clicks', h, i, r.clicks); put(R.dser, dl, 'impr', h, i, r.impressions); put(R.dser, dl, 'posw', h, i, r.position * r.impressions); } } catch (e) { R.errors.push(e); }
      }));
    }
    R.sites = [...hosts].sort().map((d) => ({ d, ga: !!R.gaProp[d], gsc: !!R.gscMap[d], ads: !!(R.dser.rev && R.dser.rev[d]) }));
    R.loaded = true; return R;
  }

  /* ---------- Analytics tables (current + previous period) ---------- */
  const mergeRows = (lists) => { const m = new Map(); for (const rows of lists) for (const r of rows) { const k = r.d.join('\u0001'); const x = m.get(k); if (x) r.m.forEach((v, i) => { x.m[i] += v; }); else m.set(k, { d: r.d, m: r.m.slice() }); } return [...m.values()]; };
  async function gaTable(hosts, dims, metrics, start, end, limit = 300) {
    const byProp = new Map(); hosts.forEach((h) => { const p = R.gaProp[h]; if (p) { if (!byProp.has(p)) byProp.set(p, []); byProp.get(p).push(h); } });
    const lists = await Promise.all([...byProp].map(([pid, hs]) => gaReport(pid, { dateRanges: [{ startDate: start, endDate: end }], dimensions: dims.map((name) => ({ name })), metrics: metrics.map((name) => ({ name })), dimensionFilter: { filter: { fieldName: 'hostName', inListFilter: { values: [...hs, ...hs.map((h) => 'www.' + h)] } } }, orderBys: [{ metric: { metricName: metrics[0] }, desc: true }], limit })));
    return mergeRows(lists).sort((a, b) => b.m[0] - a.m[0]).slice(0, limit);
  }
  async function gaCompare(hosts, dims, metrics, rng, compare, limit) {
    const [cur, prev] = await Promise.all([gaTable(hosts, dims, metrics, rng.start, rng.end, limit), compare ? gaTable(hosts, dims, metrics, rng.prevStart, rng.prevEnd, 1000) : []]);
    const pm = new Map(prev.map((r) => [r.d.join('\u0001'), r.m]));
    return cur.map((r) => ({ d: r.d, m: r.m, p: compare ? (pm.get(r.d.join('\u0001')) || metrics.map(() => 0)) : null }));
  }
  async function gaRealtime() {
    const props = await gaProps(), out = { total: 0, pages: new Map(), countries: new Map(), devices: new Map(), minutes: new Array(30).fill(0) };
    const rt = (p, dims) => api('ga', `${DATA}/${p.id}:runRealtimeReport`, { metrics: [{ name: 'activeUsers' }], dimensions: dims.map((name) => ({ name })), limit: 30 }).then((j) => j.rows || []).catch(() => []);
    for (const p of props) {
      const [pg, ct, dv, mn] = await Promise.all([rt(p, ['unifiedScreenName']), rt(p, ['country']), rt(p, ['deviceCategory']), rt(p, ['minutesAgo'])]);
      const add = (map, rows) => rows.forEach((r) => map.set(r.dimensionValues[0].value, (map.get(r.dimensionValues[0].value) || 0) + Number(r.metricValues[0].value)));
      add(out.pages, pg); add(out.countries, ct); add(out.devices, dv); out.total += sum(dv.map((r) => Number(r.metricValues[0].value)));
      mn.forEach((r) => { const a = Number(r.dimensionValues[0].value); if (a >= 0 && a < 30) out.minutes[29 - a] += Number(r.metricValues[0].value); });
    }
    const top = (m) => [...m].sort((a, b) => b[1] - a[1]).slice(0, 10);
    return { total: out.total, pages: top(out.pages), countries: top(out.countries), devices: top(out.devices), minutes: out.minutes };
  }

  /* ---------- Search Console tables ---------- */
  const mergeGsc = (lists) => { const m = new Map(); for (const rows of lists) for (const r of rows) { const k = r.keys.join('\u0001'), x = m.get(k); if (x) { x.clicks += r.clicks; x.impr += r.impressions; x.pw += r.position * r.impressions; } else m.set(k, { d: r.keys, clicks: r.clicks, impr: r.impressions, pw: r.position * r.impressions }); } return [...m.values()].map((x) => ({ d: x.d, clicks: x.clicks, impr: x.impr, ctr: x.impr ? x.clicks / x.impr : 0, pos: x.impr ? x.pw / x.impr : 0 })); };
  async function gscTable(hosts, dims, start, end, limit = 500, filters) {
    const lists = await Promise.all(hosts.map((h) => { const m = R.gscMap[h]; if (!m) return []; const b = { startDate: start, endDate: end, dimensions: dims, rowLimit: limit }; if (filters) b.dimensionFilterGroups = [{ filters }]; return gscQuery(m, b).catch((e) => { R.errors.push(e); return []; }); }));
    return mergeGsc(lists).sort((a, b) => b.clicks - a.clicks || b.impr - a.impr).slice(0, limit);
  }
  async function gscCompare(hosts, dims, rng, compare, limit, filters) {
    const [cur, prev] = await Promise.all([gscTable(hosts, dims, rng.start, rng.end, limit, filters), compare ? gscTable(hosts, dims, rng.prevStart, rng.prevEnd, 2000, filters) : []]);
    const pm = new Map(prev.map((r) => [r.d.join('\u0001'), r]));
    return cur.map((r) => ({ ...r, p: compare ? (pm.get(r.d.join('\u0001')) || { clicks: 0, impr: 0, pos: 0, ctr: 0 }) : null }));
  }
  const keywords = async (host) => {
    const m = R.gscMap[host]; if (!m) { if (!tok('gsc')) throw new NeedAuth('gsc'); throw new Error(`${host} is not a Search Console property of this Google account.`); }
    const W = R.win, [cur, prev] = await Promise.all([gscTable([host], ['query'], W.dkeys[W.dkeys.length - W.dn], W.dkeys[W.dkeys.length - 1], 200), gscTable([host], ['query'], W.dkeys[0], W.dkeys[W.dkeys.length - W.dn - 1] || W.dkeys[0], 1000)]);
    const pv = new Map(prev.map((r) => [r.d[0], r.pos]));
    return cur.sort((a, b) => b.impr - a.impr).slice(0, 100).map((r) => ({ q: r.d[0], clicks: r.clicks, impr: r.impr, pos: r.pos, prev: pv.get(r.d[0]) || 0, ctr: r.ctr }));
  };
  async function sitemaps(host) {
    const m = R.gscMap[host]; if (!m) return [];
    const j = await api('gsc', `${GSC}/sites/${encodeURIComponent(m.prop.url)}/sitemaps`).catch(() => ({}));
    return (j.sitemap || []).map((s) => ({ path: s.path, last: s.lastDownloaded, errors: +s.errors || 0, warnings: +s.warnings || 0, pending: s.isPending, submitted: sum((s.contents || []).map((c) => +c.submitted || 0)) }));
  }
  async function inspect(host, url) {
    const m = R.gscMap[host]; if (!m) throw new Error('Not a Search Console property');
    const j = await api('gsc', 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', { inspectionUrl: url, siteUrl: m.prop.url });
    return j.inspectionResult || {};
  }

  /* ---------- AdSense tables ---------- */
  async function adsTable(dims, start, end) {
    if (!R.ads) return [];
    const rows = await adsReport(R.ads.acc, start, end, dims, ADS_M), k = dims.length;
    return rows.map((r) => ({ d: r.slice(0, k), e: +r[k] || 0, pv: +r[k + 1] || 0, imp: +r[k + 2] || 0, clk: +r[k + 3] || 0 })).sort((a, b) => b.e - a.e);
  }
  async function adsCompare(dims, rng, compare) {
    const [cur, prev] = await Promise.all([adsTable(dims, rng.start, rng.end), compare ? adsTable(dims, rng.prevStart, rng.prevEnd) : []]);
    const pm = new Map(prev.map((r) => [r.d.join('\u0001'), r]));
    return cur.map((r) => ({ ...r, p: compare ? (pm.get(r.d.join('\u0001')) || { e: 0, pv: 0, imp: 0, clk: 0 }) : null }));
  }
  async function adsExtras() {
    if (!R.ads) return { sites: [], unpaid: null, payments: [], alerts: [] };
    const [sites, pays, alerts] = await Promise.all([adsList(R.ads.acc, 'sites'), adsList(R.ads.acc, 'payments'), adsList(R.ads.acc, 'alerts')]);
    const un = pays.find((p) => /\/unpaid$/.test(p.name));
    return { sites, alerts, payments: pays.filter((p) => !/\/unpaid$/.test(p.name)), unpaid: un ? parseFloat(String(un.amount || '0').replace(/[^0-9.]/g, '')) : null, currency: un && un.amount ? String(un.amount).replace(/[0-9.,\s]/g, '') : '$', account: R.ads.acc };
  }

  window.PX = { NAME, SCOPE, connect, forget, has: (s) => !!tok(s), R, load, NeedAuth, clear: () => cache.clear(), gaTable, gaCompare, gaRealtime, gscTable, gscCompare, keywords, sitemaps, inspect, adsTable, adsCompare, adsExtras };
})();
