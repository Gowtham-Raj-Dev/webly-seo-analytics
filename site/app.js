/* Webly app shell + views. Real data (PX, api.js) or demo data; tools in tools.js; Firebase login + directory in dir.js.
   Rename the product in one place: BRAND. */
const BRAND = { name: 'Webly', host: 'webly.codelove.in' };

/* ---------- state ---------- */
const S = { theme: 'light', demo: false, conn: { ga: false, gsc: false, ads: false }, site: 'all', range: 28, kpi: 'users', off: {}, manual: [], user: null };
try { const o = JSON.parse(localStorage.getItem('pulse_state3') || '{}'); delete o.user; Object.assign(S, o); } catch (e) { /* ignore */ }
const save = () => { try { const { user, ...o } = S; localStorage.setItem('pulse_state3', JSON.stringify(o)); } catch (e) { /* ignore */ } };
document.documentElement.dataset.theme = S.theme;
const X = {};            // extra data for the current route (real mode)
let DIRLIST = null, MINE = new Set(), DIRERR = '';
let cleanup = null, loadKey = '';

/* ---------- icons ---------- */
const P = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z', chart: 'M3 3v18h18M7 15l4-4 3 3 5-6',
  search: 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM21 21l-4.3-4.3', dollar: 'M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  tools: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z',
  file: 'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M9 13h6M9 17h6',
  plug: 'M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z', chev: 'M6 9l6 6 6-6',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z',
  pulse: 'M22 12h-4l-3 9L9 3l-3 9H2', unlink: 'M18.8 11.2l2-2a5 5 0 0 0-7-7l-2 2M5.2 12.8l-2 2a5 5 0 0 0 7 7l2-2M8 2v3M2 8h3M16 22v-3M22 16h-3',
  trend: 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6', bolt: 'M13 2 3 14h9l-1 8 10-12h-9z',
  tag: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01',
  checkp: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11', mark: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1', down: 'M12 3v12M7 10l5 5 5-5M4 21h16', refresh: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5',
  logout: 'M9 21H5V3h4M16 17l5-5-5-5M21 12H9', arrow: 'M5 12h14M13 6l6 6-6 6',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', cursor: 'M3 3l7 18 2.5-7.5L20 11z',
  spark: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z', plus: 'M12 5v14M5 12h14', x: 'M18 6 6 18M6 6l12 12', ok: 'M20 6 9 17l-5-5',
  ext: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'
};
const I = (n, s) => `<svg class="i" viewBox="0 0 24 24"${s ? ` style="width:${s}px;height:${s}px"` : ''}><path d="${P[n] || P.globe}"/></svg>`;

