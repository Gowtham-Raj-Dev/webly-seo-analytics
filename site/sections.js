/* Webly sections: Analytics, Search Console and AdSense with tabs, sortable/searchable tables, compare and CSV export.
   Loaded before app.js; it uses app.js globals (S, RANGE, metric, lineChart ...) only when a view is rendered. */
(() => {
  'use strict';
  const nf = (n) => Number(Math.round(n)).toLocaleString('en-IN');
  const pctf = (n) => (n * 100).toFixed(1) + '%';
  const dur = (s) => { s = Math.round(s); return s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor(s % 3600 / 60)}m` : s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`; };
  const chg = (c, p, lowerBetter) => { if (p == null) return ''; if (!p) return c ? '<span class="sub">new</span>' : ''; const d = (c - p) / p * 100, good = (d >= 0) !== !!lowerBetter; return `<span class="dl ${good ? 'up' : 'dn'}">${d >= 0 ? '&#9650;' : '&#9660;'} ${Math.abs(d).toFixed(1)}%</span>`; };
  const hosts = () => activeSites().map((s) => s.d);
  const real = () => !S.demo;
  const grid = (h) => `<div class="c12 bento kpis" style="grid-column:span 12">${[].concat(h).join('')}</div>`;
  const kpi = (l, v, c, p, ic, lower) => `<div class="card kpi c3" style="grid-column:span 3"><div class="kh"><span class="tile">${I(ic, 16)}</span>${S.compare ? chg(c, p, lower) : ''}</div><div class="v">${v}</div><div class="l">${l}</div></div>`;
  const note = (t) => `<div class="card c12 sub" style="padding:12px 20px">${t}</div>`;
  const errCard = (e) => `<div class="card c12" style="border-color:var(--bad)"><span class="tag bad">Problem</span> ${esc(e.message || e)}${e.enable ? ` <span class="sub">(Webly admin: enable ${e.enable.join(', ')} in the Google Cloud project.)</span>` : ''}</div>`;
  /** Connected, but the one-hour Google token ran out: show a reconnect card instead of zeros. */
  const expired = (k, t) => `<div class="card c12 empty"><div style="width:48px;height:48px;border-radius:12px;background:var(--warnbg);display:grid;place-items:center;margin:0 auto 12px;color:var(--warn)">${I('refresh', 24)}</div><h3 style="font-size:17px">Reconnect ${t}</h3><p style="margin:6px 0 16px">Google access lasts one hour, so these numbers are hidden until you reconnect.</p><button class="btn p" data-act="connect" data-k="${k}">Reconnect ${t}</button></div>`;
  const loadingMsg = '<div class="card c12 empty"><span class="spin"></span> Loading...</div>';

  /* ---------- tabs ---------- */
  const tabs = (base, items, cur) => `<div class="card c12" style="padding:6px 8px"><div class="tabs">${items.map(([k, l]) => `<a href="#/${base}/${k === items[0][0] ? '' : k}" class="${cur === k ? 'on' : ''}">${l}</a>`).join('')}</div></div>`;

  /* ---------- tables ---------- */
  const TB = {};
  function table(id, cols, rows, o = {}) {
    const t = TB[id] = { cols, rows, sort: o.sort == null ? Math.max(0, cols.findIndex((c) => c.n)) : o.sort, dir: -1, q: '', page: 0, size: o.size || 15, name: o.name || id };
    return `<div class="tbw" data-tb="${id}"><div class="tbbar"><input class="input tbq" data-tbq="${id}" placeholder="Search ${esc(t.name)}..." autocomplete="off"><button class="btn o sm" data-tbcsv="${id}">${I('down', 14)} CSV</button></div><div class="tbbody">${tbBody(id)}</div></div>`;
  }
  const tbRows = (t) => {
    let r = t.rows; if (t.q) { const q = t.q.toLowerCase(); r = r.filter((x) => t.cols.some((c) => String(c.v(x)).toLowerCase().includes(q))); }
    const c = t.cols[t.sort]; if (c) r = r.slice().sort((a, b) => { const x = c.v(a), y = c.v(b); return (typeof x === 'string' ? x.localeCompare(y) : x - y) * t.dir; });
    return r;
  };
  function tbBody(id) {
    const t = TB[id], rows = tbRows(t), pages = Math.max(1, Math.ceil(rows.length / t.size)); t.page = Math.min(t.page, pages - 1);
    const sl = rows.slice(t.page * t.size, (t.page + 1) * t.size);
    return `<div style="overflow:auto"><table><tr>${t.cols.map((c, i) => `<th class="${c.n ? 'n' : ''} srt" data-tbs="${id}:${i}">${c.l}${t.sort === i ? (t.dir < 0 ? ' &#9660;' : ' &#9650;') : ''}</th>`).join('')}</tr>${sl.map((r) => `<tr class="h">${t.cols.map((c) => `<td class="${c.n ? 'n' : ''}">${c.h ? c.h(r) : esc(c.v(r))}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${t.cols.length}" class="empty">No rows</td></tr>`}</table></div>
      <div class="tbpg"><span class="sub">${nf(rows.length)} row${rows.length === 1 ? '' : 's'}</span>${pages > 1 ? `<span><button class="btn o sm" data-tbp="${id}:${t.page - 1}" ${t.page ? '' : 'disabled'}>Prev</button> <span class="sub">${t.page + 1} / ${pages}</span> <button class="btn o sm" data-tbp="${id}:${t.page + 1}" ${t.page < pages - 1 ? '' : 'disabled'}>Next</button></span>` : ''}</div>`;
  }
  const redraw = (id) => { const b = document.querySelector(`[data-tb="${id}"] .tbbody`); if (b) b.innerHTML = tbBody(id); };
  document.addEventListener('input', (e) => { const i = e.target.closest('[data-tbq]'); if (i && TB[i.dataset.tbq]) { TB[i.dataset.tbq].q = i.value.trim(); TB[i.dataset.tbq].page = 0; redraw(i.dataset.tbq); } });
  document.addEventListener('click', (e) => {
    let el;
    if ((el = e.target.closest('[data-tbs]'))) { const [id, i] = el.dataset.tbs.split(':'), t = TB[id]; if (!t) return; t.dir = t.sort === +i ? -t.dir : (t.cols[+i].n ? -1 : 1); t.sort = +i; redraw(id); }
    else if ((el = e.target.closest('[data-tbp]'))) { const [id, p] = el.dataset.tbp.split(':'); if (TB[id]) { TB[id].page = +p; redraw(id); } }
    else if ((el = e.target.closest('[data-tbcsv]'))) {
      const t = TB[el.dataset.tbcsv]; if (!t) return;
      const q = (x) => `"${String(x).replace(/"/g, '""')}"`, rows = tbRows(t), cols = t.cols;
      const csv = [cols.map((c) => q(c.l)).join(','), ...rows.map((r) => cols.map((c) => q(c.c ? c.c(r) : c.v(r))).join(','))].join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `webly-${t.name.replace(/\W+/g, '-')}-${RANGE().start}.csv`; a.click();
    }
  });

  /* ---------- demo data ---------- */
  const factor = () => { const r = RANGE(); return Math.max(.03, (r.hourly ? 1 / 24 : r.n) / 28); };
  function demoStd(names, scale, kind) {
    return names.map((nm, i) => {
      const r = rnd(hash(kind + (Array.isArray(nm) ? nm.join() : nm))), u = Math.round(scale * factor() * (1 - i / (names.length + 3)) * (.6 + r() * .8)) + 1, s = Math.round(u * (1.2 + r() * .4)), v = Math.round(s * (1.6 + r())), sec = u * (40 + r() * 90), eng = Math.round(s * (.45 + r() * .3));
      const m = [u, s, v, sec, eng];
      return { d: Array.isArray(nm) ? nm : [nm], m, p: S.compare ? m.map((x) => x * (.7 + r() * .6)) : null };
    });
  }
  const DEMO = {
    pages: [['codelove.in', '/', 'CodeLove - Free Online Tools'], ['videomaker.codelove.in', '/', 'Video Maker'], ['games.codelove.in', '/night-heist', 'Night Heist'], ['codelove.in', '/products/downloader', 'Downloader'], ['apps.codelove.in', '/', 'Apps Store'], ['games.codelove.in', '/', 'Games'], ['linkinbio.codelove.in', '/', 'Link in Bio'], ['codelove.in', '/blog', 'Blog'], ['videocut.codelove.in', '/', 'Video Cut'], ['models.codelove.in', '/', '3D Models']],
    channels: ['Organic Search', 'Direct', 'Social', 'Referral', 'Organic Video', 'Email'], sm: [['google', 'organic'], ['(direct)', '(none)'], ['youtube.com', 'referral'], ['instagram', 'social'], ['bing', 'organic'], ['t.co', 'referral']],
    countries: ['India', 'United States', 'United Kingdom', 'Singapore', 'Germany', 'Canada', 'Australia', 'Malaysia', 'United Arab Emirates', 'Sri Lanka'], cities: [['India', 'Chennai'], ['India', 'Bengaluru'], ['India', 'Mumbai'], ['India', 'Delhi'], ['United States', 'New York'], ['United Kingdom', 'London'], ['Singapore', 'Singapore'], ['India', 'Hyderabad']],
    devices: ['mobile', 'desktop', 'tablet'], browsers: ['Chrome', 'Safari', 'Samsung Internet', 'Edge', 'Firefox'], os: ['Android', 'Windows', 'iOS', 'macOS', 'Linux'],
    events: ['page_view', 'session_start', 'first_visit', 'scroll', 'click', 'user_engagement'],
    q: ['free video maker', 'js game emulator', 'online video cutter', 'link in bio free', 'night heist game', 'java games online', 'video to gif', 'android apps store', 'download youtube shorts', 'glb model viewer', 'ai video maker', 'free 3d models', 'jar game player', 'image to video', 'compress video online'],
    gpages: ['/', '/products/downloader', '/blog', '/products/linkinbio', '/products/models', '/learn', '/about', '/contact'],
    gcountries: ['India', 'United States', 'United Kingdom', 'Pakistan', 'Philippines', 'Indonesia', 'Canada', 'Germany'], adsSites: ['codelove.in', 'games.codelove.in', 'videomaker.codelove.in', 'apps.codelove.in', 'linkinbio.codelove.in'], adsCountries: ['India', 'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany'], adsPlatforms: ['High-end mobile devices', 'Desktop', 'Tablets', 'Other'], adsUnits: ['Home banner', 'In-article', 'Sidebar', 'Footer', 'Anchor']
  };
  function demoGsc(names, scale, kind, lower) {
    return names.map((nm, i) => { const r = rnd(hash(kind + nm)), impr = Math.round(scale * factor() * (1 - i / (names.length + 3)) * (.6 + r())) + 5, ctr = .01 + r() * .08, clicks = Math.round(impr * ctr), pos = 2 + r() * 22; const o = { d: [nm], clicks, impr, ctr: clicks / impr, pos }; o.p = S.compare ? { clicks: clicks * (.7 + r() * .6), impr: impr * (.7 + r() * .6), pos: pos + (r() - .5) * 4, ctr } : null; return o; });
  }
  function demoAds(names, scale, kind) {
    return names.map((nm, i) => { const r = rnd(hash(kind + nm)), e = scale * factor() * (1 - i / (names.length + 3)) * (.6 + r() * .8), pv = Math.round(e / (.0015 + r() * .002)), imp = Math.round(pv * (1.6 + r())), clk = Math.round(imp * (.008 + r() * .015)); const o = { d: Array.isArray(nm) ? nm : [nm], e, pv, imp, clk }; o.p = S.compare ? { e: e * (.7 + r() * .6), pv: pv * (.8 + r() * .4), imp: imp * (.8 + r() * .4), clk: clk * (.8 + r() * .4) } : null; return o; });
  }

  /* ---------- column sets ---------- */
  const GA_STD = ['activeUsers', 'sessions', 'screenPageViews', 'userEngagementDuration', 'engagedSessions'];
  const stdCols = (first) => [...first, { l: 'Users', n: 1, v: (r) => r.m[0], h: (r) => nf(r.m[0]) }, { l: 'Sessions', n: 1, v: (r) => r.m[1], h: (r) => nf(r.m[1]) }, { l: 'Views', n: 1, v: (r) => r.m[2], h: (r) => nf(r.m[2]) }, { l: 'Avg. time', n: 1, v: (r) => (r.m[0] ? r.m[3] / r.m[0] : 0), h: (r) => dur(r.m[0] ? r.m[3] / r.m[0] : 0) }, { l: 'Engagement', n: 1, v: (r) => (r.m[1] ? r.m[4] / r.m[1] : 0), h: (r) => pctf(r.m[1] ? r.m[4] / r.m[1] : 0) }, ...(S.compare ? [{ l: 'Users change', n: 1, v: (r) => (r.p && r.p[0] ? (r.m[0] - r.p[0]) / r.p[0] : 0), h: (r) => chg(r.m[0], r.p && r.p[0]), c: (r) => (r.p && r.p[0] ? ((r.m[0] - r.p[0]) / r.p[0] * 100).toFixed(1) + '%' : '') }] : [])];
  const txt = (f, l, w) => ({ l, v: (r) => String(f(r)), h: w });
  const gaFetch = async (dims, demoNames, scale, metrics = GA_STD) => (real() ? PX.gaCompare(hosts(), dims, metrics, RANGE(), S.compare, 300) : demoStd(demoNames, scale, dims.join()));

  /* ---------- ANALYTICS ---------- */
  const GA_TABS = [['overview', 'Overview'], ['pages', 'Pages'], ['sources', 'Sources'], ['locations', 'Locations'], ['devices', 'Devices'], ['events', 'Events'], ['live', 'Live']];
  async function analytics(tab) {
    if (!S.demo && !S.conn.ga) return none('ga', 'Google Analytics'); if (!S.demo && !PX.has('ga')) return expired('ga', 'Google Analytics');
    tab = GA_TABS.some((t) => t[0] === tab) ? tab : 'overview';
    const bar = tabs('analytics', GA_TABS, tab);
    try {
      return bar + await ({ overview: gaOverview, pages: gaPages, sources: gaSources, locations: gaLocations, devices: gaDevices, events: gaEvents, live: gaLive }[tab])();
    } catch (e) { return bar + errCard(e); }
  }
  const GAM = { users: ['Users', 'users'], newu: ['New users', 'newu'], sessions: ['Sessions', 'sessions'], views: ['Page views', 'views'] };
  async function gaOverview() {
    const u = metric('users'), nu = metric('newu'), se = metric('sessions'), pv = metric('views'), sec = metric('sec'), en = metric('eng');
    const avg = (a, b) => (b ? a / b : 0), eng = avg(en.total, se.total), engP = avg(en.ptotal, se.ptotal);
    const cur = GAM[S.gam] ? S.gam : 'users', m = metric(cur), lab = chartLabels(cur);
    const seg = `<span class="seg">${Object.entries(GAM).map(([k, v]) => `<button data-gam="${k}" class="${cur === k ? 'on' : ''}">${v[0]}</button>`).join('')}</span>`;
    const ser = [{ n: GAM[cur][0], c: '#4f46e5', v: m.cur }]; if (S.compare) ser.push({ n: 'Previous period', c: '#94a3b8', v: m.prev });
    const rows = activeSites().map((s) => ({ s, u: siteTotal('users', s.d), nu: siteTotal('newu', s.d), se: siteTotal('sessions', s.d), v: siteTotal('views', s.d), pu: siteTotal('users', s.d, true) }));
    const cols = [{ l: 'Site', v: (r) => r.s.d, h: (r) => `<span class="site">${fav(r.s)}<span>${esc(r.s.n)}<br><small style="color:var(--tx3);font-weight:500">${esc(r.s.d)}</small></span></span>` }, { l: 'Users', n: 1, v: (r) => r.u, h: (r) => nf(r.u) }, { l: 'New users', n: 1, v: (r) => r.nu, h: (r) => nf(r.nu) }, { l: 'Sessions', n: 1, v: (r) => r.se, h: (r) => nf(r.se) }, { l: 'Views', n: 1, v: (r) => r.v, h: (r) => nf(r.v) }, ...(S.compare ? [{ l: 'Users change', n: 1, v: (r) => (r.pu ? (r.u - r.pu) / r.pu : 0), h: (r) => chg(r.u, r.pu) }] : [])];
    return grid([kpi('Users', nf(u.total), u.total, u.ptotal, 'users'), kpi('New users', nf(nu.total), nu.total, nu.ptotal, 'plus'), kpi('Sessions', nf(se.total), se.total, se.ptotal, 'eye'), kpi('Page views', nf(pv.total), pv.total, pv.ptotal, 'file'), kpi('Avg. time per user', dur(avg(sec.total, u.total)), avg(sec.total, u.total), avg(sec.ptotal, u.ptotal), 'pulse'), kpi('Engagement rate', pctf(eng), eng, engP, 'bolt'), kpi('Bounce rate', pctf(1 - eng), 1 - eng, 1 - engP, 'cursor', true), kpi('Views per session', avg(pv.total, se.total).toFixed(2), avg(pv.total, se.total), avg(pv.ptotal, se.ptotal), 'chart')])
      + `<div class="card c12"><div class="ch" style="flex-wrap:wrap"><div><h3>${GAM[cur][0]}</h3><div class="sub">${RANGE().name}${RANGE().hourly ? ', by hour' : ', by day'}</div></div><span class="sp">${seg}</span></div>${lineChart('gaov', ser, lab, 280)}</div>`
      + `<div class="card c12"><div class="ch"><h3>By site</h3></div>${table('gasites', cols, rows, { name: 'sites' })}</div>`;
  }
  async function gaPages() {
    const rows = await gaFetch(['hostName', 'pagePath', 'pageTitle'], DEMO.pages.map((p) => [p[0], p[1], p[2]]), 4000);
    const multi = hosts().length > 1;
    return `<div class="card c12"><div class="ch"><div><h3>Pages</h3><div class="sub">${RANGE().name}. Click a column to sort, type to search.</div></div></div>${table('gapages', stdCols([{ l: 'Page', v: (r) => r.d[2] + ' ' + r.d[1], h: (r) => `<b>${esc(r.d[2] === '(not set)' ? r.d[1] : r.d[2])}</b><br><a class="sub" href="https://${esc(r.d[0])}${esc(r.d[1])}" target="_blank" rel="noopener">${multi ? esc(r.d[0]) : ''}${esc(r.d[1])}</a>`, c: (r) => `https://${r.d[0]}${r.d[1]}` }]), rows, { name: 'pages' })}</div>`;
  }
  async function gaSources() {
    const [ch, sm] = await Promise.all([gaFetch(['sessionDefaultChannelGroup'], DEMO.channels, 5000), gaFetch(['sessionSource', 'sessionMedium'], DEMO.sm, 3000)]);
    return `<div class="card c4"><div class="ch"><h3>Channels</h3></div>${donut(ch.slice(0, 6).map((r, i) => ({ n: r.d[0], v: r.m[1], c: PAL[i % PAL.length] })))}</div>`
      + `<div class="card c8"><div class="ch"><h3>Channels table</h3></div>${table('gach', stdCols([{ l: 'Channel', v: (r) => r.d[0] }]), ch, { name: 'channels', size: 8 })}</div>`
      + `<div class="card c12"><div class="ch"><h3>Source / medium</h3></div>${table('gasm', stdCols([{ l: 'Source / medium', v: (r) => r.d.join(' / ') }]), sm, { name: 'sources' })}</div>`;
  }
  async function gaLocations() {
    const [co, ci] = await Promise.all([gaFetch(['country'], DEMO.countries, 4000), gaFetch(['country', 'city'], DEMO.cities, 1500)]);
    return `<div class="card c12"><div class="ch"><h3>Countries</h3></div>${table('gaco', stdCols([{ l: 'Country', v: (r) => r.d[0] }]), co, { name: 'countries' })}</div><div class="card c12"><div class="ch"><h3>Cities</h3></div>${table('gaci', stdCols([{ l: 'City', v: (r) => r.d[1] }, { l: 'Country', v: (r) => r.d[0] }]), ci, { name: 'cities' })}</div>`;
  }
  async function gaDevices() {
    const [dv, br, os] = await Promise.all([gaFetch(['deviceCategory'], DEMO.devices, 5000), gaFetch(['browser'], DEMO.browsers, 4000), gaFetch(['operatingSystem'], DEMO.os, 4000)]);
    return `<div class="card c4"><div class="ch"><h3>Device categories</h3></div>${donut(dv.map((r, i) => ({ n: r.d[0], v: r.m[0], c: PAL[i % PAL.length] })))}</div><div class="card c8"><div class="ch"><h3>Devices</h3></div>${table('gadv', stdCols([{ l: 'Device', v: (r) => r.d[0] }]), dv, { name: 'devices', size: 6 })}</div>`
      + `<div class="card c6"><div class="ch"><h3>Browsers</h3></div>${table('gabr', stdCols([{ l: 'Browser', v: (r) => r.d[0] }]), br, { name: 'browsers', size: 8 })}</div><div class="card c6"><div class="ch"><h3>Operating systems</h3></div>${table('gaos', stdCols([{ l: 'System', v: (r) => r.d[0] }]), os, { name: 'systems', size: 8 })}</div>`;
  }
  async function gaEvents() {
    const rows = real() ? await PX.gaCompare(hosts(), ['eventName'], ['eventCount', 'totalUsers'], RANGE(), S.compare, 200) : DEMO.events.map((e, i) => { const r = rnd(hash('ev' + e)), c = Math.round(9000 * factor() * (1 - i / 8) * (.6 + r())) + 3; return { d: [e], m: [c, Math.round(c / (2 + r() * 3))], p: S.compare ? [c * (.7 + r() * .6), 0] : null }; });
    return `<div class="card c12"><div class="ch"><h3>Events</h3><span class="sp sub">What visitors do on your sites</span></div>${table('gaev', [{ l: 'Event', v: (r) => r.d[0] }, { l: 'Count', n: 1, v: (r) => r.m[0], h: (r) => nf(r.m[0]) }, { l: 'Users', n: 1, v: (r) => r.m[1], h: (r) => nf(r.m[1]) }, { l: 'Per user', n: 1, v: (r) => (r.m[1] ? r.m[0] / r.m[1] : 0), h: (r) => (r.m[1] ? (r.m[0] / r.m[1]).toFixed(1) : '-') }, ...(S.compare ? [{ l: 'Count change', n: 1, v: (r) => (r.p && r.p[0] ? (r.m[0] - r.p[0]) / r.p[0] : 0), h: (r) => chg(r.m[0], r.p && r.p[0]) }] : [])], rows, { name: 'events' })}</div>`;
  }
  const liveHtml = (L) => `<div class="card c4"><div class="ch"><h3>Active users</h3><span class="sp tag ok">last 30 minutes</span></div><div class="live"><span class="pulse"></span><span class="big">${nf(L.total)}</span></div>${lineChartBars(L.minutes)}</div>
    <div class="card c8"><div class="ch"><h3>Pages right now</h3></div><div class="list">${L.pages.map((p) => `<div class="li"><div class="t"><b>${esc(p[0])}</b></div><b>${nf(p[1])}</b></div>`).join('') || '<p class="sub">Nobody right now.</p>'}</div></div>
    <div class="card c6"><div class="ch"><h3>Countries</h3></div><div class="list">${L.countries.map((p) => `<div class="li"><div class="t"><b>${esc(p[0])}</b></div><b>${nf(p[1])}</b></div>`).join('') || '<p class="sub">-</p>'}</div></div>
    <div class="card c6"><div class="ch"><h3>Devices</h3></div><div class="list">${L.devices.map((p) => `<div class="li"><div class="t"><b>${esc(p[0])}</b></div><b>${nf(p[1])}</b></div>`).join('') || '<p class="sub">-</p>'}</div></div>`;
  const lineChartBars = (a) => { const mx = Math.max(1, ...a); return `<div class="mbars">${a.map((v) => `<i style="height:${Math.max(4, v / mx * 100)}%"></i>`).join('')}</div><div class="sub" style="display:flex;justify-content:space-between"><span>30 min ago</span><span>now</span></div>`; };
  const demoLive = () => { const r = rnd(hash('live' + Math.floor(Date.now() / 3e4))); return { total: 14 + Math.floor(r() * 30), minutes: Array.from({ length: 30 }, () => Math.round(r() * 12)), pages: DEMO.pages.slice(0, 5).map((p, i) => [p[2], 9 - i]), countries: [['India', 21], ['United States', 4], ['United Kingdom', 2]], devices: [['mobile', 22], ['desktop', 8], ['tablet', 1]] }; };
  async function gaLive() {
    const L = real() ? await PX.gaRealtime() : demoLive();
    const iv = setInterval(async () => { const b = document.getElementById('liveBox'); if (!b) return clearInterval(iv); try { b.innerHTML = liveHtml(real() ? await PX.gaRealtime() : demoLive()); } catch (e) { /* keep last */ } }, 30000);
    SEC.cleanup = () => clearInterval(iv);
    return `<div id="liveBox" class="c12 bento" style="grid-column:span 12">${liveHtml(L)}</div>` + note(real() ? 'Realtime reports cannot be split by site, so this shows all your Analytics properties. It refreshes every 30 seconds.' : 'Sample numbers. Refreshes every 30 seconds.');
  }

  /* ---------- SEARCH CONSOLE ---------- */
  const GSC_TABS = [['overview', 'Overview'], ['queries', 'Queries'], ['pages', 'Pages'], ['countries', 'Countries'], ['devices', 'Devices'], ['index', 'Index'], ['targets', 'Targets']];
  const A3 = { ind: 'India', usa: 'United States', gbr: 'United Kingdom', can: 'Canada', aus: 'Australia', deu: 'Germany', fra: 'France', sgp: 'Singapore', mys: 'Malaysia', are: 'United Arab Emirates', pak: 'Pakistan', bgd: 'Bangladesh', lka: 'Sri Lanka', npl: 'Nepal', idn: 'Indonesia', phl: 'Philippines', vnm: 'Vietnam', tha: 'Thailand', jpn: 'Japan', kor: 'South Korea', chn: 'China', rus: 'Russia', bra: 'Brazil', mex: 'Mexico', esp: 'Spain', ita: 'Italy', nld: 'Netherlands', zaf: 'South Africa', nga: 'Nigeria', egy: 'Egypt', sau: 'Saudi Arabia', tur: 'Turkey', irn: 'Iran', pol: 'Poland', swe: 'Sweden', qat: 'Qatar', kwt: 'Kuwait', omn: 'Oman', ken: 'Kenya', irl: 'Ireland', nzl: 'New Zealand' };
  const country3 = (c) => A3[String(c).toLowerCase()] || String(c).toUpperCase();
  const gscHosts = () => hosts().filter((h) => !real() || (PX.R.gscMap && PX.R.gscMap[h]));
  const devFilter = () => (S.gdev ? [{ dimension: 'device', operator: 'equals', expression: S.gdev }] : null);
  const gscFetch = async (dims, demoNames, scale) => {
    if (!real()) return demoGsc(demoNames, scale, dims.join() + (S.gdev || ''));
    const hs = gscHosts(); if (!hs.length) return [];
    return PX.gscCompare(hs, dims, RANGE(), S.compare, 500, devFilter());
  };
  const gscCols = (first) => [...first, { l: 'Clicks', n: 1, v: (r) => r.clicks, h: (r) => nf(r.clicks) }, { l: 'Impressions', n: 1, v: (r) => r.impr, h: (r) => nf(r.impr) }, { l: 'CTR', n: 1, v: (r) => r.ctr, h: (r) => pctf(r.ctr) }, { l: 'Position', n: 1, v: (r) => r.pos, h: (r) => `<span class="tag ${r.pos <= 10 ? 'ok' : r.pos <= 20 ? 'warn' : 'mute'}">${r.pos.toFixed(1)}</span>`, c: (r) => r.pos.toFixed(1) }, ...(S.compare ? [{ l: 'Clicks change', n: 1, v: (r) => (r.p && r.p.clicks ? (r.clicks - r.p.clicks) / r.p.clicks : 0), h: (r) => chg(r.clicks, r.p && r.p.clicks) }, { l: 'Position change', n: 1, v: (r) => (r.p && r.p.pos ? r.p.pos - r.pos : 0), h: (r) => (r.p && r.p.pos ? `<span class="dl ${r.p.pos - r.pos >= 0 ? 'up' : 'dn'}">${r.p.pos - r.pos >= 0 ? '&#9650;' : '&#9660;'} ${Math.abs(r.p.pos - r.pos).toFixed(1)}</span>` : '<span class="sub">new</span>'), c: (r) => (r.p && r.p.pos ? (r.p.pos - r.pos).toFixed(1) : '') }] : [])];
  const devChips = () => `<span class="seg">${[['', 'All devices'], ['MOBILE', 'Mobile'], ['DESKTOP', 'Desktop'], ['TABLET', 'Tablet']].map(([k, l]) => `<button data-gdev="${k}" class="${(S.gdev || '') === k ? 'on' : ''}">${l}</button>`).join('')}</span>`;
  async function search(tab) {
    if (!S.demo && !S.conn.gsc) return none('gsc', 'Search Console'); if (!S.demo && !PX.has('gsc')) return expired('gsc', 'Search Console');
    tab = GSC_TABS.some((t) => t[0] === tab) ? tab : 'overview';
    const bar = tabs('search', GSC_TABS, tab);
    let pre = ''; if (!S.demo && !gscHosts().length) return bar + `<div class="card c12 empty"><h3>No Search Console sites</h3><p style="margin:6px 0">None of the selected sites is a Search Console property of this Google account.</p></div>`;
    if (!S.demo && ['overview', 'queries', 'pages'].includes(tab) && RANGE().n <= 3) pre = note('Search Console data arrives with a delay of about 2 days, so very recent days can be empty.');
    try { return bar + pre + await ({ overview: gscOverview, queries: gscQueries, pages: gscPages, countries: gscCountries, devices: gscDevices, index: gscIndex, targets: gscTargets }[tab])(); } catch (e) { return bar + errCard(e); }
  }
  const GSM = { clicks: 'Clicks', impr: 'Impressions' };
  async function gscOverview() {
    const c = metric('clicks'), im = metric('impr'), pw = metric('posw'), cur = GSM[S.gsm] ? S.gsm : 'clicks', m = cur === 'clicks' ? c : im;
    const ctr = (a, b) => (b ? a / b : 0), pos = (w, i) => (i ? w / i : 0);
    const seg = `<span class="seg">${Object.entries(GSM).map(([k, v]) => `<button data-gsm="${k}" class="${cur === k ? 'on' : ''}">${v}</button>`).join('')}</span>`;
    const ser = [{ n: GSM[cur], c: '#4f46e5', v: m.cur }]; if (S.compare) ser.push({ n: 'Previous period', c: '#94a3b8', v: m.prev });
    const rows = activeSites().filter((s) => S.demo || (PX.R.gscMap && PX.R.gscMap[s.d])).map((s) => ({ s, c: siteTotal('clicks', s.d), i: siteTotal('impr', s.d), pc: siteTotal('clicks', s.d, true), pw: siteTotal('posw', s.d) }));
    const [qs, pgs] = await Promise.all([gscFetch(['query'], DEMO.q, 6000), gscFetch(['page'], DEMO.gpages.map((p) => 'https://codelove.in' + p), 3000)]);
    const mini = (rows, fn) => `<div class="list">${rows.slice(0, 6).map((r) => `<div class="li"><div class="t"><b>${esc(fn(r))}</b><span>${nf(r.impr)} impressions · position ${r.pos.toFixed(1)}</span></div><b>${nf(r.clicks)}</b></div>`).join('') || '<p class="sub">No data.</p>'}</div>`;
    return grid([kpi('Clicks', nf(c.total), c.total, c.ptotal, 'cursor'), kpi('Impressions', nf(im.total), im.total, im.ptotal, 'eye'), kpi('Average CTR', pctf(ctr(c.total, im.total)), ctr(c.total, im.total), ctr(c.ptotal, im.ptotal), 'bolt'), kpi('Average position', pos(pw.total, im.total).toFixed(1), pos(pw.total, im.total), pos(pw.ptotal, im.ptotal), 'trend', true)])
      + `<div class="card c12"><div class="ch" style="flex-wrap:wrap"><div><h3>${GSM[cur]}</h3><div class="sub">${RANGE().name}, by day</div></div><span class="sp">${seg}</span></div>${lineChart('gscov', ser, chartLabels(cur === 'clicks' ? 'clicks' : 'impr'), 280)}</div>`
      + `<div class="card c6"><div class="ch"><h3>Top queries</h3><a class="sp btn o sm" href="#/search/queries">All queries</a></div>${mini(qs, (r) => r.d[0])}</div><div class="card c6"><div class="ch"><h3>Top pages</h3><a class="sp btn o sm" href="#/search/pages">All pages</a></div>${mini(pgs, (r) => r.d[0].replace(/^https?:\/\//, ''))}</div>`
      + `<div class="card c12"><div class="ch"><h3>By site</h3></div>${table('gscsites', [{ l: 'Site', v: (r) => r.s.d, h: (r) => `<span class="site">${fav(r.s)}${esc(r.s.d)}</span>` }, { l: 'Clicks', n: 1, v: (r) => r.c, h: (r) => nf(r.c) }, { l: 'Impressions', n: 1, v: (r) => r.i, h: (r) => nf(r.i) }, { l: 'CTR', n: 1, v: (r) => ctr(r.c, r.i), h: (r) => pctf(ctr(r.c, r.i)) }, { l: 'Position', n: 1, v: (r) => pos(r.pw, r.i), h: (r) => pos(r.pw, r.i).toFixed(1) }, ...(S.compare ? [{ l: 'Clicks change', n: 1, v: (r) => (r.pc ? (r.c - r.pc) / r.pc : 0), h: (r) => chg(r.c, r.pc) }] : [])], rows, { name: 'sites' })}</div>`;
  }
  async function gscQueries() {
    const rows = await gscFetch(['query'], DEMO.q, 6000);
    return `<div class="card c12"><div class="ch" style="flex-wrap:wrap"><div><h3>Queries</h3><div class="sub">What people typed into Google to find you</div></div><span class="sp">${devChips()}</span></div>${table('gscq', gscCols([{ l: 'Query', v: (r) => r.d[0], h: (r) => `<b>${esc(r.d[0])}</b>` }, { l: '', v: () => '', h: (r) => `<a class="btn o sm" href="https://www.google.com/search?q=${encodeURIComponent(r.d[0])}" target="_blank" rel="noopener">Google</a>`, c: () => '' }]), rows, { name: 'queries', sort: 2 })}</div>`;
  }
  async function gscPages() {
    const rows = await gscFetch(['page'], DEMO.gpages.map((p) => 'https://codelove.in' + p), 3000);
    return `<div class="card c12"><div class="ch" style="flex-wrap:wrap"><div><h3>Pages</h3><div class="sub">Which pages Google shows</div></div><span class="sp">${devChips()}</span></div>${table('gscp', gscCols([{ l: 'Page', v: (r) => r.d[0], h: (r) => `<a href="${esc(r.d[0])}" target="_blank" rel="noopener" style="word-break:break-all">${esc(r.d[0].replace(/^https?:\/\//, ''))}</a>`, c: (r) => r.d[0] }]), rows, { name: 'pages', sort: 1 })}</div>`;
  }
  async function gscCountries() {
    const rows = await gscFetch(['country'], DEMO.gcountries, 3000);
    return `<div class="card c12"><div class="ch"><h3>Countries</h3></div>${table('gscc', gscCols([{ l: 'Country', v: (r) => country3(r.d[0]) }]), rows, { name: 'countries', sort: 1 })}</div>`;
  }
  async function gscDevices() {
    const rows = await gscFetch(['device'], ['MOBILE', 'DESKTOP', 'TABLET'], 6000);
    return `<div class="card c4"><div class="ch"><h3>Clicks by device</h3></div>${donut(rows.map((r, i) => ({ n: String(r.d[0]).toLowerCase(), v: r.clicks, c: PAL[i % PAL.length] })))}</div><div class="card c8"><div class="ch"><h3>Devices</h3></div>${table('gscd', gscCols([{ l: 'Device', v: (r) => String(r.d[0]).toLowerCase() }]), rows, { name: 'devices', sort: 1, size: 5 })}</div>`;
  }
  const VERDICT = { PASS: ['In Google', 'ok'], PARTIAL: ['Partly', 'warn'], FAIL: ['Not in Google', 'bad'], NEUTRAL: ['Excluded', 'mute'], VERDICT_UNSPECIFIED: ['Unknown', 'mute'] };
  const inspHtml = (r) => { const x = r.indexStatusResult || {}, v = VERDICT[x.verdict] || ['Unknown', 'mute']; return `<div class="todo"><div><b><span class="tag ${v[1]}">${v[0]}</span> ${esc(x.coverageState || '')}</b><span>Last crawl: ${x.lastCrawlTime ? new Date(x.lastCrawlTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'never'} · Crawled as ${esc(x.crawledAs || '-')} · Robots.txt: ${esc(x.robotsTxtState || '-')} · Indexing: ${esc(x.indexingState || '-')}<br>Google canonical: ${esc(x.googleCanonical || '-')}${x.userCanonical && x.userCanonical !== x.googleCanonical ? `<br>Your canonical: ${esc(x.userCanonical)}` : ''}</span></div></div>`; };
  async function gscIndex() {
    const hs = gscHosts(), maps = [];
    if (real()) await Promise.all(hs.slice(0, 12).map(async (h) => { (await PX.sitemaps(h)).forEach((m) => maps.push({ h, ...m })); }));
    else DEMO.adsSites.forEach((h, i) => maps.push({ h, path: `https://${h}/sitemap.xml`, last: new Date(Date.now() - i * 864e5).toISOString(), errors: i === 4 ? 2 : 0, warnings: i === 2 ? 1 : 0, submitted: 20 + i * 14 }));
    const mapCols = [{ l: 'Site', v: (r) => r.h }, { l: 'Sitemap', v: (r) => r.path, h: (r) => `<a href="${esc(r.path)}" target="_blank" rel="noopener" style="word-break:break-all">${esc(r.path.replace(/^https?:\/\//, ''))}</a>` }, { l: 'Last read', v: (r) => r.last || '', h: (r) => (r.last ? new Date(r.last).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '-') }, { l: 'URLs', n: 1, v: (r) => r.submitted, h: (r) => nf(r.submitted) }, { l: 'Errors', n: 1, v: (r) => r.errors, h: (r) => (r.errors ? `<span class="tag bad">${r.errors}</span>` : '<span class="tag ok">0</span>') }, { l: 'Warnings', n: 1, v: (r) => r.warnings, h: (r) => (r.warnings ? `<span class="tag warn">${r.warnings}</span>` : '0') }];
    const noMap = hs.filter((h) => !maps.some((m) => m.h === h));
    return `<div class="card c12"><div class="ch"><h3>Sitemaps</h3><span class="sp sub">Submitted to Google</span></div>${table('gscmaps', mapCols, maps, { name: 'sitemaps', sort: 0 })}${noMap.length && real() ? `<p class="sub" style="margin-top:10px"><span class="tag warn">No sitemap</span> ${noMap.map(esc).join(', ')}. In Search Console > Sitemaps add <b>sitemap.xml</b>.</p>` : ''}</div>`
      + `<div class="card c12"><div class="ch"><div><h3>Inspect a URL</h3><div class="sub">Is this page in Google? (Google allows about 2000 checks per day)</div></div></div><form class="pick" id="inspForm"><select class="input" id="inspSite" style="max-width:240px">${hs.map((h) => `<option>${esc(h)}</option>`).join('')}</select><input class="input" id="inspUrl" placeholder="https://${esc(hs[0] || 'example.com')}/page" style="flex:1"><button class="btn p" type="submit">Inspect</button></form><div id="inspOut" style="margin-top:12px"></div></div>`
      + `<div class="card c12"><div class="ch"><div><h3>Index status of your top pages</h3><div class="sub">Checks the 10 pages with the most clicks</div></div><button class="btn p sm sp" data-act="inspectTop">Check top pages</button></div><div id="inspTop"><p class="sub">Press the button to check.</p></div></div>`;
  }
  document.addEventListener('submit', async (e) => {
    if (e.target.id !== 'inspForm') return; e.preventDefault();
    const out = document.getElementById('inspOut'), h = document.getElementById('inspSite').value, u = document.getElementById('inspUrl').value.trim();
    if (!/^https?:\/\//.test(u)) { out.innerHTML = '<span class="tag bad">Enter the full URL starting with https://</span>'; return; }
    out.innerHTML = '<span class="spin"></span> Asking Google...';
    try { out.innerHTML = S.demo ? inspHtml({ indexStatusResult: { verdict: 'PASS', coverageState: 'Submitted and indexed', lastCrawlTime: new Date().toISOString(), crawledAs: 'MOBILE', robotsTxtState: 'ALLOWED', indexingState: 'INDEXING_ALLOWED', googleCanonical: u } }) : inspHtml(await PX.inspect(h, u)); } catch (er) { out.innerHTML = `<span class="tag bad">${esc(er.message)}</span>`; }
  });
  async function inspectTop(btn) {
    const box = document.getElementById('inspTop'); btn.disabled = true; box.innerHTML = '<span class="spin"></span> Reading your top pages...';
    try {
      const pages = (await gscFetch(['page'], DEMO.gpages.map((p) => 'https://codelove.in' + p), 3000)).slice(0, 10), rows = [];
      await TL.pool(pages, 3, async (p) => { const url = p.d[0], h = hosts().find((x) => url.includes('//' + x) || url.includes('//www.' + x)) || hosts()[0]; try { const r = S.demo ? { indexStatusResult: { verdict: Math.random() > .2 ? 'PASS' : 'FAIL', coverageState: 'Demo', lastCrawlTime: new Date().toISOString() } } : await PX.inspect(h, url); rows.push({ url, r: r.indexStatusResult || {} }); } catch (er) { rows.push({ url, err: er.message }); } box.innerHTML = `<span class="spin"></span> Checked ${rows.length} of ${pages.length}...`; }).done;
      box.innerHTML = table('gscinsp', [{ l: 'Page', v: (r) => r.url, h: (r) => `<a href="${esc(r.url)}" target="_blank" rel="noopener" style="word-break:break-all">${esc(r.url.replace(/^https?:\/\//, ''))}</a>` }, { l: 'Status', v: (r) => (r.err ? 'error' : (VERDICT[r.r.verdict] || ['Unknown'])[0]), h: (r) => (r.err ? `<span class="tag bad">${esc(r.err)}</span>` : `<span class="tag ${(VERDICT[r.r.verdict] || [0, 'mute'])[1]}">${(VERDICT[r.r.verdict] || ['Unknown'])[0]}</span>`) }, { l: 'Details', v: (r) => (r.err ? '' : r.r.coverageState || ''), h: (r) => esc(r.err ? '' : r.r.coverageState || '') }, { l: 'Last crawl', v: (r) => (r.err ? '' : r.r.lastCrawlTime || ''), h: (r) => (!r.err && r.r.lastCrawlTime ? new Date(r.r.lastCrawlTime).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '-') }], rows, { name: 'index-status', sort: 1 });
    } catch (er) { box.innerHTML = `<span class="tag bad">${esc(er.message)}</span>`; }
    btn.disabled = false;
  }
  async function gscTargets() {
    const out = [];
    for (const h of (S.demo ? DEMO.adsSites.slice(0, 2) : gscHosts())) {
      let t = []; try { t = JSON.parse(localStorage.getItem('pulse_targets_' + h) || '[]'); } catch (e) { /* ignore */ }
      if (!t.length) continue;
      let kw = []; try { kw = S.demo ? demoGsc(DEMO.q, 6000, 'tk').map((r) => ({ q: r.d[0], pos: r.pos, impr: r.impr })) : await PX.keywords(h); } catch (e) { /* ignore */ }
      t.forEach((k) => { const f = kw.find((x) => x.q.toLowerCase() === k.toLowerCase()); out.push({ h, k, f }); });
    }
    return `<div class="card c12"><div class="ch"><div><h3>Target keywords</h3><div class="sub">Keywords you want to rank for. Add them in the Rank tracker.</div></div><a class="btn p sm sp" href="#/tools/rank">Open Rank tracker</a></div>${out.length ? table('gsct', [{ l: 'Keyword', v: (r) => r.k, h: (r) => `<b>${esc(r.k)}</b>` }, { l: 'Site', v: (r) => r.h }, { l: 'Position', n: 1, v: (r) => (r.f ? r.f.pos : 999), h: (r) => (r.f ? `<span class="tag ${r.f.pos <= 10 ? 'ok' : 'warn'}">${r.f.pos.toFixed(1)}</span>` : '<span class="tag bad">Not in Google yet</span>'), c: (r) => (r.f ? r.f.pos.toFixed(1) : 'not in Google') }, { l: 'Impressions', n: 1, v: (r) => (r.f ? r.f.impr : 0), h: (r) => (r.f ? nf(r.f.impr) : '-') }], out, { name: 'targets' }) : '<p class="empty">No target keywords yet. Add some in the Rank tracker.</p>'}</div>`;
  }

  /* ---------- ADSENSE ---------- */
  const ADS_TABS = [['overview', 'Overview'], ['sites', 'Sites'], ['countries', 'Countries'], ['platforms', 'Platforms'], ['units', 'Ad units'], ['payments', 'Payments'], ['approval', 'Approval']];
  const ADS_STATE = { READY: ['Ready', 'ok'], GETTING_READY: ['Getting ready', 'warn'], REQUIRES_REVIEW: ['Requires review', 'warn'], NEEDS_ATTENTION: ['Needs attention', 'bad'] };
  const rpm = (r) => (r.pv ? r.e / r.pv * 1000 : 0), actr = (r) => (r.imp ? r.clk / r.imp : 0), cpc = (r) => (r.clk ? r.e / r.clk : 0);
  const adsCols = (first) => [...first, { l: 'Earnings', n: 1, v: (r) => r.e, h: (r) => money(r.e), c: (r) => r.e.toFixed(2) }, { l: 'Page views', n: 1, v: (r) => r.pv, h: (r) => nf(r.pv) }, { l: 'Impressions', n: 1, v: (r) => r.imp, h: (r) => nf(r.imp) }, { l: 'Clicks', n: 1, v: (r) => r.clk, h: (r) => nf(r.clk) }, { l: 'CTR', n: 1, v: actr, h: (r) => pctf(actr(r)) }, { l: 'Page RPM', n: 1, v: rpm, h: (r) => money(rpm(r)), c: (r) => rpm(r).toFixed(2) }, { l: 'CPC', n: 1, v: cpc, h: (r) => money(cpc(r)), c: (r) => cpc(r).toFixed(3) }, ...(S.compare ? [{ l: 'Earnings change', n: 1, v: (r) => (r.p && r.p.e ? (r.e - r.p.e) / r.p.e : 0), h: (r) => chg(r.e, r.p && r.p.e) }] : [])];
  const adsFetch = async (dims, demoNames, scale) => (real() ? PX.adsCompare(dims, RANGE(), S.compare) : demoAds(demoNames, scale, dims.join()));
  async function adsense(tab) {
    if (!S.demo && !S.conn.ads) return none('ads', 'AdSense'); if (!S.demo && !PX.has('ads')) return expired('ads', 'AdSense');
    tab = ADS_TABS.some((t) => t[0] === tab) ? tab : 'overview';
    const bar = tabs('adsense', ADS_TABS, tab);
    try { return bar + await ({ overview: adsOverview, sites: adsSites, countries: adsCountries, platforms: adsPlatforms, units: adsUnits, payments: adsPayments, approval: adsApproval }[tab])(); } catch (e) { return bar + errCard(e); }
  }
  async function adsOverview() {
    const rv = metric('rev'), pv = metric('adpv'), im = metric('adimp'), ck = metric('adclk'), tot = (m) => m.total, ptot = (m) => m.ptotal;
    const r0 = { e: rv.total, pv: pv.total, imp: im.total, clk: ck.total }, r1 = { e: rv.ptotal, pv: pv.ptotal, imp: im.ptotal, clk: ck.ptotal };
    const ex = real() ? await PX.adsExtras() : { alerts: [], unpaid: 63.4, currency: '$' };
    const ser = [{ n: 'Earnings', c: '#16a34a', v: rv.cur }]; if (S.compare) ser.push({ n: 'Previous period', c: '#94a3b8', v: rv.prev });
    const bal = ex.unpaid, perDay = rv.total / Math.max(1, RANGE().n);
    return (ex.alerts || []).map((a) => `<div class="card c12" style="border-color:var(--warn);padding:12px 20px"><span class="tag warn">${esc(a.severity || 'Alert')}</span> ${esc(a.message || a.type || '')}</div>`).join('')
      + grid([kpi('Earnings', money(r0.e), r0.e, r1.e, 'dollar'), kpi('Page RPM', money(rpm(r0)), rpm(r0), rpm(r1), 'trend'), kpi('Page views', nf(r0.pv), r0.pv, r1.pv, 'eye'), kpi('Impressions', nf(r0.imp), r0.imp, r1.imp, 'chart'), kpi('Clicks', nf(r0.clk), r0.clk, r1.clk, 'cursor'), kpi('CTR', pctf(actr(r0)), actr(r0), actr(r1), 'bolt'), kpi('Cost per click', money(cpc(r0)), cpc(r0), cpc(r1), 'tag'), kpi('Earnings per day', money(perDay), perDay, rv.ptotal / Math.max(1, RANGE().n), 'dollar')])
      + `<div class="card c8"><div class="ch"><div><h3>Earnings</h3><div class="sub">${RANGE().name}, estimated, by day</div></div></div>${lineChart('adov', ser, chartLabels('rev'), 280, money)}</div>`
      + `<div class="card c4"><div class="ch"><h3>Next payment</h3></div>${bal == null ? '<p class="sub">Payment info is not available.</p>' : `<div style="font-size:30px;font-weight:700;letter-spacing:-.03em">${esc(ex.currency || '$')}${bal.toFixed(2)}</div><div class="sub">of about 100 payout threshold</div><div class="prog" style="height:10px"><i style="width:${Math.min(100, bal)}%;background:var(--ok)"></i></div>${perDay > 0 && bal < 100 ? `<span class="tag ok">about ${Math.ceil((100 - bal) / perDay)} days to go</span>` : ''}`}<a class="btn o sm" style="margin-top:12px" href="#/adsense/payments">Payment history</a></div>`;
  }
  async function adsSites() {
    const [rows, ex] = await Promise.all([adsFetch(['DOMAIN_NAME'], DEMO.adsSites, 120), real() ? PX.adsExtras() : { sites: [] }]);
    const st = new Map((ex.sites || []).map((s) => [s.domain, s]));
    return `<div class="card c12"><div class="ch"><h3>Earnings by site</h3></div>${table('adss', adsCols([{ l: 'Site', v: (r) => r.d[0], h: (r) => `<span class="site">${fav(mk(r.d[0]))}${esc(r.d[0])}</span>` }, { l: 'Approval', v: (r) => (st.get(r.d[0]) ? st.get(r.d[0]).state : ''), h: (r) => { const s = st.get(r.d[0]); const x = s ? ADS_STATE[s.state] || [s.state, 'mute'] : ['-', 'mute']; return `<span class="tag ${x[1]}">${x[0]}</span>`; }, c: (r) => (st.get(r.d[0]) ? st.get(r.d[0]).state : '') }]), rows, { name: 'ad-sites', sort: 2 })}</div>`;
  }
  async function adsCountries() { const rows = await adsFetch(['COUNTRY_NAME'], DEMO.adsCountries, 120); return `<div class="card c12"><div class="ch"><h3>Earnings by country</h3></div>${table('adsc', adsCols([{ l: 'Country', v: (r) => r.d[0] }]), rows, { name: 'ad-countries', sort: 1 })}</div>`; }
  async function adsPlatforms() { const rows = await adsFetch(['PLATFORM_TYPE_NAME'], DEMO.adsPlatforms, 120); return `<div class="card c4"><div class="ch"><h3>Earnings by platform</h3></div>${donut(rows.map((r, i) => ({ n: r.d[0], v: r.e, c: PAL[i % PAL.length] })))}</div><div class="card c8"><div class="ch"><h3>Platforms</h3></div>${table('adsp', adsCols([{ l: 'Platform', v: (r) => r.d[0] }]), rows, { name: 'platforms', sort: 1, size: 6 })}</div>`; }
  async function adsUnits() { const rows = await adsFetch(['AD_UNIT_NAME'], DEMO.adsUnits, 120); return `<div class="card c12"><div class="ch"><h3>Ad units</h3><span class="sp sub">Which ad placements earn most</span></div>${table('adsu', adsCols([{ l: 'Ad unit', v: (r) => r.d[0] }]), rows, { name: 'ad-units', sort: 1 })}</div>`; }
  async function adsPayments() {
    const ex = real() ? await PX.adsExtras() : { unpaid: 63.4, currency: '$', payments: [{ name: 'a', amount: '$102.30', date: { year: 2026, month: 10, day: 21 } }, { name: 'b', amount: '$118.74', date: { year: 2026, month: 9, day: 22 } }], account: { displayName: 'Demo account', timeZone: { id: 'Asia/Kolkata' }, state: 'READY' } };
    const ymd = (d) => (d ? new Date(d.year, d.month - 1, d.day || 1).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '-'), a = ex.account || {};
    return `<div class="card c4"><div class="ch"><h3>Unpaid balance</h3></div><div style="font-size:30px;font-weight:700">${ex.unpaid == null ? '-' : esc(ex.currency || '$') + ex.unpaid.toFixed(2)}</div><div class="sub">Paid when it reaches the payout threshold</div><div class="prog" style="height:10px"><i style="width:${Math.min(100, ex.unpaid || 0)}%;background:var(--ok)"></i></div></div>`
      + `<div class="card c8"><div class="ch"><h3>Account</h3></div><div class="list"><div class="li"><div class="t"><b>${esc(a.displayName || '-')}</b><span>${esc(a.name || '')}</span></div><span class="tag ${a.state === 'READY' ? 'ok' : 'warn'}">${esc((a.state || '-').toLowerCase().replace(/_/g, ' '))}</span></div><div class="li"><div class="t"><b>Time zone</b></div>${esc((a.timeZone && a.timeZone.id) || '-')}</div></div></div>`
      + `<div class="card c12"><div class="ch"><h3>Payment history</h3></div>${table('adspay', [{ l: 'Date', v: (r) => (r.date ? `${r.date.year}-${String(r.date.month).padStart(2, '0')}` : ''), h: (r) => ymd(r.date) }, { l: 'Amount', n: 1, v: (r) => parseFloat(String(r.amount || '0').replace(/[^0-9.]/g, '')), h: (r) => esc(r.amount || '-') }], ex.payments || [], { name: 'payments', sort: 0 })}</div>`;
  }
  async function adsApproval() {
    const ex = real() ? await PX.adsExtras() : { sites: DEMO.adsSites.map((d, i) => ({ domain: d, state: i === 4 ? 'GETTING_READY' : 'READY', autoAdsEnabled: i !== 3 })), account: { name: 'accounts/pub-0000000000000000' } };
    const pub = ((ex.account && ex.account.name) || '').replace('accounts/', '');
    const known = new Set(ex.sites.map((s) => s.domain)), extra = hosts().filter((h) => ![...known].some((k) => h === k || h.endsWith('.' + k)));
    const row = (s) => { const x = ADS_STATE[s.state] || [s.state, 'mute']; return `<div class="li" data-adsrow="${esc(s.domain)}" style="flex-wrap:wrap"><div class="t"><b>${esc(s.domain)}</b><span>${s.autoAdsEnabled ? 'Auto ads on' : 'Auto ads off'}</span></div><span class="tag ${x[1]}">${x[0]}</span><button class="btn o sm" data-adscheck="${esc(s.domain)}" data-pub="${esc(pub)}">Check code on site</button><div class="adsres" style="width:100%"></div></div>`; };
    return `<div class="card c12"><div class="ch"><div><h3>Sites in AdSense</h3><div class="sub">Approval status from Google, and a live check of the AdSense code and ads.txt on each site</div></div></div><div class="list">${ex.sites.map(row).join('') || '<p class="empty">No sites in this AdSense account yet.</p>'}</div></div>`
      + (extra.length ? `<div class="card c12"><div class="ch"><h3>Not in AdSense yet</h3></div><p class="sub" style="margin-bottom:8px">Add these in AdSense > Sites to earn from them:</p><div class="list">${extra.map((h) => `<div class="li"><div class="t"><b>${esc(h)}</b></div><span class="tag mute">Not added</span><a class="btn o sm" href="https://adsense.google.com/adsense/new/u/0/${esc(pub)}/sites/my-sites" target="_blank" rel="noopener">Add in AdSense</a></div>`).join('')}</div></div>` : '')
      + `<div class="card c12"><div class="ch"><h3>How to get approved</h3></div><ol class="pgs" style="list-style:decimal;margin-left:20px"><li>Add the site in AdSense > Sites.</li><li>Paste the AdSense code in the &lt;head&gt; of every page (use "Check code on site" to confirm).</li><li>Create <b>/ads.txt</b> with the line <code>google.com, ${esc(pub || 'pub-XXXXXXXXXXXXXXXX')}, DIRECT, f08c47fec0942fa0</code>.</li><li>Have real content (about 250+ words per page), plus Privacy Policy, About and Contact pages.</li><li>Request the review in AdSense. It can take a few days to 4 weeks.</li></ol></div>`;
  }
  document.addEventListener('click', async (e) => {
    let el;
    if ((el = e.target.closest('[data-adscheck]'))) {
      const h = el.dataset.adscheck, pub = el.dataset.pub, out = el.closest('[data-adsrow]').querySelector('.adsres'); el.disabled = true; out.innerHTML = '<span class="spin"></span>';
      const [home, ads] = await Promise.all([TL.grab(`https://${h}/`), TL.grab(`https://${h}/ads.txt`)]);
      const code = /adsbygoogle|pagead2\.googlesyndication|ca-pub-\d+/.test(home.text || ''), line = pub && new RegExp(pub.replace('pub-', 'pub-?'), 'i').test(ads.text || '');
      out.innerHTML = `<span class="tag ${code ? 'ok' : 'bad'}">${code ? 'AdSense code found' : 'AdSense code missing on home page'}</span> <span class="tag ${ads.ok ? (line ? 'ok' : 'warn') : 'bad'}">${ads.ok ? (line ? 'ads.txt has your line' : 'ads.txt has no line for ' + esc(pub)) : 'ads.txt missing (HTTP ' + (ads.status || 'error') + ')'}</span>`; el.disabled = false;
    } else if ((el = e.target.closest('[data-act="inspectTop"]'))) inspectTop(el);
    else if ((el = e.target.closest('[data-gam]'))) { S.gam = el.dataset.gam; save(); rerender(); }
    else if ((el = e.target.closest('[data-gsm]'))) { S.gsm = el.dataset.gsm; save(); rerender(); }
    else if ((el = e.target.closest('[data-gdev]'))) { S.gdev = el.dataset.gdev; save(); rerender(); }
  });

  window.SEC = { analytics, search, adsense, cleanup: null };
})();
