/* The 8 tools. Pages of other websites are read through the fetch proxy (config.js -> proxy), because browsers
   block cross-site reads (CORS). Needs window.UI from app.js: { I, fav, esc, fmt, sites(), toast(), keywords() }. */
(() => {
  'use strict';
  const CFG = window.PULSE_CONFIG || {};
  const U = () => window.UI;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => Number(n).toLocaleString('en-IN');
  const $ = (s, r = document) => r.querySelector(s);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } } };
  const pathOf = (u) => { try { const x = new URL(u); return (x.pathname + x.search) || '/'; } catch { return u; } };

  /* ---------- fetching ---------- */
  async function grab(url, mode = 'get') {
    const t0 = performance.now();
    try {
      const r = await fetch(`${CFG.proxy}?m=${mode}&u=${encodeURIComponent(url)}`, { cache: 'no-store' });
      const j = await r.json();
      return { ...j, ms: j.ms || Math.round(performance.now() - t0) };
    } catch (e) { return { ok: false, status: 0, url, ms: Math.round(performance.now() - t0), size: 0, text: '', error: 'proxy unreachable' }; }
  }
  /** Runs fn over items with n at a time. Returns { done, stop }. */
  function pool(items, n, fn, each) {
    let i = 0, stopped = false;
    const worker = async () => { while (!stopped && i < items.length) { const it = items[i++]; try { await fn(it); } catch { /* keep going */ } if (each) each(); } };
    return { done: Promise.all(Array.from({ length: Math.min(n, items.length) || 1 }, worker)), stop: () => { stopped = true; } };
  }
  const reasonOf = (s, ext) => {
    if (s === 0) return ['Not reachable', 'The server did not answer: wrong domain, DNS error or timeout.'];
    if (s === 404) return ['404 Not found', 'The page does not exist (deleted, moved or typed wrong).'];
    if (s === 410) return ['410 Gone', 'The page was removed on purpose.'];
    if (s === 401 || s === 403 || s === 429 || s === 999) return [`${s} Blocked`, ext ? 'This site blocks automatic checkers. It probably works in a browser, open it to be sure.' : 'The server refused the request. Check permissions.'];
    if (s >= 500) return [`${s} Server error`, 'The other server has a problem right now. Try again later.'];
    if (s >= 400) return [`${s} Error`, 'The server rejected this address.'];
    return [String(s), ''];
  };

  /* ---------- sitemap + links ---------- */
  function linksIn(html, base) {
    const doc = new DOMParser().parseFromString(html || '', 'text/html'), out = [];
    const add = (raw, kind, text) => {
      if (!raw) return; raw = raw.trim();
      if (/^(#|mailto:|tel:|javascript:|data:|blob:|sms:|whatsapp:)/i.test(raw)) return;
      try { const u = new URL(raw, base); if (!/^https?:$/.test(u.protocol)) return; u.hash = ''; out.push({ url: u.href, kind, text: (text || '').replace(/\s+/g, ' ').trim().slice(0, 80) }); } catch { /* bad url */ }
    };
    doc.querySelectorAll('a[href]').forEach((a) => add(a.getAttribute('href'), 'link', a.textContent || a.getAttribute('aria-label') || a.querySelector('img')?.getAttribute('alt') || '(image link)'));
    doc.querySelectorAll('img[src]').forEach((i) => add(i.getAttribute('src'), 'image', i.getAttribute('alt') || ''));
    doc.querySelectorAll('link[rel~="stylesheet" i][href]').forEach((l) => add(l.getAttribute('href'), 'stylesheet', 'CSS file'));
    doc.querySelectorAll('script[src]').forEach((s) => add(s.getAttribute('src'), 'script', 'JavaScript file'));
    return { links: out, title: (doc.title || '').trim() };
  }
  const sitemapCache = new Map();
  function sitePages(host) {
    if (!sitemapCache.has(host)) sitemapCache.set(host, (async () => {
      const locs = (t) => [...(t || '').matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\s]+?)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, '&'));
      const sm = await grab(`https://${host}/sitemap.xml`);
      let urls = [], from = 'sitemap.xml';
      if (sm.ok && /<sitemapindex/i.test(sm.text)) {
        const kids = locs(sm.text).slice(0, 8);
        const parts = await Promise.all(kids.map((k) => grab(k)));
        urls = parts.flatMap((p) => (p.ok ? locs(p.text) : []));
      } else if (sm.ok) urls = locs(sm.text);
      if (!urls.length) {
        from = 'home page links';
        const home = await grab(`https://${host}/`);
        urls = home.ok ? linksIn(home.text, home.url).links.filter((l) => l.kind === 'link' && new URL(l.url).hostname === host).map((l) => l.url) : [];
        urls.unshift(`https://${host}/`);
      }
      urls = [...new Set(urls.filter((u) => { try { return new URL(u).hostname.replace(/^www\./, '') === host.replace(/^www\./, ''); } catch { return false; } }))];
      return { urls: urls.slice(0, 200), total: urls.length, from };
    })());
    return sitemapCache.get(host);
  }

  /* ---------- page audit (same checks for Site health and Page checker) ---------- */
  function audit(res) {
    const doc = new DOMParser().parseFromString(res.text || '', 'text/html');
    const q = (s) => doc.querySelector(s);
    const meta = (n) => (q(`meta[name="${n}" i]`)?.getAttribute('content') || '').trim();
    const prop = (p) => (q(`meta[property="${p}" i]`)?.getAttribute('content') || '').trim();
    let host = ''; try { host = new URL(res.url).hostname; } catch { /* ignore */ }
    const d = {
      title: (doc.title || '').trim(), desc: meta('description'), robots: meta('robots').toLowerCase(), viewport: meta('viewport'),
      canonical: q('link[rel="canonical" i]')?.getAttribute('href') || '', lang: doc.documentElement.getAttribute('lang') || '',
      ogTitle: prop('og:title'), ogImage: prop('og:image'), twCard: meta('twitter:card'), icon: !!q('link[rel~="icon" i]'),
      ld: doc.querySelectorAll('script[type="application/ld+json" i]').length,
      ga: /googletagmanager\.com\/(gtag|gtm)|gtag\(['"]config['"]|google-analytics\.com/.test(res.text || ''), adsense: /adsbygoogle|ca-pub-\d+/.test(res.text || ''),
      h1: [...doc.querySelectorAll('h1')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean),
    };
    const imgs = [...doc.querySelectorAll('img')]; d.imgs = imgs.length; d.noAlt = imgs.filter((i) => !i.hasAttribute('alt')).length;
    doc.querySelectorAll('script,style,noscript,template,svg').forEach((x) => x.remove());
    const text = (doc.body ? doc.body.textContent : '').replace(/\s+/g, ' ').trim(); d.words = text ? text.split(' ').length : 0;
    const C = []; const add = (lvl, label, value, fix = '') => C.push({ lvl, label, value, fix });
    if (!res.ok) { add('fix', 'Page loads', res.error === 'timeout' ? 'Timed out' : res.status ? `HTTP ${res.status}` : 'Could not be reached', 'The page must answer with 200 (OK).'); return { d, C, score: 0 }; }
    add('ok', 'Page loads', `HTTP ${res.status} · ${num(res.ms)} ms · ${num(Math.round(res.size / 1024))} KB`);
    if (res.ms > 2500) add('warn', 'Server speed', `${num(res.ms)} ms`, 'Slow response. Check hosting or add caching/CDN.');
    if (!/^https:/i.test(res.url)) add('fix', 'HTTPS', 'Not secure', 'Serve the site over HTTPS and redirect http to https.'); else add('ok', 'HTTPS', 'Secure');
    if (!d.title) add('fix', 'Title', 'Missing', 'Add a <title> with the main search phrase first.');
    else add(d.title.length < 25 || d.title.length > 65 ? 'warn' : 'ok', 'Title', `${d.title.length} chars · "${d.title}"`, 'Keep the title 30 to 60 characters, main phrase first.');
    if (!d.desc) add('fix', 'Meta description', 'Missing', 'Add <meta name="description"> (120 to 160 characters).');
    else add(d.desc.length < 70 || d.desc.length > 170 ? 'warn' : 'ok', 'Meta description', `${d.desc.length} chars`, 'Aim for 120 to 160 characters.');
    add(d.h1.length === 1 ? 'ok' : 'warn', 'H1 heading', d.h1.length ? `${d.h1.length} x "${d.h1[0].slice(0, 60)}"` : 'None in the HTML', d.h1.length ? 'Use exactly one H1 per page.' : 'Add one H1 with the main phrase.');
    if (/noindex/.test(d.robots)) add('fix', 'Indexing allowed', `robots: ${d.robots}`, 'Remove noindex if this page should appear in Google.'); else add('ok', 'Indexing allowed', d.robots || 'allowed');
    add(d.canonical ? 'ok' : 'warn', 'Canonical URL', d.canonical || 'Missing', 'Add <link rel="canonical" href="https://..."> with the page\'s own address.');
    add(d.viewport ? 'ok' : 'fix', 'Mobile viewport', d.viewport || 'Missing', 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.');
    add(d.lang ? 'ok' : 'warn', 'Language', d.lang || 'Missing', 'Add lang="en" on <html>.');
    add(d.ogTitle && d.ogImage ? 'ok' : 'warn', 'Social card (Open Graph)', d.ogImage ? 'og:title + og:image' : 'No og:image', 'Add og:title, og:description and og:image (1200x630).');
    add(d.twCard ? 'ok' : 'warn', 'Twitter / X card', d.twCard || 'Missing', 'Add <meta name="twitter:card" content="summary_large_image">.');
    add(d.ld ? 'ok' : 'warn', 'Structured data', d.ld ? `${d.ld} block(s)` : 'None', 'Add JSON-LD (WebSite, Article, FAQ...) for rich results.');
    add(d.icon ? 'ok' : 'warn', 'Favicon', d.icon ? 'Yes' : 'Missing', 'Add <link rel="icon">.');
    add(!d.noAlt ? 'ok' : 'warn', 'Image alt text', d.imgs ? `${d.imgs - d.noAlt} of ${d.imgs} images have alt` : 'No images', 'Give every <img> an alt text.');
    add(d.words >= 250 ? 'ok' : 'warn', 'Text on the page', `${num(d.words)} words`, 'Very little text in the HTML. Google and AdSense need real content.');
    add(d.ga ? 'ok' : 'warn', 'Google Analytics tag', d.ga ? 'Installed' : 'Not found', 'Add the GA4 snippet if you want Analytics data. (Ignore if it loads by JavaScript.)');
    add(d.adsense ? 'ok' : 'warn', 'AdSense code', d.adsense ? 'Installed' : 'Not found', 'Add the AdSense code from AdSense > Sites if you want ads here.');
    const w = { ok: 1, warn: .5, fix: 0 };
    return { d, C, score: Math.round(C.reduce((a, c) => a + w[c.lvl], 0) / C.length * 100) };
  }
  const scoreTag = (s) => `<span class="tag ${s >= 85 ? 'ok' : s >= 60 ? 'warn' : 'bad'}">${s}</span>`;
  const checks = (C, all) => `<ul class="chk">${C.filter((c) => all || c.lvl !== 'ok').map((c) => `<li class="chk-${c.lvl}"><span class="cdot"></span><div><b>${esc(c.label)}</b> <span class="cv">${esc(c.value)}</span>${c.lvl !== 'ok' && c.fix ? `<div class="cfix">${esc(c.fix)}</div>` : ''}</div></li>`).join('')}</ul>`;

  /* ---------- shared bits ---------- */
  const mySites = () => U().sites();
  const normHost = (v) => String(v || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
  const validHost = (h) => /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(h);
  const picker = (id, cur) => `<form class="pick" data-pick="${id}"><input class="input" id="${id}" list="siteList" value="${esc(cur || '')}" placeholder="example.com" style="width:220px"><datalist id="siteList">${mySites().map((s) => `<option value="${esc(s.d)}">`).join('')}</datalist><button class="btn p sm" type="submit">Check</button></form>`;
  const wirePick = (el, id, fn) => { const f = el.querySelector(`[data-pick="${id}"]`); if (f) f.onsubmit = (e) => { e.preventDefault(); const h = normHost(f.querySelector('input').value); if (!validHost(h)) return U().toast('Enter a domain like example.com'); fn(h); }; };
  const noSites = (el, again, single) => { el.innerHTML = `<div class="card c12 empty"><h3>Which website?</h3><p style="margin:6px 0 14px">Type any domain to check.${single ? '' : ' It is added to your sites.'}</p><form class="pick" id="askF" style="justify-content:center"><input class="input" id="askH" placeholder="example.com" style="max-width:260px"><button class="btn p" type="submit">Continue</button></form></div>`; el.querySelector('#askF').onsubmit = (e) => { e.preventDefault(); const h = normHost(el.querySelector('#askH').value); if (!validHost(h)) return U().toast('Enter a domain like example.com'); if (single) { setSiteQ(h); again(el); } else U().addSite(h).then((ok) => { if (ok) again(el); }); }; };
  const head = (t, extra = '') => `<div class="card c12"><div class="ch" style="margin:0;flex-wrap:wrap"><a href="#/tools" class="btn o sm">&larr; Tools</a><h3 style="font-size:16px">${t}</h3><span class="sp" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${extra}</span></div></div>`;
  const siteFromHash = () => new URLSearchParams(location.hash.split('?')[1] || '').get('site');
  const pickSite = () => { const w = normHost(siteFromHash()); if (validHost(w)) return w; const l = mySites(); return l[0] ? l[0].d : ''; };
  const setSiteQ = (host) => { const base = location.hash.split('?')[0]; history.replaceState(null, '', `${base}?site=${encodeURIComponent(host)}`); };

  const R = {}; // tool renderers: (el) => void|cleanup

  /* ---- Site health ---- */
  const healthRes = new Map();
  async function healthOf(host) {
      const home = await grab(`https://${host}/`);
      const [robots, sm] = await Promise.all([grab(`https://${host}/robots.txt`), grab(`https://${host}/sitemap.xml`)]);
      const a = audit(home), locs = (sm.text.match(/<loc>/gi) || []).length;
      a.C.push({ lvl: robots.ok ? (/^\s*sitemap:/im.test(robots.text) ? 'ok' : 'warn') : 'warn', label: 'robots.txt', value: robots.ok ? (/^\s*sitemap:/im.test(robots.text) ? 'OK, lists the sitemap' : 'No Sitemap line') : `HTTP ${robots.status || 'error'}`, fix: `Add robots.txt with "Sitemap: https://${host}/sitemap.xml".` });
      a.C.push({ lvl: sm.ok && locs ? 'ok' : 'fix', label: 'sitemap.xml', value: sm.ok ? `${num(locs)} URLs` : `HTTP ${sm.status || 'error'}`, fix: 'Add sitemap.xml listing every public page, then submit it in Search Console.' });
      const w = { ok: 1, warn: .5, fix: 0 }; a.score = home.ok ? Math.round(a.C.reduce((x, c) => x + w[c.lvl], 0) / a.C.length * 100) : 0;
      return a;
  }
  R.health = (el) => {
    const sites = mySites(); if (!sites.length) return noSites(el, R.health);
    const run = async (host) => {
      const box = $(`[data-h="${host}"]`, el); box.querySelector('.res').innerHTML = '<span class="spin"></span>';
      healthRes.set(host, await healthOf(host)); draw(host);
    };
    const draw = (host) => {
      const a = healthRes.get(host), box = $(`[data-h="${host}"]`, el); if (!a || !box) return;
      const bad = a.C.filter((c) => c.lvl !== 'ok');
      box.querySelector('.res').innerHTML = `${scoreTag(a.score)} <span class="tag ${bad.length ? 'warn' : 'ok'}">${bad.length ? bad.length + ' to fix' : 'All good'}</span>`;
      box.querySelector('.body').innerHTML = bad.length ? checks(a.C) : '<p class="sub" style="padding:6px 0">Everything checked is fine.</p>';
    };
    el.innerHTML = head('Site health', '<button class="btn p sm" id="hAll">Check all sites</button>')
      + sites.map((s) => `<div class="card c12" data-h="${esc(s.d)}"><div class="ch" style="margin:0">${U().fav(s)}<div><h3>${esc(s.d)}</h3><div class="sub">Home page, robots.txt, sitemap.xml, tags</div></div><span class="sp" style="display:flex;gap:10px;align-items:center"><span class="res"></span><button class="btn o sm" data-run="${esc(s.d)}">Check</button></span></div><div class="body"></div></div>`).join('');
    el.onclick = (e) => { const b = e.target.closest('[data-run]'); if (b) run(b.dataset.run); if (e.target.closest('#hAll')) pool(sites.map((s) => s.d), 3, run); };
    sites.forEach((s) => draw(s.d));
  };

  /* ---- Page checker ---- */
  const pageRes = new Map();
  R.checker = async (el) => {
    const host = pickSite(); if (!host) return noSites(el, R.checker, true);
    el.innerHTML = head('Page checker', picker('pcSite', host) + '<button class="btn p sm" id="pcAll" disabled>Check all pages</button>') + '<div class="card c12" id="pcBody"><p class="sub"><span class="spin"></span> Reading the sitemap...</p></div>';
    wirePick(el, 'pcSite', (h) => { setSiteQ(h); R.checker(el); });
    const { urls, total, from } = await sitePages(host); if (!el.isConnected) return;
    const check = async (u) => { const row = $(`[data-u="${CSS.escape(u)}"]`, el); row.querySelector('.res').innerHTML = '<span class="spin"></span>'; const r = await grab(u); const a = audit(r); a.title = a.d.title; pageRes.set(u, a); drawRow(u); };
    const drawRow = (u) => { const a = pageRes.get(u), row = $(`[data-u="${CSS.escape(u)}"]`, el); if (!a || !row) return; const bad = a.C.filter((c) => c.lvl !== 'ok').length; row.querySelector('.res').innerHTML = `${scoreTag(a.score)} <span class="sub">${bad} issue${bad === 1 ? '' : 's'}</span>`; row.querySelector('.tt').textContent = a.title || ''; };
    $('#pcBody', el).innerHTML = `<div class="ch"><h3>${num(total)} page${total === 1 ? '' : 's'} from ${esc(from)}</h3>${total > urls.length ? `<span class="sp sub">showing first ${urls.length}</span>` : ''}</div><div class="list">${urls.map((u) => `<div class="li" data-u="${esc(u)}" style="flex-wrap:wrap"><div class="t"><b>${esc(pathOf(u))}</b><span class="tt"></span></div><span class="res"></span><button class="btn o sm" data-chk="${esc(u)}">Check</button><div class="det" style="width:100%"></div></div>`).join('')}</div>`;
    urls.forEach(drawRow); const all = $('#pcAll', el); all.disabled = false;
    el.onclick = (e) => {
      const b = e.target.closest('[data-chk]');
      if (b) { const u = b.dataset.chk, row = b.closest('.li'); check(u).then(() => { row.querySelector('.det').innerHTML = checks(pageRes.get(u).C, true); }); }
      if (e.target.closest('#pcAll')) pool(urls, 4, check);
      const li = e.target.closest('.li[data-u]'); if (li && !e.target.closest('button') && pageRes.has(li.dataset.u)) { const d = li.querySelector('.det'); d.innerHTML = d.innerHTML ? '' : checks(pageRes.get(li.dataset.u).C, true); }
    };
  };

  /* ---- Broken links ---- */
  let blState = null;
  R.broken = async (el) => {
    const host = pickSite(); if (!host) return noSites(el, R.broken, true);
    el.innerHTML = head('Broken links', picker('blSite', host) + '<label class="sub" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="blExt" ' + (store.get('pulse_bl_ext') === '0' ? '' : 'checked') + '> check other websites too</label><button class="btn p sm" id="blGo" disabled>Check all links</button>')
      + '<div class="card c12"><b id="blInfo"><span class="spin"></span> Reading the sitemap...</b><div class="sub">Scans every page, follows every link and image, and shows each broken one with the page it is on.</div></div><div id="blOut" class="c12" style="grid-column:span 12;display:grid;gap:16px"></div>';
    wirePick(el, 'blSite', (h) => { setSiteQ(h); R.broken(el); });
    $('#blExt', el).onchange = (e) => store.set('pulse_bl_ext', e.target.checked ? '1' : '0');
    const { urls, total, from } = await sitePages(host); if (!el.isConnected) return;
    $('#blInfo', el).textContent = `${num(urls.length)} page${urls.length === 1 ? '' : 's'} to scan (from ${from}${total > urls.length ? `, first ${urls.length} of ${total}` : ''})`;
    const go = $('#blGo', el); go.disabled = false;
    let view = 'link';
    const draw = (st) => {
      const bad = st.links.filter((l) => l.bad), maybe = st.links.filter((l) => l.maybe && !l.bad);
      const pages = (l) => [...l.from].map((p) => `<li><a href="${esc(p)}" target="_blank" rel="noopener">${esc(pathOf(p))}</a>${st.titles.get(p) ? ` <span class="sub">${esc(st.titles.get(p))}</span>` : ''}</li>`).join('');
      const byLink = bad.map((l) => { const [t, why] = reasonOf(l.status, l.external); return `<div class="prob"><div class="hd"><span class="tag bad">${esc(t)}</span><span class="tag mute">${l.kind}</span><a href="${esc(l.url)}" target="_blank" rel="noopener" style="word-break:break-all">${esc(l.url)}</a></div><div class="sub" style="margin-top:6px">${esc(why)}${l.text ? ` Link text: "${esc(l.text)}"` : ''}</div><div style="margin-top:8px;font-weight:600;font-size:12.5px">Found on ${l.from.size} page${l.from.size > 1 ? 's' : ''}:</div><ul class="pgs">${pages(l)}</ul></div>`; }).join('');
      const pg = new Map(); bad.forEach((l) => l.from.forEach((p) => { if (!pg.has(p)) pg.set(p, []); pg.get(p).push(l); }));
      const byPage = [...pg].sort((a, b) => b[1].length - a[1].length).map(([p, ls]) => `<div class="prob"><div class="hd"><a href="${esc(p)}" target="_blank" rel="noopener">${esc(pathOf(p))}</a><span class="tag bad">${ls.length} broken</span></div><div class="sub">${esc(st.titles.get(p) || '')}</div><ul class="pgs">${ls.map((l) => `<li><span class="tag bad">${esc(reasonOf(l.status, l.external)[0])}</span> ${l.kind}: <a href="${esc(l.url)}" target="_blank" rel="noopener" style="word-break:break-all">${esc(l.url)}</a>${l.text ? ` <span class="sub">"${esc(l.text)}"</span>` : ''}</li>`).join('')}</ul></div>`).join('');
      $('#blOut', el).innerHTML = `<div class="bento" style="grid-column:span 12"><div class="card c4"><div class="sub">Pages scanned</div><div class="v" style="font-size:26px;font-weight:700">${num(st.pagesDone)} / ${num(st.pages)}</div></div><div class="card c4"><div class="sub">Links checked</div><div class="v" style="font-size:26px;font-weight:700">${num(st.checked)} <span class="sub">of ${num(st.links.length)}</span></div></div><div class="card c4"><div class="sub">Broken</div><div class="v" style="font-size:26px;font-weight:700;color:${bad.length ? 'var(--bad)' : 'var(--ok)'}">${num(bad.length)}</div></div></div>`
        + (bad.length ? `<div class="card"><div class="ch"><h3>Broken links</h3><span class="sp" style="display:flex;gap:8px"><span class="seg"><button data-v="link" class="${view === 'link' ? 'on' : ''}">By broken link</button><button data-v="page" class="${view === 'page' ? 'on' : ''}">By page</button></span><button class="btn o sm" id="blCopy">Copy for AI</button></span></div>${view === 'link' ? byLink : byPage}</div>` : (st.running ? '' : '<div class="card empty"><h3>No broken links found</h3><p>Every link and image on the scanned pages answered correctly.</p></div>'))
        + (maybe.length && !st.running ? `<div class="card"><div class="ch"><h3>Blocked, check by hand (${maybe.length})</h3></div><p class="sub" style="margin-bottom:8px">These websites refuse automatic checkers. They usually work in a browser.</p><ul class="pgs">${maybe.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.url)}</a> <span class="tag warn">${l.status}</span></li>`).join('')}</ul></div>` : '');
      $('#blOut', el).querySelectorAll('[data-v]').forEach((b) => b.onclick = () => { view = b.dataset.v; draw(st); });
      const c = $('#blCopy', el); if (c) c.onclick = () => { const md = [`Fix these broken links on ${host}:`, '', ...[...pg].map(([p, ls]) => `Page ${p}\n` + ls.map((l) => `  - ${l.kind} ${l.url} -> ${reasonOf(l.status, l.external)[0]}${l.text ? ` (text "${l.text}")` : ''}`).join('\n')), '', 'Fix each URL, point it to the right page, or remove the link.'].join('\n'); navigator.clipboard.writeText(md).then(() => U().toast('Copied, paste it into any AI')); };
    };
    if (blState && blState.host === host) draw(blState);
    go.onclick = async () => {
      if (blState && blState.run) { blState.run.stop(); return; }
      const ext = $('#blExt', el).checked, byUrl = new Map();
      const st = blState = { host, pages: urls.length, pagesDone: 0, checked: 0, links: [], titles: new Map(), running: true, run: null };
      go.textContent = 'Stop'; const live = () => el.isConnected && blState === st;
      st.run = pool(urls, 4, async (u) => {
        const res = await grab(u);
        const add = (l, from) => { let x = byUrl.get(l.url); if (!x) { let h = ''; try { h = new URL(l.url).hostname; } catch { /* */ } x = { url: l.url, kind: l.kind, text: l.text, from: new Set(), status: null, bad: false, maybe: false, external: h.replace(/^www\./, '') !== host.replace(/^www\./, '') }; byUrl.set(l.url, x); st.links.push(x); } x.from.add(from); };
        if (!res.ok) { add({ url: u, kind: 'link', text: '(listed in sitemap.xml)' }, `https://${host}/sitemap.xml`); const x = byUrl.get(u); x.status = res.status; x.bad = true; st.titles.set(`https://${host}/sitemap.xml`, 'Your sitemap lists a page that does not load'); return; }
        const { links, title } = linksIn(res.text, res.url); st.titles.set(u, title); links.forEach((l) => add(l, u));
      }, () => { st.pagesDone++; if (live() && st.pagesDone % 2 === 0) draw(st); });
      await st.run.done;
      const todo = st.links.filter((l) => l.status == null && (!l.external || ext)).slice(0, 700);
      st.run = pool(todo, 8, async (l) => { const r = await grab(l.url, 'head'); l.status = r.status; l.maybe = l.external && [401, 403, 429, 999].includes(r.status); l.bad = !l.maybe && (r.status === 0 || r.status >= 400); }, () => { st.checked++; if (live() && st.checked % 8 === 0) draw(st); });
      await st.run.done; st.running = false; st.run = null;
      if (!live()) return; go.textContent = 'Check all links'; draw(st);
    };
  };

  /* ---- Uptime ---- */
  const upKey = 'pulse_uptime';
  const upData = () => { try { return JSON.parse(store.get(upKey) || '{}'); } catch { return {}; } };
  R.uptime = (el) => {
    const sites = mySites(); if (!sites.length) return noSites(el, R.uptime);
    const draw = () => {
      const data = upData(), cut = Date.now() - 864e5;
      $('#upBody', el).innerHTML = `<table><tr><th>Site</th><th>Status</th><th class="n">Response</th><th class="n">Last 24h</th><th>History</th><th class="n">Checked</th></tr>${sites.map((s) => {
        const a = data[s.d] || [], last = a[a.length - 1], day = a.filter((x) => x[0] > cut), up = day.length ? Math.round(day.filter((x) => x[2] >= 200 && x[2] < 400).length / day.length * 1000) / 10 : null;
        const ok = last && last[2] >= 200 && last[2] < 400;
        return `<tr class="h"><td><span class="site">${U().fav(s)}${esc(s.d)}</span></td><td>${last ? `<span class="tag ${ok ? 'ok' : 'bad'}">${ok ? 'Up' : last[2] ? 'HTTP ' + last[2] : 'Down'}</span>` : '<span class="tag mute">Not checked</span>'}</td><td class="n">${last ? num(last[1]) + ' ms' : '-'}</td><td class="n">${up == null ? '-' : up + '%'}</td><td><span class="ubar">${a.slice(-30).map((x) => `<i class="${x[2] >= 200 && x[2] < 400 ? 'u' : 'd'}"></i>`).join('')}</span></td><td class="n sub">${last ? new Date(last[0]).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '-'}</td></tr>`;
      }).join('')}</table>`;
    };
    const ping = async () => {
      const data = upData();
      await pool(sites.map((s) => s.d), 4, async (h) => {
        let r = await grab(`https://${h}/`, 'head'); if (!(r.status >= 200 && r.status < 400)) { await sleep(4000); r = await grab(`https://${h}/`, 'head'); }
        const a = (data[h] || []).filter((x) => x[0] > Date.now() - 3 * 864e5); a.push([Date.now(), r.ms, r.status]); data[h] = a;
      }).done;
      store.set(upKey, JSON.stringify(data)); if (el.isConnected) draw();
    };
    el.innerHTML = head('Uptime monitor', '<button class="btn p sm" id="upNow">Check now</button>') + '<div class="card c12"><div id="upBody"></div><p class="sub" style="margin-top:12px">Checks every 5 minutes while this page is open. History is kept in this browser for 3 days.</p></div>';
    draw(); $('#upNow', el).onclick = ping; ping(); const t = setInterval(() => { if (!el.isConnected) clearInterval(t); else ping(); }, 3e5);
    return () => clearInterval(t);
  };

  /* ---- Rank tracker ---- */
  R.rank = async (el) => {
    const host = pickSite(); if (!host) return noSites(el, R.rank, true);
    const tk = 'pulse_targets_' + host, targets = () => { try { return JSON.parse(store.get(tk) || '[]'); } catch { return []; } };
    el.innerHTML = head('Rank tracker', picker('rkSite', host)) + '<div class="card c12"><p class="sub"><span class="spin"></span> Reading Google Search Console...</p></div>';
    wirePick(el, 'rkSite', (h) => { setSiteQ(h); R.rank(el); });
    let rows; try { rows = await U().keywords(host); } catch (e) { if (el.isConnected) el.querySelector('.card:last-child').innerHTML = `<div class="empty"><h3>Search Console needed</h3><p style="margin:6px 0 14px">${esc(e.message)}</p><a class="btn p" href="#/connect">Open Connections</a></div>`; return; }
    if (!el.isConnected) return;
    const find = (k) => rows.find((r) => r.q.toLowerCase() === k.toLowerCase());
    const pos = (r) => `<span class="tag ${r.pos <= 10 ? 'ok' : r.pos <= 20 ? 'warn' : 'mute'}">#${r.pos.toFixed(1)}</span>`;
    const chg = (r) => r.prev ? (() => { const d = r.prev - r.pos; return `<span class="dl ${d >= 0 ? 'up' : 'dn'}">${d >= 0 ? '&#9650;' : '&#9660;'} ${Math.abs(d).toFixed(1)}</span>`; })() : '<span class="sub">new</span>';
    const draw = () => {
      $('#rkTargets', el).innerHTML = targets().length ? `<table><tr><th>Target keyword</th><th class="n">Position</th><th class="n">Impressions</th><th></th></tr>${targets().map((k) => { const r = find(k); return `<tr class="h"><td><b>${esc(k)}</b></td><td class="n">${r ? pos(r) : '<span class="sub">not in Google results yet</span>'}</td><td class="n">${r ? num(r.impr) : '-'}</td><td class="n"><button class="btn o sm" data-del="${esc(k)}">Remove</button></td></tr>`; }).join('')}</table>` : '<p class="sub">Add the keywords you want to rank for. You will see their Google position here.</p>';
    };
    el.querySelector('.card:last-child').outerHTML = `<div class="card c12"><div class="ch"><h3>Target keywords</h3></div><div style="display:flex;gap:8px;margin-bottom:12px"><input class="input" id="rkNew" placeholder="e.g. free video maker"><button class="btn p" id="rkAdd">Add</button></div><div id="rkTargets"></div></div>
      <div class="card c12"><div class="ch"><h3>All keywords from Google</h3><span class="sp sub">last 28 days, top ${rows.length}</span></div>${rows.length ? `<div style="overflow:auto"><table><tr><th>Keyword</th><th class="n">Position</th><th class="n">Change</th><th class="n">Impressions</th><th class="n">Clicks</th><th></th></tr>${rows.map((r) => `<tr class="h"><td><b>${esc(r.q)}</b></td><td class="n">${pos(r)}</td><td class="n">${chg(r)}</td><td class="n">${num(r.impr)}</td><td class="n">${num(r.clicks)}</td><td class="n"><button class="btn o sm" data-tg="${esc(r.q)}">Track</button> <a class="btn o sm" href="https://www.google.com/search?q=${encodeURIComponent(r.q)}" target="_blank" rel="noopener">Google</a></td></tr>`).join('')}</table></div>` : '<p class="empty">No keyword data for this site yet.</p>'}</div>`;
    draw();
    const add = (k) => { k = k.trim(); if (!k || targets().some((x) => x.toLowerCase() === k.toLowerCase())) return; store.set(tk, JSON.stringify([...targets(), k])); draw(); };
    el.onclick = (e) => { const b = e.target; if (b.id === 'rkAdd') { add($('#rkNew', el).value); $('#rkNew', el).value = ''; } if (b.dataset.tg) { add(b.dataset.tg); U().toast('Added to target keywords'); } if (b.dataset.del) { store.set(tk, JSON.stringify(targets().filter((x) => x !== b.dataset.del))); draw(); } };
  };

  /* ---- PageSpeed ---- */
  R.speed = (el) => {
    const host = pickSite(); if (!host) return noSites(el, R.speed, true);
    el.innerHTML = head('PageSpeed', picker('psSite', host)) + `<div class="card c12"><div style="display:flex;gap:8px;flex-wrap:wrap"><input class="input" id="psUrl" value="https://${esc(host)}/" style="flex:1;min-width:240px"><button class="btn p" id="psGo">Test mobile + desktop</button></div><p class="sub" style="margin-top:8px">Uses Google PageSpeed Insights (Lighthouse). Takes about 20 seconds.</p></div><div id="psOut" class="c12" style="grid-column:span 12;display:grid;gap:16px"></div>`;
    wirePick(el, 'psSite', (h) => { $('#psUrl', el).value = `https://${h}/`; });
    const run = async (url, strategy) => {
      const cats = ['performance', 'accessibility', 'best-practices', 'seo'].map((c) => 'category=' + c).join('&');
      const r = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&${cats}`);
      const j = await r.json(); if (!r.ok) throw new Error(r.status === 429 ? 'Google\'s free PageSpeed quota is busy. Try again in a minute.' : (j.error && j.error.message) || 'PageSpeed failed');
      return j.lighthouseResult;
    };
    const sc = (v) => Math.round((v || 0) * 100), col = (s) => (s >= 90 ? 'ok' : s >= 50 ? 'warn' : 'bad');
    $('#psGo', el).onclick = async () => {
      const url = $('#psUrl', el).value.trim(), out = $('#psOut', el); out.innerHTML = '<div class="card"><span class="spin"></span> Running Lighthouse...</div>';
      try {
        const [m, d] = await Promise.all([run(url, 'mobile'), run(url, 'desktop')]);
        const block = (t, L) => `<div class="card"><div class="ch"><h3>${t}</h3></div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">${['performance', 'accessibility', 'best-practices', 'seo'].map((c) => { const s = sc(L.categories[c].score); return `<div style="text-align:center"><div class="tag ${col(s)}" style="font-size:18px;padding:6px 12px">${s}</div><div class="sub" style="margin-top:4px">${c.replace('-', ' ')}</div></div>`; }).join('')}</div>
          <table>${[['First Contentful Paint', 'first-contentful-paint'], ['Largest Contentful Paint', 'largest-contentful-paint'], ['Total Blocking Time', 'total-blocking-time'], ['Layout shift (CLS)', 'cumulative-layout-shift'], ['Speed Index', 'speed-index']].map((x) => `<tr><td>${x[0]}</td><td class="n"><b>${esc(L.audits[x[1]].displayValue || '-')}</b></td></tr>`).join('')}</table>
          ${(() => { const op = Object.values(L.audits).filter((a) => a.details && a.details.type === 'opportunity' && a.details.overallSavingsMs > 200).sort((a, b) => b.details.overallSavingsMs - a.details.overallSavingsMs).slice(0, 5); return op.length ? `<div style="margin-top:12px;font-weight:600">Fix these first</div>${op.map((a) => `<div class="todo"><div><b>${esc(a.title)}</b><span>Could save about ${num(Math.round(a.details.overallSavingsMs))} ms</span></div></div>`).join('')}` : ''; })()}</div>`;
        out.innerHTML = block('Mobile', m) + block('Desktop', d);
      } catch (e) { out.innerHTML = `<div class="card"><span class="tag bad">${esc(e.message)}</span></div>`; }
    };
  };

  /* ---- UTM builder ---- */
  R.utm = (el) => {
    el.innerHTML = head('UTM builder') + `<div class="card c12"><div style="display:grid;gap:12px;max-width:640px">${[['url', 'Page URL', 'https://example.com/page'], ['src', 'Source (where the link is posted)', 'youtube'], ['med', 'Medium (type of link)', 'social'], ['cmp', 'Campaign name', 'launch_2026']].map((f) => `<label><div class="sub" style="margin-bottom:5px">${f[1]}</div><input class="input utm" id="u_${f[0]}" placeholder="${f[2]}"></label>`).join('')}<div class="code" id="utmOut" style="word-break:break-all;min-height:44px"></div><div><button class="btn p" id="utmCopy">Copy link</button></div></div></div>`;
    const up = () => { const v = (k) => $('#u_' + k, el).value.trim(); const g = (k) => encodeURIComponent(v(k)); $('#utmOut', el).textContent = v('url') ? `${v('url')}${v('url').includes('?') ? '&' : '?'}utm_source=${g('src')}&utm_medium=${g('med')}&utm_campaign=${g('cmp')}` : 'Fill the form to get your link'; };
    el.querySelectorAll('.utm').forEach((i) => i.oninput = up); up();
    $('#utmCopy', el).onclick = () => navigator.clipboard.writeText($('#utmOut', el).textContent).then(() => U().toast('Copied'));
  };

  /* ---- Quick links ---- */
  R.links = (el) => {
    const sites = mySites(); if (!sites.length) return noSites(el, R.links);
    el.innerHTML = head('Quick links') + (sites.length ? sites.map((s) => `<div class="card c4"><div class="site" style="margin-bottom:12px">${U().fav(s)}${esc(s.d)}</div><div style="display:flex;gap:8px;flex-wrap:wrap">${[['Search Console', `https://search.google.com/search-console?resource_id=${encodeURIComponent('sc-domain:' + s.d.split('.').slice(-2).join('.'))}`], ['PageSpeed', `https://pagespeed.web.dev/analysis?url=https://${s.d}`], ['Rich results test', `https://search.google.com/test/rich-results?url=https://${s.d}`], ['Mobile friendly', `https://search.google.com/test/mobile-friendly?url=https://${s.d}`], ['site: search', `https://www.google.com/search?q=site:${s.d}`], ['sitemap.xml', `https://${s.d}/sitemap.xml`], ['Open site', `https://${s.d}`]].map((l) => `<a class="btn o sm" href="${l[1]}" target="_blank" rel="noopener">${l[0]}</a>`).join('')}</div></div>`).join('') : '') + (sites.length ? '' : '<div class="card c12 empty"><p>Connect Google first.</p></div>') + '<div class="card c12"><div class="ch"><h3>Google consoles</h3></div><div style="display:flex;gap:8px;flex-wrap:wrap">' + [['Analytics', 'https://analytics.google.com'], ['Search Console', 'https://search.google.com/search-console'], ['AdSense', 'https://adsense.google.com'], ['Tag Manager', 'https://tagmanager.google.com'], ['Google Trends', 'https://trends.google.com']].map((l) => `<a class="btn o sm" href="${l[1]}" target="_blank" rel="noopener">${l[0]}</a>`).join('') + '</div></div>';
  };

  const LIST = [
    { id: 'health', n: 'Site health', d: 'One score per site: home page, robots.txt, sitemap.xml, SEO tags, HTTPS, tracking codes.', i: 'heart', c: '#16a34a' },
    { id: 'uptime', n: 'Uptime monitor', d: 'Pings every site every 5 minutes and shows which one is down and for how long.', i: 'pulse', c: '#0891b2' },
    { id: 'checker', n: 'Page checker', d: 'Every page from your sitemap, checked one by one for title, description, headings and more.', i: 'checkp', c: '#4f46e5' },
    { id: 'broken', n: 'Broken links', d: 'Finds every broken link and image, and shows exactly which page each one is on.', i: 'unlink', c: '#dc2626' },
    { id: 'rank', n: 'Rank tracker', d: 'Your keywords and their Google position, with the change since the last period.', i: 'trend', c: '#db2777' },
    { id: 'speed', n: 'PageSpeed', d: 'Mobile and desktop Lighthouse scores with the fixes that matter most.', i: 'bolt', c: '#d97706' },
    { id: 'utm', n: 'UTM builder', d: 'Build tagged links for campaigns and copy them in one click.', i: 'tag', c: '#7c3aed' },
    { id: 'links', n: 'Quick links', d: 'Jump to Search Console, PageSpeed and test tools for any of your sites.', i: 'mark', c: '#0284c7' },
  ];
  window.TL = { list: LIST, render: (id, el) => (R[id] ? R[id](el) : null), grab, esc, healthOf, pool, sitePages };
})();