/* ---------- helpers ---------- */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rnd = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const fmt = (n) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'K' : n >= 1e3 ? (n / 1e3).toFixed(2) + 'K' : String(Math.round(n));
const money = (n) => '$' + n.toFixed(2);
const sum = (a) => a.reduce((x, y) => x + y, 0);
const COLORS = ['#4f46e5', '#db2777', '#0891b2', '#d97706', '#16a34a', '#7c3aed', '#0284c7', '#dc2626'];
const mk = (d, n) => ({ d, n: n || d.split('.')[0].replace(/^./, (c) => c.toUpperCase()), c: COLORS[hash(d) % COLORS.length] });
const toast = (m) => { const t = document.getElementById('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600); };
const dayLabels = (days) => { const o = [], d = new Date(); for (let i = days - 1; i >= 0; i--) o.push(new Date(d - i * 864e5).toLocaleDateString('en', { month: 'short', day: 'numeric' })); return o; };
const real = () => !S.demo && Object.values(S.conn).some(Boolean);
const connCount = () => Object.values(S.conn).filter(Boolean).length;
const signed = () => !!(S.user || S.demo);

/* ---------- sites ---------- */
const DEMO = ['codelove.in', 'games.codelove.in', 'videomaker.codelove.in', 'apps.codelove.in', 'linkinbio.codelove.in'].map((d, i) => mk(d, ['CodeLove', 'Games', 'Video Maker', 'Apps Store', 'Link in Bio'][i]));
function allSites() {
  const base = S.demo ? DEMO : (PX.R.loaded && real() ? PX.R.sites.map((s) => ({ ...mk(s.d), ga: s.ga, gsc: s.gsc, ads: s.ads, verified: true })) : []);
  const have = new Set(base.map((s) => s.d));
  return [...base, ...S.manual.filter((d) => !have.has(d)).map((d) => ({ ...mk(d), manual: true }))];
}
const enabled = () => allSites().filter((s) => !S.off[s.d]);
const activeSites = () => enabled().filter((s) => S.site === 'all' || S.site === s.d);

/* ---------- metrics ---------- */
function series(key, days, base, vol = .25, trend = .6) {
  const r = rnd(hash(key + days)); const out = []; let v = base;
  for (let i = 0; i < days; i++) { const wk = 1 + .18 * Math.sin(i / 7 * Math.PI * 2); v = base * (1 + trend * i / days) * wk * (1 + (r() - .5) * vol); out.push(Math.max(0, v)); }
  return out;
}
function realArr(key, hosts) { const n = S.range, tot = new Array(n * 2).fill(0); hosts.forEach((h) => { const a = (PX.R.ser[key] || {})[h]; if (a) a.forEach((v, i) => { tot[i] += v; }); }); return { prev: tot.slice(0, n), cur: tot.slice(n) }; }
function metric(key) {
  const days = S.range, sites = activeSites();
  if (!S.demo) {
    const a = realArr(key, sites.map((s) => s.d)), t = sum(a.cur), p = sum(a.prev);
    return { cur: a.cur, prev: a.prev, total: key === 'rev' ? t : Math.round(t), delta: p ? (t - p) / p * 100 : 0 };
  }
  const base = { users: 420, sessions: 610, clicks: 150, impr: 5200, rev: 2.4 }[key];
  const cur = new Array(days).fill(0), prev = new Array(days).fill(0);
  sites.forEach((s, i) => { const k = 1 / (1 + i * .55), a = series(key + s.d, days * 2, base * k, .3, .5); a.slice(days).forEach((v, j) => { cur[j] += v; }); a.slice(0, days).forEach((v, j) => { prev[j] += v; }); });
  const t = sum(cur), p = sum(prev);
  return { cur, prev, total: key === 'rev' ? t : Math.round(t), delta: p ? (t - p) / p * 100 : 0 };
}
function siteTotal(key, host) { // current period total for one site
  if (!S.demo) return sum(realArr(key, [host]).cur);
  const i = Math.max(0, enabled().findIndex((s) => s.d === host)), k = 1 / (1 + i * .55);
  const base = { users: 420, sessions: 610, clicks: 150, impr: 5200, rev: 2.4 }[key] || 100;
  return sum(series(key + host, S.range * 2, base * k, .3, .5).slice(S.range));
}
const totalsOf = (key) => { const a = realArr(key, activeSites().map((s) => s.d)); return [sum(a.cur), sum(a.prev)]; };

/* ---------- charts ---------- */
const CH = {};
function smooth(pts) {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2, t = .18;
    d += `C${p1[0] + (p2[0] - p0[0]) * t},${p1[1] + (p2[1] - p0[1]) * t} ${p2[0] - (p3[0] - p1[0]) * t},${p2[1] - (p3[1] - p1[1]) * t} ${p2[0]},${p2[1]}`;
  }
  return d;
}
const pts = (vals, min, max, W = 800, H = 260) => vals.map((v, i) => [vals.length < 2 ? 0 : i / (vals.length - 1) * W, 18 + (1 - (v - min) / ((max - min) || 1)) * (H - 30)]);
function lineChart(id, ser, labels, h = 260, f = fmt) {
  const all = ser.flatMap((s) => s.v), max = (Math.max(...all, 1)) * 1.08, min = 0;
  CH[id] = { ser, labels, max, f };
  const grid = [0, .25, .5, .75, 1].map((g) => { const y = 18 + (1 - g) * 230; return `<line x1="0" x2="800" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="1" vector-effect="non-scaling-stroke" stroke-dasharray="${g ? '3 5' : '0'}"/>`; }).join('');
  const ylab = [1, .75, .5, .25, 0].map((g) => `<span style="position:absolute;left:0;top:${(18 + (1 - g) * 230) / 260 * 100}%;transform:translateY(-50%);font-size:11px;color:var(--tx3)">${f(max * g)}</span>`).join('');
  const paths = ser.map((s, k) => { const p = pts(s.v, min, max), line = smooth(p); return `<defs><linearGradient id="g${id}${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.c}" stop-opacity=".22"/><stop offset="1" stop-color="${s.c}" stop-opacity="0"/></linearGradient></defs>${k === 0 ? `<path d="${line}L800,260L0,260Z" fill="url(#g${id}${k})"/>` : ''}<path d="${line}" fill="none" stroke="${s.c}" stroke-width="2.4" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`; }).join('');
  const xl = [0, .25, .5, .75, 1].map((g) => labels[Math.round(g * (labels.length - 1))]);
  return `<div style="padding-left:38px"><div class="chart" data-cid="${id}" style="height:${h}px"><div style="position:absolute;left:-38px;top:0;bottom:0;width:36px">${ylab}</div><svg viewBox="0 0 800 260" preserveAspectRatio="none">${grid}${paths}</svg><i class="hv" style="position:absolute;top:0;bottom:0;width:1px;background:var(--a2);opacity:0;left:0"></i>${ser.map((s, k) => `<i class="hd" data-k="${k}" style="position:absolute;width:12px;height:12px;margin:-6px;border-radius:50%;background:${s.c};border:3px solid var(--card);opacity:0"></i>`).join('')}<div class="tip"></div></div><div style="display:flex;justify-content:space-between;color:var(--tx3);font-size:11px;margin-top:6px">${xl.map((x) => `<span>${x}</span>`).join('')}</div></div>`;
}
function bindCharts() {
  document.querySelectorAll('.chart[data-cid]').forEach((el) => {
    const c = CH[el.dataset.cid]; if (!c) return;
    const tip = el.querySelector('.tip'), hv = el.querySelector('.hv'), dots = el.querySelectorAll('.hd');
    const hide = () => { tip.style.opacity = 0; hv.style.opacity = 0; dots.forEach((d) => { d.style.opacity = 0; }); };
    el.onmouseleave = hide;
    el.onmousemove = (e) => {
      const r = el.getBoundingClientRect(), n = c.ser[0].v.length;
      const i = Math.max(0, Math.min(n - 1, Math.round((e.clientX - r.left) / r.width * (n - 1)))), x = n < 2 ? 0 : i / (n - 1) * 100;
      hv.style.left = x + '%'; hv.style.opacity = .5;
      dots.forEach((d, k) => { const v = c.ser[k].v[i]; d.style.left = x + '%'; d.style.top = (18 + (1 - v / c.max) * 230) / 260 * 100 + '%'; d.style.opacity = 1; });
      tip.innerHTML = `<span style="opacity:.7">${c.labels[i]}</span>` + c.ser.map((s) => `<b>${c.f(s.v[i])} <span style="font-weight:500;opacity:.7;font-size:11px">${esc(s.n)}</span></b>`).join('');
      tip.style.left = Math.max(12, Math.min(88, x)) + '%'; tip.style.top = Math.max(18, (18 + (1 - c.ser[0].v[i] / c.max) * 230) / 260 * 100) + '%'; tip.style.opacity = 1;
    };
  });
}
const spark = (v, c) => { if (v.length < 2) return ''; const p = pts(v, Math.min(...v), Math.max(...v), 100, 40); return `<svg class="spark" viewBox="0 0 100 40" preserveAspectRatio="none"><path d="${smooth(p)}" fill="none" stroke="${c}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`; };
function donut(items) {
  const tot = sum(items.map((i) => i.v)) || 1; let off = 0; const R = 52, C = 2 * Math.PI * R;
  const segs = items.map((i) => { const l = i.v / tot * C; const s = `<circle r="${R}" cx="70" cy="70" fill="none" stroke="${i.c}" stroke-width="16" stroke-dasharray="${Math.max(l - 3, 0)} ${C - l + 3}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"/>`; off += l; return s; }).join('');
  return `<div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap"><svg viewBox="0 0 140 140" style="width:130px;height:130px;flex:none">${segs}<text x="70" y="66" text-anchor="middle" fill="var(--tx)" font-weight="700" font-size="20">${fmt(tot)}</text><text x="70" y="84" text-anchor="middle" fill="var(--tx3)" font-size="10">total</text></svg><div style="flex:1;min-width:130px;display:flex;flex-direction:column;gap:8px">${items.map((i) => `<div style="display:flex;align-items:center;gap:8px"><i style="width:10px;height:10px;border-radius:3px;background:${i.c}"></i><span style="flex:1;color:var(--tx2)">${esc(i.n)}</span><b>${Math.round(i.v / tot * 100)}%</b></div>`).join('')}</div></div>`;
}
const PAL = ['#4f46e5', '#0891b2', '#db2777', '#d97706', '#16a34a', '#7c3aed'];
const delta = (d) => `<span class="dl ${d >= 0 ? 'up' : 'dn'}">${d >= 0 ? '&#9650;' : '&#9660;'} ${Math.abs(d).toFixed(1)}%</span>`;
const fav = (s) => `<span class="fav" style="background:${s.c}">${esc(s.n[0])}</span>`;
const kpiTile = (l, v, d, ic) => `<div class="card kpi c3"><div class="kh"><span class="tile">${I(ic, 16)}</span>${d == null ? '' : delta(d)}</div><div class="v">${v}</div><div class="l">${l}</div></div>`;
const kpis = (a) => `<div class="c12 bento kpis" style="grid-column:span 12">${a.join('')}</div>`;
const none = (k, t) => `<div class="card c12 empty"><div style="width:48px;height:48px;border-radius:12px;background:var(--card2);display:grid;place-items:center;margin:0 auto 12px;color:var(--a2)">${I('plug', 24)}</div><h3 style="font-size:17px">Connect ${t} to see this</h3><p style="margin:6px 0 16px">One Google sign-in, read-only access. You can disconnect any time.</p><button class="btn p" data-act="connect" data-k="${k}">Connect ${t}</button></div>`;
const NAMES = { ga: 'Google Analytics', gsc: 'Search Console', ads: 'AdSense' };

/* ---------- shell ---------- */
const NAV = [['', 'home', 'Overview'], ['analytics', 'chart', 'Analytics', 'ga'], ['search', 'search', 'Search Console', 'gsc'], ['adsense', 'dollar', 'AdSense', 'ads'], ['H', 'Workspace'], ['tools', 'tools', 'Tools', '8'], ['reports', 'file', 'Reports'], ['H', 'Community'], ['explore', 'globe', 'Explore sites'], ['H', 'Account'], ['connect', 'plug', 'Connections']];
const TITLES = { '': ['Overview', 'Everything about your sites, in one place'], analytics: ['Analytics', 'Visitors from Google Analytics'], search: ['Search Console', 'How you show up on Google'], adsense: ['AdSense', 'Your earnings and site approval'], tools: ['Tools', '8 helpers that check your sites for you'], reports: ['Reports', 'One click report you can read or hand to an AI'], connect: ['Connections', 'Link your Google account and choose sites'], explore: ['Explore sites', `Websites that chose to be shown on ${BRAND.name}`] };
const route = () => (location.hash.replace(/^#\/?/, '').split('?')[0].split('/')[0]) || '';
const toolId = () => location.hash.replace(/^#\/?/, '').split('?')[0].split('/')[1] || '';

function shell(r) {
  const nav = NAV.map((n) => n[0] === 'H' ? `<h6>${n[1]}</h6>` : `<a href="#/${n[0]}" class="${r === n[0] ? 'on' : ''}">${I(n[1])}<span>${n[2]}</span>${n[3] ? `<em class="pill" style="font-style:normal">${n[3] === '8' ? '8' : (S.conn[n[3]] || S.demo ? '&#9679;' : '&#9675;')}</em>` : ''}</a>`).join('');
  const sites = enabled(), cur = S.site === 'all' ? null : sites.find((s) => s.d === S.site);
  const tt = TITLES[r] || TITLES[''], showCtl = ['', 'analytics', 'search', 'adsense'].includes(r);
  const nm = S.demo ? 'Demo user' : (S.user && S.user.name) || 'You', em = S.demo ? 'demo data' : (S.user && S.user.email) || '';
  return `<div class="shell"><aside class="side"><div class="brand"><span class="logo">${I('pulse')}</span>${BRAND.name}</div><nav class="nav">${nav}</nav>
    <div class="upgrade"><b>${S.demo ? 'Demo mode' : connCount() + '/3 connected'}</b><small>${S.demo ? 'Showing sample numbers.' : connCount() === 3 ? 'All sources are live.' : 'Connect the rest to unlock every report.'}</small><br><button data-go="connect">${S.demo ? 'Use my data' : connCount() === 3 ? 'Manage' : 'Connect now'}</button></div></aside>
    <main class="main"><div class="top"><div class="title"><h1>${tt[0]}</h1><p>${tt[1]}</p></div>
      ${showCtl ? `<div class="menu" id="mSite"><button class="ctl" data-menu="mSite">${cur ? fav(cur) : `<span class="fav" style="background:var(--a1)">${I('globe', 15)}</span>`}<span>${cur ? esc(cur.n) : 'All sites'}</span>${I('chev', 16)}</button><div class="drop"><a data-site="all" class="${S.site === 'all' ? 'on' : ''}"><span class="fav" style="background:var(--a1)">${I('globe', 15)}</span>All sites</a>${sites.map((s) => `<a data-site="${esc(s.d)}" class="${S.site === s.d ? 'on' : ''}">${fav(s)}<span><b style="display:block">${esc(s.n)}</b><small style="color:var(--tx3)">${esc(s.d)}</small></span></a>`).join('')}</div></div>
      <div class="seg">${[7, 28, 90].map((d) => `<button data-range="${d}" class="${S.range === d ? 'on' : ''}">${d}d</button>`).join('')}</div>` : ''}
      <button class="ctl icon" data-act="theme" title="Theme">${I(S.theme === 'dark' ? 'sun' : 'moon')}</button>
      <div class="menu" id="mUser"><button class="avatar" data-menu="mUser">${esc(nm[0].toUpperCase())}</button><div class="drop"><div style="padding:10px 12px"><b>${esc(nm)}</b><br><small style="color:var(--tx3)">${esc(em)}</small></div><button data-act="logout">${I('logout', 18)} Sign out</button></div></div></div>
    <div id="banner"></div><div id="view" class="bento"></div></main></div>`;
}

/* ---------- real-data plumbing ---------- */
async function ensureData() {
  if (!real()) return;
  const k = S.range + '|' + Object.keys(S.conn).filter((c) => S.conn[c]).join();
  if (loadKey === k && PX.R.loaded) return;
  await PX.load(S.conn, S.range); loadKey = k;
}
function banner() {
  const b = document.getElementById('banner'); if (!b) return; let h = '';
  if (real()) {
    const stale = Object.keys(S.conn).filter((k) => S.conn[k] && !PX.has(k));
    if (stale.length) h += `<div class="card" style="border-color:var(--warn);display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:16px"><span class="tag warn">Session ended</span><span style="flex:1;min-width:200px">Google access lasts one hour. Reconnect to load fresh numbers.</span>${stale.map((k) => `<button class="btn p sm" data-act="connect" data-k="${k}">Reconnect ${NAMES[k]}</button>`).join('')}</div>`;
    const seen = new Set();
    (PX.R.errors || []).forEach((e) => { if (e.need || seen.has(e.message)) return; seen.add(e.message); h += `<div class="card" style="border-color:var(--bad);margin-bottom:16px"><span class="tag bad">Problem</span> ${esc(e.message)}${e.enable ? ` <span class="sub">(Webly admin: enable ${e.enable.join(', ')} in the Google Cloud project of the OAuth client.)</span>` : ''}</div>`; });
  }
  b.innerHTML = h;
}
function bestGsc() { const c = activeSites().filter((s) => PX.R.gscMap && PX.R.gscMap[s.d]).sort((a, b) => siteTotal('clicks', b.d) - siteTotal('clicks', a.d)); return c[0] && c[0].d; }
async function prefetch(r) {
  for (const k of Object.keys(X)) delete X[k];
  if (!real()) return;
  const hosts = activeSites().map((s) => s.d), sf = (p) => p.catch((e) => { X.err = e; return null; });
  if (r === '') {
    if (S.conn.ga && PX.has('ga')) X.live = await sf(PX.gaRealtime());
    if (S.conn.gsc && PX.has('gsc')) { const h = bestGsc(); if (h) { X.kwHost = h; X.kw = await sf(PX.keywords(h)); } }
    if (S.conn.ads && PX.has('ads')) X.adsx = await sf(PX.adsExtras());
  } else if (r === 'analytics' && S.conn.ga && PX.has('ga')) {
    [X.src, X.dev, X.cty, X.pages] = await Promise.all([sf(PX.gaBreakdown('sessionDefaultChannelGroup', hosts, 'sessions')), sf(PX.gaBreakdown('deviceCategory', hosts)), sf(PX.gaBreakdown('country', hosts)), sf(PX.gaBreakdown('pagePath', hosts, 'screenPageViews', 'pageTitle'))]);
  } else if (r === 'search' && S.conn.gsc && PX.has('gsc')) {
    const h = bestGsc(); if (h) { X.kwHost = h; [X.kw, X.maps] = await Promise.all([sf(PX.keywords(h)), sf(PX.sitemaps(h))]); }
  } else if (r === 'adsense' && S.conn.ads && PX.has('ads')) X.adsx = await sf(PX.adsExtras());
}
function demoKeywords(host) { const r = rnd(hash(host)); return ['free video maker', 'js game emulator', 'online video cutter', 'link in bio free', 'night heist game', 'java games online', 'video to gif', 'android apps store'].map((q, i) => ({ q, impr: Math.round(2000 * r() * (1 - i / 10) + 80), clicks: Math.round(120 * r() * (1 - i / 9)), pos: 3 + r() * 24, prev: 3 + r() * 24 })); }
const keywordsFor = async (host) => { if (S.demo) return demoKeywords(host); if (!S.conn.gsc) throw new Error('Connect Search Console to see Google keywords.'); if (!PX.has('gsc')) throw new Error('Reconnect Search Console first (Connections page).'); await ensureData(); return PX.keywords(host); };

/* ---------- views ---------- */
const V = {};
V[''] = () => {
  const cc = S.demo ? { ga: 1, gsc: 1, ads: 1 } : S.conn, u = metric('users'), c = metric('clicks'), im = metric('impr'), rv = metric('rev');
  const kp = [{ k: 'users', l: 'Visitors', i: 'users', m: u, src: 'ga', f: fmt }, { k: 'clicks', l: 'Google clicks', i: 'cursor', m: c, src: 'gsc', f: fmt }, { k: 'impr', l: 'Impressions', i: 'eye', m: im, src: 'gsc', f: fmt }, { k: 'rev', l: 'AdSense earnings', i: 'dollar', m: rv, src: 'ads', f: money }];
  const sel = kp.find((x) => x.k === S.kpi) || kp[0], lab = dayLabels(S.range), h = new Date().getHours();
  const hero = connCount() === 0 && !S.demo && !S.manual.length
    ? `<div class="card hero c12"><div><h2>Welcome to ${BRAND.name}</h2><p>Connect your Google account once. Your visitors, Google keywords and AdSense earnings will show up here for every site you own. No Google data? Add a site by hand and use the tools.</p></div><div class="row"><button class="btn p" data-go="connect">${I('plug', 16)} Connect Google</button><button class="btn o" data-act="demo">${I('spark', 16)} Try demo data</button></div></div>`
    : `<div class="card hero c12"><div><h2>Good ${h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'}${S.user ? ', ' + esc(S.user.name.split(' ')[0]) : ''}</h2><p>${cc.ga ? `${fmt(u.total)} visitors in the last ${S.range} days` : `${enabled().length} site${enabled().length === 1 ? '' : 's'} added`}${cc.ads ? ` and ${money(rv.total)} earned` : ''}. Here is what needs your attention.</p></div><div class="row"><button class="btn p" data-go="reports">${I('file', 16)} Generate report</button><button class="btn o" data-go="tools/health">${I('tools', 16)} Run site health</button></div></div>`;
  const live = cc.ga ? (() => {
    const L = S.demo ? { total: 12 + (hash(S.site) % 30), pages: activeSites().slice(0, 4).map((s, i) => [s.d, Math.max(1, 9 - i * 2 - (hash(s.d) % 3))]) } : (X.live || { total: 0, pages: [] });
    return `<div class="card c4"><div class="ch"><h3>Live now</h3><span class="sp tag ok">realtime</span></div><div class="live"><span class="pulse"></span><span class="big" id="liveN">${L.total}</span><span class="sub">people on your sites right now</span></div><div class="list" style="margin-top:12px">${L.pages.map((p) => `<div class="li"><div class="t"><b>${esc(p[0])}</b></div><b>${p[1]}</b></div>`).join('') || '<p class="sub">Nobody right now.</p>'}</div></div>`;
  })() : `<div class="card c4 empty"><p style="margin-bottom:12px">Connect Google Analytics for live visitors</p><button class="btn p sm" data-act="connect" data-k="ga">Connect</button></div>`;
  const todo = [];
  if (S.demo) todo.push(['bolt', 'Sitemap missing on Link in Bio', 'Submit it in Search Console so Google can find your pages.'], ['dollar', 'AdSense code missing on Apps Store', 'Earnings are being lost. Add the script and re-check.'], ['trend', '"free video maker" is #14', 'Move it to page 1 by adding it to the H1 and linking from 3 pages.']);
  else {
    if (cc.ga && cc.gsc) enabled().filter((s) => s.ga && !s.gsc).slice(0, 2).forEach((s) => todo.push(['search', `${s.d} is not in Search Console`, 'Add it in Search Console so you can see its Google keywords.']));
    if (cc.ga && u.delta < -20) todo.push(['trend', `Visitors dropped ${Math.abs(u.delta).toFixed(0)}%`, 'Compare with the previous period in Analytics and check your top pages.']);
    if (X.adsx && X.adsx.sites) X.adsx.sites.filter((s) => s.state && s.state !== 'READY').slice(0, 2).forEach((s) => todo.push(['dollar', `AdSense: ${s.domain} is ${String(s.state).toLowerCase().replace(/_/g, ' ')}`, 'Open AdSense > Sites and finish the steps shown there.']));
    (X.kw || []).filter((k) => k.pos > 10 && k.pos < 21 && k.impr > 20).slice(0, 2).forEach((k) => todo.push(['trend', `"${k.q}" is #${k.pos.toFixed(0)}`, 'Page 2 of Google. Add it to the title and H1 and link to the page from 3 others.']));
  }
  todo.push(['heart', 'Run a site health check', 'It takes about 20 seconds and checks all your sites.']);
  const kws = S.demo ? demoKeywords('x').slice(0, 4) : (X.kw || []).slice(0, 4);
  return hero + kpis(kp.map((x) => { const on = cc[x.src]; return `<div class="card kpi c3 ${sel.k === x.k ? 'on' : ''}" data-kpi="${x.k}" data-src="${x.src}"><div class="kh"><span class="tile">${I(x.i, 16)}</span>${on ? delta(x.m.delta) : '<span class="tag mute">not connected</span>'}</div><div class="v">${on ? x.f(x.m.total) : '-'}</div><div class="l">${x.l}</div>${on ? spark(x.m.cur, '#4f46e5') : ''}</div>`; }))
    + `<div class="card c8"><div class="ch"><div><h3>${sel.l}</h3><div class="sub">Last ${S.range} days vs the period before</div></div></div>${cc[sel.src] ? lineChart('ov', [{ n: sel.l, c: '#4f46e5', v: sel.m.cur }, { n: 'Previous', c: '#94a3b8', v: sel.m.prev }], lab, 270, sel.f) : `<div class="empty"><button class="btn p" data-act="connect" data-k="${sel.src}">Connect ${NAMES[sel.src]}</button></div>`}</div>${live}`
    + `<div class="card c6"><div class="ch"><h3>What to do</h3><span class="sp tag mute">${Math.min(todo.length, 5)} tasks</span></div>${todo.slice(0, 5).map((t) => `<div class="todo"><span class="ic">${I(t[0], 16)}</span><div><b>${esc(t[1])}</b><span>${esc(t[2])}</span></div></div>`).join('')}</div>`
    + `<div class="card c6"><div class="ch"><h3>Top keywords</h3><span class="sp sub">${X.kwHost ? esc(X.kwHost) : 'Google position'}</span></div>${cc.gsc ? (kws.length ? `<div class="list">${kws.map((k) => `<div class="li"><span class="rank">${Math.round(k.pos)}</span><div class="t"><b>${esc(k.q)}</b><span>${fmt(k.impr)} impressions</span></div></div>`).join('')}</div>` : '<p class="empty">No keyword data yet.</p>') : `<div class="empty"><button class="btn p sm" data-act="connect" data-k="gsc">Connect Search Console</button></div>`}</div>`
    + `<div class="card c12"><div class="ch"><h3>Your sites</h3><span class="sp sub">${activeSites().length} site${activeSites().length === 1 ? '' : 's'}</span></div>${activeSites().length ? `<div style="overflow:auto"><table><tr><th>Site</th><th class="n">Visitors</th><th class="n">Clicks</th><th class="n">Earnings</th><th></th></tr>${activeSites().map((s) => `<tr class="h"><td><span class="site">${fav(s)}<span>${esc(s.n)}<br><small style="color:var(--tx3);font-weight:500">${esc(s.d)}</small></span></span></td><td class="n">${cc.ga ? fmt(siteTotal('users', s.d)) : '-'}</td><td class="n">${cc.gsc ? fmt(siteTotal('clicks', s.d)) : '-'}</td><td class="n">${cc.ads ? money(siteTotal('rev', s.d)) : '-'}</td><td class="n"><a class="btn o sm" href="#/tools/health?site=${encodeURIComponent(s.d)}">Check health</a></td></tr>`).join('')}</table></div>` : `<div class="empty"><p style="margin-bottom:12px">No sites yet.</p><button class="btn p sm" data-go="connect">Add a site</button></div>`}</div>`;
};

V.analytics = () => {
  if (!S.demo && !S.conn.ga) return none('ga', 'Google Analytics');
  const u = metric('users'), se = metric('sessions'), lab = dayLabels(S.range);
  let t2, t3, srcs, devs, ctys, pages;
  if (S.demo) { t2 = '1m 42s'; t3 = '41%'; srcs = [['Organic Search', 54], ['Direct', 21], ['Social', 14], ['Other', 11]]; devs = [['mobile', 68], ['desktop', 27], ['tablet', 5]]; ctys = [['India', 62], ['United States', 14], ['United Kingdom', 6], ['Singapore', 4], ['Germany', 3]]; pages = [['/', 'Home'], ['/video-maker', 'Video Maker'], ['/games/night-heist', 'Night Heist'], ['/apps', 'Apps'], ['/emulator', 'Java Emulator']].map((p, i) => [p[0], p[1], Math.round(u.total * (1.9 - i * .28))]); }
  else {
    const [sc] = totalsOf('sec'), [ec] = totalsOf('eng'), [ss] = totalsOf('sessions'), [uu] = totalsOf('users');
    t2 = uu ? `${Math.floor(sc / uu / 60)}m ${Math.round(sc / uu % 60)}s` : '-'; t3 = ss ? Math.round((1 - ec / ss) * 100) + '%' : '-';
    srcs = (X.src || []).map((r) => [r.k[0], r.v]); devs = (X.dev || []).map((r) => [r.k[0], r.v]); const ct = (X.cty || []), ctt = sum(ct.map((r) => r.v)) || 1; ctys = ct.slice(0, 6).map((r) => [r.k[0], Math.round(r.v / ctt * 100)]); pages = (X.pages || []).slice(0, 8).map((r) => [r.k[0], r.k[1], r.v]);
  }
  const dn = (a) => donut(a.map((r, i) => ({ n: r[0], v: r[1], c: PAL[i % PAL.length] })));
  const pmax = Math.max(1, ...pages.map((p) => p[2]));
  return kpis([kpiTile('Users', fmt(u.total), u.delta, 'users'), kpiTile('Sessions', fmt(se.total), se.delta, 'eye'), kpiTile('Avg. time per user', t2, null, 'pulse'), kpiTile('Bounce rate', t3, null, 'cursor')])
    + `<div class="card c8"><div class="ch"><div><h3>Users and sessions</h3><div class="sub">Daily, last ${S.range} days</div></div></div>${lineChart('an', [{ n: 'Users', c: '#4f46e5', v: u.cur }, { n: 'Sessions', c: '#94a3b8', v: se.cur }], lab)}</div>`
    + `<div class="card c4"><div class="ch"><h3>Where visitors come from</h3></div>${srcs.length ? dn(srcs) : '<p class="empty">No data</p>'}<div class="ch" style="margin-top:22px"><h3>Devices</h3></div>${devs.length ? dn(devs) : '<p class="empty">No data</p>'}</div>`
    + `<div class="card c7"><div class="ch"><h3>Top pages</h3></div>${pages.length ? `<table><tr><th>Page</th><th class="n">Views</th><th>Share</th></tr>${pages.map((p) => `<tr class="h"><td><b>${esc(p[1] || p[0])}</b><br><small style="color:var(--tx3)">${esc(p[0])}</small></td><td class="n">${fmt(p[2])}</td><td style="width:32%"><div class="bar"><i style="width:${p[2] / pmax * 100}%"></i></div></td></tr>`).join('')}</table>` : '<p class="empty">No page data yet.</p>'}</div>`
    + `<div class="card c5"><div class="ch"><h3>Top countries</h3></div><div class="list">${ctys.map((c) => `<div class="li"><span class="rank">${esc(String(c[0])[0])}</span><div class="t"><b>${esc(c[0])}</b><div class="bar" style="margin-top:6px"><i style="width:${Math.min(100, c[1] * 1.4)}%"></i></div></div><b>${c[1]}%</b></div>`).join('') || '<p class="empty">No data</p>'}</div></div>`;
};

V.search = () => {
  if (!S.demo && !S.conn.gsc) return none('gsc', 'Search Console');
  const c = metric('clicks'), im = metric('impr'), lab = dayLabels(S.range);
  const [tc] = totalsOf('clicks'), [ti] = totalsOf('impr'), pw = totalsOf('posw');
  const ctr = S.demo ? '3.4%' : (ti ? (tc / ti * 100).toFixed(1) + '%' : '-'), pos = S.demo ? '11.8' : (ti ? (pw[0] / ti).toFixed(1) : '-');
  const kw = S.demo ? demoKeywords('x') : (X.kw || []), maps = X.maps || [];
  return kpis([kpiTile('Clicks', fmt(c.total), c.delta, 'cursor'), kpiTile('Impressions', fmt(im.total), im.delta, 'eye'), kpiTile('Avg. CTR', ctr, null, 'bolt'), kpiTile('Avg. position', pos, null, 'trend')])
    + `<div class="card c8"><div class="ch"><div><h3>Clicks and impressions</h3><div class="sub">Impressions are divided by 20 to fit the same chart</div></div></div>${lineChart('sc', [{ n: 'Clicks', c: '#4f46e5', v: c.cur }, { n: 'Impressions / 20', c: '#94a3b8', v: im.cur.map((x) => x / 20) }], lab)}</div>`
    + `<div class="card c4"><div class="ch"><h3>Sitemaps</h3><span class="sp sub">${X.kwHost ? esc(X.kwHost) : ''}</span></div>${S.demo ? donut([{ n: 'Indexed', v: 86, c: '#16a34a' }, { n: 'Not indexed', v: 9, c: '#dc2626' }, { n: 'Excluded', v: 5, c: '#d97706' }]) : (maps.length ? maps.map((m) => `<div class="todo"><div><b style="word-break:break-all">${esc(m.path.replace(/^https?:\/\//, ''))}</b><span>${m.errors ? `<span class="tag bad">${m.errors} errors</span> ` : '<span class="tag ok">OK</span> '}${m.warnings ? `<span class="tag warn">${m.warnings} warnings</span> ` : ''}${m.submitted ? fmt(m.submitted) + ' URLs submitted' : ''}</span></div></div>`).join('') : '<p class="sub">No sitemap submitted for this site. In Search Console > Sitemaps add <b>sitemap.xml</b>.</p>')}</div>`
    + `<div class="card c12"><div class="ch"><h3>Keywords</h3><span class="sp sub">What people typed to find you${X.kwHost ? ' · ' + esc(X.kwHost) : ''}</span></div>${kw.length ? `<div style="overflow:auto"><table><tr><th>Keyword</th><th class="n">Impressions</th><th class="n">Clicks</th><th class="n">Position</th><th class="n">Change</th><th></th></tr>${kw.slice(0, 25).map((k) => { const d = k.prev ? k.prev - k.pos : 0; return `<tr class="h"><td><b>${esc(k.q)}</b></td><td class="n">${fmt(k.impr)}</td><td class="n">${fmt(k.clicks)}</td><td class="n"><span class="tag ${k.pos <= 10 ? 'ok' : 'warn'}">${k.pos.toFixed(1)}</span></td><td class="n">${k.prev ? `<span class="dl ${d >= 0 ? 'up' : 'dn'}">${d >= 0 ? '&#9650;' : '&#9660;'} ${Math.abs(d).toFixed(1)}</span>` : '<span class="sub">new</span>'}</td><td class="n"><a class="btn o sm" href="https://www.google.com/search?q=${encodeURIComponent(k.q)}" target="_blank" rel="noopener">Google page</a></td></tr>`; }).join('')}</table></div>` : '<p class="empty">No keyword data yet for this site.</p>'}</div>`;
};

const ADS_STATE = { READY: ['Ready', 'ok'], GETTING_READY: ['Getting ready', 'warn'], REQUIRES_REVIEW: ['Requires review', 'warn'], NEEDS_ATTENTION: ['Needs attention', 'bad'] };
const demoAdsRows = () => DEMO.map((s, i) => ({ d: s.d, st: i === 4 ? 'GETTING_READY' : 'READY', auto: i !== 3, e: siteTotal('rev', s.d) }));
V.adsense = () => {
  if (!S.demo && !S.conn.ads) return none('ads', 'AdSense');
  const rv = metric('rev'), lab = dayLabels(S.range), ex = X.adsx || {};
  const [pv] = totalsOf('adpv'), [ck] = totalsOf('adclk'), [ad] = totalsOf('adimp');
  const rpm = S.demo ? 1.84 : (pv ? rv.total / pv * 1000 : 0), bal = S.demo ? 63.4 : (ex.unpaid == null ? null : ex.unpaid), cu = S.demo ? '$' : (ex.currency || '$'), perDay = rv.total / S.range;
  const rows = S.demo ? demoAdsRows() : (ex.sites || []).map((s) => ({ d: s.domain, st: s.state, auto: s.autoAdsEnabled, e: siteTotal('rev', s.domain) }));
  return kpis([kpiTile('Earnings', money(rv.total), rv.delta, 'dollar'), kpiTile('Page RPM', money(rpm), null, 'trend'), kpiTile('Ad clicks', fmt(S.demo ? rv.total * 9 : ck), null, 'cursor'), kpiTile('Ad impressions', fmt(S.demo ? rv.total * 520 : ad), null, 'eye')])
    + `<div class="card c8"><div class="ch"><div><h3>Earnings</h3><div class="sub">Estimated, per day</div></div></div>${lineChart('ad', [{ n: 'Earnings', c: '#16a34a', v: rv.cur }], lab, 260, money)}</div>`
    + `<div class="card c4"><div class="ch"><h3>Next payment</h3></div>${bal == null ? '<p class="sub">Payment info is not available.</p>' : `<div style="font-size:30px;font-weight:700;letter-spacing:-.03em">${esc(cu)}${bal.toFixed(2)}</div><div class="sub">of about 100 payout threshold</div><div class="prog" style="height:10px"><i style="width:${Math.min(100, bal)}%;background:var(--ok)"></i></div>${perDay > 0 && bal < 100 ? `<span class="tag ok">about ${Math.ceil((100 - bal) / perDay)} days to go</span>` : ''}`}</div>`
    + `<div class="card c12"><div class="ch"><h3>Sites and approval</h3></div>${rows.length ? `<div style="overflow:auto"><table><tr><th>Site</th><th>Approval</th><th>Auto ads</th><th class="n">Earnings</th></tr>${rows.map((r) => { const st = ADS_STATE[r.st] || [String(r.st || 'Unknown').toLowerCase(), 'mute']; return `<tr class="h"><td><span class="site">${fav(mk(r.d))}${esc(r.d)}</span></td><td><span class="tag ${st[1]}">${st[0]}</span></td><td>${r.auto ? '<span class="tag ok">On</span>' : '<span class="tag mute">Off</span>'}</td><td class="n">${money(r.e)}</td></tr>`; }).join('')}</table></div>` : '<p class="empty">No sites found in this AdSense account.</p>'}</div>`;
};

V.tools = () => TL.list.map((t) => `<a class="card tool c3" href="#/tools/${t.id}"><span class="tile">${I(t.i, 20)}</span><h3>${t.n}</h3><p>${t.d}</p><span class="go">Open ${I('arrow', 15)}</span></a>`).join('');

function dirGrid() {
  if (DIRERR) return `<p class="empty">The community list is not available right now.<br><small>${esc(DIRERR)}</small></p>`;
  if (!DIRLIST) return '<p class="empty"><span class="spin"></span> Loading...</p>';
  if (!DIRLIST.length) return '<p class="empty">No sites yet. Be the first: connect your Google account and switch on "Show on home page".</p>';
  return `<div class="dirgrid">${DIRLIST.map((d) => `<a class="dircard" href="https://${esc(d.host)}" target="_blank" rel="noopener"><img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(d.host)}&sz=64" alt="" width="32" height="32" loading="lazy"><div><b>${esc(d.name)}</b><span>${esc(d.host)}</span><p>${esc(d.desc || '')}</p></div></a>`).join('')}</div>`;
}
V.explore = () => `<div class="card c12"><div class="ch"><div><h3>Sites on ${BRAND.name}</h3><div class="sub">Owners chose to show these sites here for free promotion. Turn yours on in Connections.</div></div></div><div id="dirGrid">${dirGrid()}</div></div>`;
async function loadDir(force) {
  if (DIRLIST && !force) return;
  try { DIRLIST = await DIR.list(); DIRERR = ''; } catch (e) { DIRERR = e.code === 'permission-denied' ? 'The database rules for the directory are not published yet.' : e.message; DIRLIST = []; }
  ['dirGrid', 'dirHome'].forEach((id) => { const g = document.getElementById(id); if (g) g.innerHTML = dirGrid(); });
}
async function loadMine() { try { MINE = new Set((await DIR.mine()).map((d) => d.host)); } catch (e) { /* rules not published yet */ } }

V.connect = () => {
  const cards = [['ga', 'Google Analytics', 'Visitors, pages, sources and devices', '#d97706', 'chart', ['Users, sessions and live visitors', 'Top pages, countries, devices', 'Read-only access']], ['gsc', 'Search Console', 'Keywords, positions and sitemaps', '#4f46e5', 'search', ['Keywords and Google position', 'Sitemap status', 'Read-only access']], ['ads', 'AdSense', 'Earnings and site approval', '#16a34a', 'dollar', ['Daily earnings and RPM', 'Per-site approval status', 'Read-only access']]];
  const n = connCount(), sites = allSites();
  return `<div class="card c12"><div class="steps"><span class="step ${signed() ? 'ok' : 'on'}"><i>${signed() ? I('ok', 13) : 1}</i>Sign in</span><hr><span class="step ${n || S.demo ? 'ok' : 'on'}"><i>${n || S.demo ? I('ok', 13) : 2}</i>Connect Google</span><hr><span class="step ${sites.length ? 'ok' : ''}"><i>${sites.length ? I('ok', 13) : 3}</i>Pick sites</span><hr><span class="step"><i>4</i>First report</span></div></div>`
    + cards.map((c) => `<div class="card conn c4 ${S.conn[c[0]] ? 'done' : ''}"><span class="logo2" style="background:${c[3]}">${I(c[4], 22)}</span><div><h3>${c[1]}</h3><div class="sub">${c[2]}</div></div><ul>${c[5].map((x) => `<li>${x}</li>`).join('')}</ul>${S.conn[c[0]] ? `<div style="display:flex;gap:8px;align-items:center"><span class="tag ok" style="flex:1;justify-content:center;padding:8px">${I('ok', 14)} Connected${PX.has(c[0]) ? '' : ' (expired)'}</span>${PX.has(c[0]) ? '' : `<button class="btn p sm" data-act="connect" data-k="${c[0]}">Reconnect</button>`}<button class="btn o sm" data-act="disconnect" data-k="${c[0]}">Disconnect</button></div>` : `<button class="btn p" data-act="connect" data-k="${c[0]}">${I('plug', 16)} Connect with Google</button>`}</div>`).join('')
    + `<div class="card c12"><div class="ch"><div><h3>Your sites</h3><div class="sub">Found in your Google accounts. "Show on home page" lists a site in the public ${BRAND.name} directory for free promotion. You can turn it off any time.</div></div></div>${sites.length ? `<div class="list">${sites.map((s) => { const pub = MINE.has(s.d), can = (s.verified || S.demo) && !s.manual; return `<div class="li" style="flex-wrap:wrap">${fav(s)}<div class="t"><b>${esc(s.d)}</b><span>${[s.ga && 'Analytics', s.gsc && 'Search Console', s.ads && 'AdSense', s.manual && 'added by hand'].filter(Boolean).join(' · ') || 'Demo site'}</span></div><label class="sw" title="Show this site in the dashboard"><input type="checkbox" data-sitetoggle="${esc(s.d)}" ${S.off[s.d] ? '' : 'checked'}><i></i><span>In dashboard</span></label><label class="sw ${can ? '' : 'dis'}" title="${can ? 'Free promotion on the home page' : 'Only sites found in your Google account can be promoted'}"><input type="checkbox" data-pub="${esc(s.d)}" ${pub ? 'checked' : ''} ${can ? '' : 'disabled'}><i></i><span>Show on home page</span></label>${s.manual ? `<button class="btn o sm" data-rm="${esc(s.d)}">Remove</button>` : ''}</div>`; }).join('')}</div>` : '<p class="empty">No sites yet. Connect Google above, or add one by hand below.</p>'}
      <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap"><input class="input" id="addSite" placeholder="Add a site by hand: example.com" style="flex:1;min-width:220px"><button class="btn p" data-act="addsite">${I('plus', 16)} Add site</button></div><p class="sub" style="margin-top:8px">Sites added by hand work with all tools. They cannot be promoted because ownership is not proven.</p></div>`;
};

/* ---------- promote dialog ---------- */
async function promoteDialog(host) {
  if (!S.user) { toast('Sign in with Google (not demo) to show your site on the home page.'); return; }
  const ov = document.getElementById('ov') || Object.assign(document.body.appendChild(document.createElement('div')), { id: 'ov', className: 'ov' });
  ov.style.justifyContent = 'center'; ov.style.alignItems = 'center';
  ov.innerHTML = `<div class="card modal"><h3 style="font-size:17px">Show ${esc(host)} on the ${BRAND.name} home page</h3><p class="sub" style="margin:4px 0 14px">Free promotion: visitors of ${BRAND.name} see your site name, description and a link. Switch it off any time.</p><label><div class="sub" style="margin-bottom:5px">Name (max 60)</div><input class="input" id="pbName" maxlength="60" value="${esc(mk(host).n)}"></label><label><div class="sub" style="margin:12px 0 5px">Short description (max 160)</div><textarea class="input" id="pbDesc" maxlength="160" rows="3" style="height:auto;padding:10px 12px;resize:vertical"></textarea></label><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px"><button class="btn o" data-act="close">Cancel</button><button class="btn p" id="pbGo">Publish</button></div></div>`;
  ov.classList.add('open'); ov.onclick = (e) => { if (e.target === ov) { ov.classList.remove('open'); rerender(); } };
  TL.grab(`https://${host}/`).then((r) => { const nm = document.getElementById('pbName'), ds = document.getElementById('pbDesc'); if (!r.ok || !ds) return; const d = new DOMParser().parseFromString(r.text, 'text/html'); const t = (d.title || '').trim(), dd = (d.querySelector('meta[name="description" i]') ? d.querySelector('meta[name="description" i]').getAttribute('content') : '').trim(); if (dd && !ds.value) ds.value = dd.slice(0, 160); if (t && nm.value === mk(host).n) nm.value = t.slice(0, 60); });
  document.getElementById('pbGo').onclick = async () => {
    const name = document.getElementById('pbName').value.trim(), desc = document.getElementById('pbDesc').value.trim(); if (!name) return toast('Enter a name');
    try { await DIR.publish(host, name, desc); MINE.add(host); DIRLIST = null; ov.classList.remove('open'); toast('Your site is now on the home page'); rerender(); } catch (e) { toast(e.code === 'permission-denied' ? 'Not allowed yet: the database rules are not published.' : e.message); }
  };
}

/* ---------- reports ---------- */
const histKey = 'pulse_reports';
const hist = () => { try { return JSON.parse(localStorage.getItem(histKey) || '[]'); } catch { return []; } };
const histHtml = () => hist().map((h, i) => `<div class="li"><span class="rank">${I('file', 16)}</span><div class="t"><b>Report · ${new Date(h.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</b><span>${h.tot} problem${h.tot === 1 ? '' : 's'} · ${h.data.length} site${h.data.length === 1 ? '' : 's'}</span></div><button class="btn o sm" data-viewrep="${i}">View</button></div>`).join('') || '<p class="sub">No reports yet.</p>';
V.reports = () => `<div class="card hero c12"><div><h2>One click report for every site</h2><p>Reads your connected Google data and checks each site live. Problems come first, with simple steps to fix each.</p></div><div class="row"><button class="btn p" data-act="genreport" ${enabled().length ? '' : 'disabled'}>${I('spark', 16)} Generate report</button>${enabled().length ? '' : `<button class="btn o" data-go="connect">Add a site first</button>`}</div></div><div id="rep" class="c12" style="grid-column:span 12"></div><div class="card c12"><div class="ch"><h3>History</h3><span class="sp sub">Kept in this browser</span></div><div class="list" id="repHist">${histHtml()}</div></div>`;
let LASTREP = null;
const SEV = { fix: 'bad', warn: 'warn' };
async function genReport() {
  const box = document.getElementById('rep'), sites = enabled().slice(0, 10), data = [];
  box.innerHTML = `<div class="card"><h3 id="rs">Starting...</h3><div class="prog"><i id="rp"></i></div></div>`;
  const step = (txt, p) => { const a = document.getElementById('rs'), b = document.getElementById('rp'); if (a) { a.textContent = txt; b.style.width = p + '%'; } };
  let i = 0;
  for (const s of sites) {
    step(`Checking ${s.d} (${i + 1} of ${sites.length})`, i / sites.length * 100); i++;
    const ps = [];
    try { const a = await TL.healthOf(s.d); a.C.filter((c) => c.lvl !== 'ok').forEach((c) => ps.push({ sev: SEV[c.lvl], t: `${c.label}: ${c.value}`, w: [c.fix || 'Fix this and run the report again.'] })); } catch (e) { ps.push({ sev: 'warn', t: 'Could not check the site', w: ['Make sure the site is online, then try again.'] }); }
    if (real()) {
      if (S.conn.ga && s.ga) { const c = siteTotal('users', s.d), p = sum(realArr('users', [s.d]).prev); if (p > 30 && c < p * .75) ps.unshift({ sev: 'warn', t: `Visitors dropped ${Math.round((1 - c / p) * 100)}%`, w: ['Open Analytics and compare top pages with the previous period.', 'Check Search Console for ranking drops.'] }); }
      if (S.conn.gsc && s.ga && !s.gsc) ps.unshift({ sev: 'warn', t: 'Not added to Search Console', w: ['Open Search Console and add this site.', 'Submit sitemap.xml.'] });
    }
    data.push({ host: s.d, ps, users: S.conn.ga || S.demo ? Math.round(siteTotal('users', s.d)) : null, rev: S.conn.ads || S.demo ? siteTotal('rev', s.d) : null });
  }
  step('Writing your report', 100);
  LASTREP = { at: Date.now(), data, tot: sum(data.map((d) => d.ps.length)), range: S.range };
  try { localStorage.setItem(histKey, JSON.stringify([LASTREP, ...hist()].slice(0, 8))); } catch (e) { /* storage full */ }
  showReport(LASTREP); const h = document.getElementById('repHist'); if (h) h.innerHTML = histHtml();
}
function showReport(r) {
  LASTREP = r; const bad = sum(r.data.map((d) => d.ps.filter((p) => p.sev === 'bad').length));
  const order = [...r.data].sort((a, b) => b.ps.filter((p) => p.sev === 'bad').length - a.ps.filter((p) => p.sev === 'bad').length);
  document.getElementById('rep').innerHTML = `<div class="card"><div class="ch" style="flex-wrap:wrap"><div><h3>Report · ${new Date(r.at).toLocaleDateString('en', { dateStyle: 'long' })}</h3><div class="sub">${r.data.length} site${r.data.length === 1 ? '' : 's'} · ${r.tot} problem${r.tot === 1 ? '' : 's'}</div></div><span class="sp" style="display:flex;gap:8px"><button class="btn o sm" data-act="copyai">${I('copy', 15)} Copy for AI</button><button class="btn p sm" data-act="dlmd">${I('down', 15)} Download .md</button></span></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px"><span class="tag bad">${bad} urgent</span><span class="tag warn">${r.tot - bad} to improve</span></div>
    ${order.map((d) => `<div style="margin-bottom:18px"><div class="site" style="margin-bottom:10px">${fav(mk(d.host))}${esc(d.host)}${d.users != null ? `<span class="sub" style="font-weight:500">${fmt(d.users)} visitors</span>` : ''}${d.rev != null ? `<span class="sub" style="font-weight:500">${money(d.rev)}</span>` : ''}${d.ps.length ? '' : '<span class="tag ok">All good</span>'}</div>${d.ps.map((p) => `<div class="prob"><div class="hd"><span class="tag ${p.sev}">${p.sev === 'bad' ? 'Urgent' : 'Improve'}</span>${esc(p.t)}</div><ol>${p.w.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div>`).join('')}</div>`).join('')}</div>`;
}
const reportMd = () => `# ${BRAND.name} report · ${new Date(LASTREP.at).toISOString().slice(0, 10)}\n\n` + LASTREP.data.map((d) => `## ${d.host}\n` + (d.ps.length ? d.ps.map((p) => `- **[${p.sev === 'bad' ? 'URGENT' : 'IMPROVE'}] ${p.t}**\n` + p.w.map((x, i) => `  ${i + 1}. ${x}`).join('\n')).join('\n') : '- No problems found')).join('\n\n') + '\n';

/* ---------- login / home (public) ---------- */
function loginPage() {
  return `<div class="login"><div class="l"><div class="brand" style="padding:0"><span class="logo">${I('pulse')}</span>${BRAND.name}</div>
    <h1>All your website data, <span class="grad">in one place.</span></h1><p>Sign in with Google, connect Analytics, Search Console and AdSense, and get tools plus a report that tells you exactly what to fix.</p>
    <div class="chips"><span class="chip">${I('chart', 15)} Google Analytics</span><span class="chip">${I('search', 15)} Search Console</span><span class="chip">${I('dollar', 15)} AdSense</span><span class="chip">${I('tools', 15)} 8 tools</span><span class="chip">${I('file', 15)} AI-ready report</span></div></div>
    <div class="r"><div class="card"><h2 style="font-size:20px;letter-spacing:-.02em">Sign in</h2><p class="sub" style="margin:4px 0 20px">Free. It takes about a minute.</p>
    <button class="gbtn" data-act="login"><svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3A12 12 0 0 1 12 24a12 12 0 0 1 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 24 4a20 20 0 1 0 19.6 16.1z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.7-.4-3.9z"/></svg>Continue with Google</button>
    <button class="btn o" style="width:100%;margin-top:10px;padding:10px" data-act="demo">${I('spark', 16)} Look around with demo data</button>
    <div class="mock" style="margin-top:20px">${['Read-only access to your data', 'Disconnect any time', 'No credit card'].map((x) => `<div style="display:flex;gap:10px;color:var(--tx2)"><span style="color:var(--ok)">${I('ok', 16)}</span>${x}</div>`).join('')}</div></div></div>
    <div class="showcase"><div class="ch"><div><h3 style="font-size:18px">Sites on ${BRAND.name}</h3><div class="sub">Owners chose to be shown here, for free promotion.</div></div></div><div id="dirHome">${dirGrid()}</div></div><div class="foot"><a href="privacy.html">Privacy Policy</a><a href="terms.html">Terms</a><span>${BRAND.name} by CodeLove</span></div></div>`;
}

/* ---------- render / events ---------- */
async function render() {
  const app = document.getElementById('app'), ov = document.getElementById('ov');
  if (typeof cleanup === 'function') { cleanup(); cleanup = null; }
  if (ov && ov.classList.contains('open') && !render.keep) ov.classList.remove('open');
  if (!signed()) { app.innerHTML = loginPage(); loadDir(); return; }
  const r = route(), key = (V[r] ? r : ''), tid = key === 'tools' ? toolId() : '';
  const seq = render.seq = (render.seq || 0) + 1, y = window.scrollY, ks = render.keepScroll; render.keepScroll = false;
  app.innerHTML = shell(key);
  if (real() && !PX.R.loaded) document.getElementById('view').innerHTML = '<div class="card c12 empty"><span class="spin"></span> Loading your data from Google...</div>';
  try { await ensureData(); await prefetch(key); } catch (e) { X.err = e; }
  if (seq !== render.seq) return;
  app.innerHTML = shell(key); banner();
  const v = document.getElementById('view');
  if (tid && TL.list.some((t) => t.id === tid)) cleanup = TL.render(tid, v) || null;
  else v.innerHTML = V[key]();
  bindCharts(); window.scrollTo(0, ks ? y : 0);
  if (key === 'explore') loadDir();
  if (key === 'connect' && S.user && !render.mine) { render.mine = true; loadMine().then(() => { if (route() === 'connect') rerender(); }); }
}
const rerender = () => { render.keepScroll = true; render(); };

document.addEventListener('click', async (e) => {
  const q = (s) => e.target.closest(s); let el;
  if (!q('.menu')) document.querySelectorAll('.menu.open').forEach((m) => m.classList.remove('open'));
  if ((el = q('[data-menu]'))) { const m = document.getElementById(el.dataset.menu), o = m.classList.contains('open'); document.querySelectorAll('.menu.open').forEach((x) => x.classList.remove('open')); if (!o) m.classList.add('open'); return; }
  if ((el = q('[data-site]'))) { S.site = el.dataset.site; save(); rerender(); return; }
  if ((el = q('[data-range]'))) { S.range = +el.dataset.range; save(); rerender(); return; }
  if ((el = q('[data-kpi]'))) { if (!S.demo && !S.conn[el.dataset.src]) { location.hash = '#/connect'; return; } S.kpi = el.dataset.kpi; save(); rerender(); return; }
  if ((el = q('[data-go]'))) { location.hash = '#/' + el.dataset.go; return; }
  if ((el = q('[data-sitetoggle]'))) { const d = el.dataset.sitetoggle; S.off[d] = !el.checked; if (S.site === d) S.site = 'all'; save(); return; }
  if ((el = q('[data-pub]'))) { const h = el.dataset.pub; if (el.checked) { el.checked = false; promoteDialog(h); } else { try { await DIR.unpublish(h); MINE.delete(h); DIRLIST = null; toast('Removed from the home page'); } catch (er) { el.checked = true; toast(er.message); } } return; }
  if ((el = q('[data-rm]'))) { S.manual = S.manual.filter((d) => d !== el.dataset.rm); save(); rerender(); return; }
  if ((el = q('[data-viewrep]'))) { const r = hist()[+el.dataset.viewrep]; if (r) { showReport(r); document.getElementById('rep').scrollIntoView({ behavior: 'smooth' }); } return; }
  if (!(el = q('[data-act]'))) return;
  const a = el.dataset.act;
  if (a === 'login') { try { toast('Opening Google...'); await DIR.signIn(); } catch (er) { toast(er.code === 'auth/popup-closed-by-user' ? 'Sign-in cancelled' : er.message); } }
  else if (a === 'logout') { try { await DIR.signOut(); } catch (er) { /* ignore */ } S.demo = false; S.user = null; S.conn = { ga: false, gsc: false, ads: false }; ['ga', 'gsc', 'ads'].forEach((k) => PX.forget(k)); loadKey = ''; PX.R.loaded = false; MINE = new Set(); render.mine = false; save(); location.hash = ''; render(); }
  else if (a === 'theme') { S.theme = S.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = S.theme; save(); rerender(); }
  else if (a === 'connect') { const k = el.dataset.k; try { await PX.connect(k); S.demo = false; S.conn[k] = true; loadKey = ''; PX.clear(); save(); toast(`${NAMES[k]} connected`); rerender(); } catch (er) { toast(er.message); } }
  else if (a === 'disconnect') { const k = el.dataset.k; PX.forget(k); S.conn[k] = false; loadKey = ''; save(); rerender(); }
  else if (a === 'demo') { S.demo = true; save(); location.hash = '#/'; render(); toast('Demo data loaded'); }
  else if (a === 'close') { document.getElementById('ov').classList.remove('open'); }
  else if (a === 'addsite') { const i = document.getElementById('addSite'), h = i.value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, ''); if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(h)) return toast('Enter a domain like example.com'); if (!S.manual.includes(h)) S.manual.push(h); save(); rerender(); toast('Site added'); }
  else if (a === 'genreport') genReport();
  else if (a === 'copyai') { navigator.clipboard.writeText(reportMd()).then(() => toast('Copied, paste it into any AI')); }
  else if (a === 'dlmd') { const b = new Blob([reportMd()], { type: 'text/markdown' }), l = document.createElement('a'); l.href = URL.createObjectURL(b); l.download = 'report.md'; l.click(); }
});
window.addEventListener('hashchange', render);
setInterval(() => { const n = document.getElementById('liveN'); if (n && S.demo) n.textContent = Math.max(3, +n.textContent + Math.round((Math.random() - .5) * 4)); }, 3500);

window.UI = { I, fav, esc, fmt, toast, sites: enabled, keywords: keywordsFor };
(async () => {
  try { await DIR.onUser((u) => { const had = !!S.user; S.user = u; if (u && !had) { render.mine = false; loadMine(); if (!location.hash || location.hash === '#/') location.hash = '#/connect'; } render(); }); } catch (e) { /* offline: demo still works */ }
  render();
})();
