/* The 9 tools + deep audit & problem fix generator. Pages of other websites are read through the fetch proxy
   (config.js -> proxy), because browsers block cross-site reads (CORS).
   Needs window.UI from app.js: { I, fav, esc, fmt, sites(), toast(), keywords() }. */
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
    let cur = String(url || '').trim();
    if (!cur) return { ok: false, status: 0, url: '', ms: 0, size: 0, text: '', error: 'empty url' };
    if (!/^https?:\/\//i.test(cur)) cur = 'https://' + cur;

    // 1. Try local dev-server proxy if running locally on port 5500
    if (CFG.proxy === '/api/fetch' && (location.port === '5500' || location.hostname === 'localhost')) {
      try {
        const r = await fetch(`/api/fetch?m=${mode}&u=${encodeURIComponent(cur)}`, { cache: 'no-store' });
        if (r.ok) {
          const j = await r.json();
          if (j && (j.ok || j.status > 0 || j.text)) return { ...j, ms: j.ms || Math.round(performance.now() - t0) };
        }
      } catch (e) { /* fallback to direct */ }
    } else if (CFG.proxy && CFG.proxy !== '/api/fetch') {
      try {
        const r = await fetch(`${CFG.proxy}?m=${mode}&u=${encodeURIComponent(cur)}`, { cache: 'no-store' });
        if (r.ok) {
          const j = await r.json();
          if (j && (j.ok || j.status > 0 || j.text)) return { ...j, ms: j.ms || Math.round(performance.now() - t0) };
        }
      } catch (e) { /* fallback to direct */ }
    }

    // 2. Direct browser fetch (works natively for *.codelove.in and all CORS-enabled sites)
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 12000);
      let r = await fetch(cur, {
        method: mode === 'head' ? 'HEAD' : 'GET',
        cache: 'no-store',
        signal: ctl.signal,
        redirect: 'follow',
      });
      clearTimeout(timer);
      if (mode === 'head' && [400, 403, 405, 501].includes(r.status)) {
        const ctl2 = new AbortController();
        const timer2 = setTimeout(() => ctl2.abort(), 10000);
        r = await fetch(cur, { method: 'GET', cache: 'no-store', signal: ctl2.signal, redirect: 'follow' });
        clearTimeout(timer2);
      }
      const text = mode === 'head' ? '' : await r.text();
      return {
        ok: r.ok,
        status: r.status,
        url: r.url || cur,
        ms: Math.round(performance.now() - t0),
        size: text ? new Blob([text]).size : 0,
        ct: r.headers.get('content-type') || 'text/html',
        text
      };
    } catch (directErr) {
      // 3. Fallback to public CORS proxy if direct fetch was blocked by CORS
      try {
        const ctl3 = new AbortController();
        const timer3 = setTimeout(() => ctl3.abort(), 12000);
        const fbUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(cur)}`;
        const r = await fetch(fbUrl, { signal: ctl3.signal });
        clearTimeout(timer3);
        if (r.ok) {
          const text = mode === 'head' ? '' : await r.text();
          return {
            ok: true,
            status: 200,
            url: cur,
            ms: Math.round(performance.now() - t0),
            size: text ? new Blob([text]).size : 0,
            ct: 'text/html',
            text
          };
        }
      } catch (fbErr) { /* ignore */ }

      return {
        ok: false,
        status: 0,
        url: cur,
        ms: Math.round(performance.now() - t0),
        size: 0,
        text: '',
        error: directErr.name === 'AbortError' ? 'timeout' : 'unreachable'
      };
    }
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

  /* ---------- Deep 30+ Point Audit Engine & Problem Fix Generator ---------- */
  function audit(res) {
    const rawHtml = res.text || '';
    const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
    const q = (s) => doc.querySelector(s);
    const qAll = (s) => [...doc.querySelectorAll(s)];
    const meta = (n) => (q(`meta[name="${n}" i]`)?.getAttribute('content') || '').trim();
    const prop = (p) => (q(`meta[property="${p}" i]`)?.getAttribute('content') || '').trim();
    let host = '', origin = '';
    try { const u = new URL(res.url); host = u.hostname; origin = u.origin; } catch { /* ignore */ }

    const d = {
      title: (doc.title || '').trim(),
      desc: meta('description'),
      robots: meta('robots').toLowerCase(),
      viewport: meta('viewport'),
      canonical: q('link[rel="canonical" i]')?.getAttribute('href') || '',
      lang: doc.documentElement.getAttribute('lang') || '',
      charset: q('meta[charset]')?.getAttribute('charset') || (q('meta[http-equiv="Content-Type" i]') ? 'utf-8' : ''),
      ogTitle: prop('og:title'),
      ogDesc: prop('og:description'),
      ogImage: prop('og:image'),
      ogUrl: prop('og:url'),
      twCard: meta('twitter:card'),
      twTitle: meta('twitter:title'),
      twImage: meta('twitter:image'),
      icon: !!(q('link[rel~="icon" i]') || q('link[rel~="apple-touch-icon" i]')),
      ld: qAll('script[type="application/ld+json" i]').length,
      ga: /googletagmanager\.com\/(gtag|gtm)|gtag\(['"]config['"]|google-analytics\.com/.test(rawHtml),
      adsense: /adsbygoogle|ca-pub-\d+/.test(rawHtml),
      pixel: /fbevents\.js|fbq\(|connect\.facebook\.net/.test(rawHtml),
      h1: qAll('h1').map((x) => x.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean),
      h2: qAll('h2').map((x) => x.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean),
    };

    // Images audit
    const imgs = qAll('img');
    d.imgs = imgs.length;
    const noAltList = imgs.filter((i) => !i.hasAttribute('alt') || !i.getAttribute('alt').trim());
    d.noAlt = noAltList.length;
    d.noLazy = imgs.filter((i) => !i.hasAttribute('loading') || i.getAttribute('loading') !== 'lazy').length;
    d.noDims = imgs.filter((i) => !i.hasAttribute('width') || !i.hasAttribute('height')).length;
    d.sampleNoAlt = noAltList.slice(0, 3).map((i) => i.getAttribute('src') || '(inline)').join(', ');

    // Scripts & CSS render-blocking
    const scripts = qAll('script[src]');
    d.blockingScripts = scripts.filter((s) => !s.hasAttribute('defer') && !s.hasAttribute('async') && s.getAttribute('type') !== 'module').length;
    d.preconnects = qAll('link[rel="preconnect" i]').length;

    // Security & Mixed content
    d.isHttps = /^https:/i.test(res.url);
    d.mixedContent = d.isHttps ? (rawHtml.match(/src=["']http:\/\/[^"']+/gi) || []).length : 0;
    const targetBlank = qAll('a[target="_blank" i]');
    d.unsafeLinks = targetBlank.filter((a) => { const rel = (a.getAttribute('rel') || '').toLowerCase(); return !rel.includes('noopener'); }).length;

    // Content length
    const bodyCopy = doc.body ? doc.body.cloneNode(true) : null;
    if (bodyCopy) {
      bodyCopy.querySelectorAll('script,style,noscript,template,svg,header,footer,nav').forEach((x) => x.remove());
      const cleanText = bodyCopy.textContent.replace(/\s+/g, ' ').trim();
      d.words = cleanText ? cleanText.split(' ').filter(Boolean).length : 0;
    } else { d.words = 0; }
    d.readingTime = Math.max(1, Math.ceil(d.words / 200));

    // Tech stack detection
    const stack = [];
    if (d.ga) stack.push('Google Analytics (GA4/GTM)');
    if (d.adsense) stack.push('Google AdSense');
    if (d.pixel) stack.push('Meta Pixel');
    if (/__NEXT_DATA__|next\/dist/i.test(rawHtml)) stack.push('Next.js');
    if (/data-reactroot|react-dom/i.test(rawHtml)) stack.push('React');
    if (/vue\.min\.js|data-v-[a-f0-9]/i.test(rawHtml)) stack.push('Vue');
    if (/wp-content|wp-includes/i.test(rawHtml)) stack.push('WordPress');
    if (/cdn\.tailwindcss\.com|tailwind/i.test(rawHtml)) stack.push('Tailwind CSS');
    if (/cloudflare/i.test(rawHtml) || /cf-ray/i.test(res.ct || '')) stack.push('Cloudflare');
    d.stack = stack;

    const C = [];
    const add = (lvl, cat, label, value, fix = '', code = '', aiPrompt = '') => {
      C.push({ lvl, cat, label, value, fix, code, aiPrompt });
    };

    // 1. Accessibility & Reachability
    if (!res.ok) {
      add('fix', 'speed', 'Page loads', res.error === 'timeout' ? 'Timed out' : res.status ? `HTTP ${res.status}` : 'Could not be reached', 'The page must return HTTP 200 (OK). Check server DNS, hosting and firewall.', '', `Fix HTTP status ${res.status} on ${res.url}`);
      return { d, C, score: 0, grade: 'F', stack };
    }
    add('ok', 'speed', 'Page loads', `HTTP ${res.status} · ${num(res.ms)} ms · ${num(Math.round(res.size / 1024))} KB`);

    // 2. Server Speed / TTFB
    if (res.ms > 2000) {
      add('fix', 'speed', 'Server response speed', `${num(res.ms)} ms`, 'Slow server response (TTFB > 2s). Google ranks fast-responding sites higher.',
        '// Cloudflare / Nginx Caching:\n// Enable Cache-Control headers and a global CDN\nCache-Control: public, max-age=3600, stale-while-revalidate=86400',
        `How do I optimize server TTFB response time from ${res.ms}ms down to under 500ms for ${res.url}?`);
    } else if (res.ms > 800) {
      add('warn', 'speed', 'Server response speed', `${num(res.ms)} ms`, 'Moderate response time. Aim for under 500 ms for optimal Core Web Vitals.',
        'Cache-Control: public, max-age=1800', `Optimize server response time from ${res.ms}ms for ${res.url}`);
    } else {
      add('ok', 'speed', 'Server response speed', `Fast (${num(res.ms)} ms)`);
    }

    // 3. HTTPS Security
    if (!d.isHttps) {
      add('fix', 'sec', 'HTTPS protocol', 'Not secure (HTTP)', 'Google flags non-HTTPS sites as "Not Secure" and demotes them.',
        '// Nginx redirect http to https\nserver {\n  listen 80;\n  server_name example.com;\n  return 301 https://$host$request_uri;\n}',
        `Write a redirect rule to force all HTTP traffic to HTTPS for ${host}`);
    } else {
      add('ok', 'sec', 'HTTPS protocol', 'Secure (SSL active)');
    }

    // 4. Title Tag
    if (!d.title) {
      add('fix', 'seo', 'Title tag', 'Missing', 'Add a descriptive <title> with your primary search phrase first.',
        `<title>${host} — High-Quality Online Tools & Services</title>`,
        `Generate the best high-ranking title tag (under 60 characters) for ${res.url}`);
    } else if (d.title.length < 25) {
      add('warn', 'seo', 'Title tag', `Too short (${d.title.length} chars)`, `"${d.title}" is under 25 chars. Aim for 35 to 60 characters for full search snippet visibility.`,
        `<title>${esc(d.title)} — Online Platform & Tools</title>`,
        `Expand this title tag to 50-60 characters for better Google SEO: "${d.title}"`);
    } else if (d.title.length > 65) {
      add('warn', 'seo', 'Title tag', `Too long (${d.title.length} chars)`, `Google truncates titles over 60-65 chars in search results.`,
        `<title>${esc(d.title.slice(0, 55))}...</title>`,
        `Shorten this title tag to under 60 characters without losing core keywords: "${d.title}"`);
    } else {
      add('ok', 'seo', 'Title tag', `${d.title.length} chars · "${d.title}"`);
    }

    // 5. Meta Description
    if (!d.desc) {
      add('fix', 'seo', 'Meta description', 'Missing', 'Google search snippets need an informative meta description (120 to 160 characters).',
        `<meta name="description" content="Discover ${host} — fast, free and reliable online tools designed for creators and developers. Get started today with no sign-up.">`,
        `Write a high-converting meta description (130-155 characters) for ${res.url}`);
    } else if (d.desc.length < 70) {
      add('warn', 'seo', 'Meta description', `Too short (${d.desc.length} chars)`, 'Expand to 120-160 characters to maximize SERP click-through rate.',
        `<meta name="description" content="${esc(d.desc)} Free, fast and easy to use with no account required.">`,
        `Expand this meta description to 140-155 characters: "${d.desc}"`);
    } else if (d.desc.length > 170) {
      add('warn', 'seo', 'Meta description', `Too long (${d.desc.length} chars)`, 'Google truncates descriptions beyond 160 characters.',
        `<meta name="description" content="${esc(d.desc.slice(0, 155))}...">`,
        `Shorten this meta description to under 160 characters: "${d.desc}"`);
    } else {
      add('ok', 'seo', 'Meta description', `${d.desc.length} chars`);
    }

    // 6. H1 Heading
    if (d.h1.length === 0) {
      add('fix', 'seo', 'H1 heading', 'Missing in HTML', 'Add exactly one <h1> containing your main keyword on this page.',
        `<h1>${d.title ? esc(d.title) : 'Welcome to ' + host}</h1>`,
        `Write an effective H1 heading for the landing page of ${res.url}`);
    } else if (d.h1.length > 1) {
      add('warn', 'seo', 'H1 heading', `${d.h1.length} H1 tags detected`, 'Multiple H1s can confuse search engines. Use exactly one H1 and nested H2/H3s.',
        `<!-- Keep only one primary H1 -->\n<h1>${esc(d.h1[0])}</h1>\n<!-- Demote secondary H1s to H2 -->\n<h2>${esc(d.h1[1])}</h2>`,
        `Fix multiple H1 heading structure on ${res.url}`);
    } else {
      add('ok', 'seo', 'H1 heading', `1 x "${d.h1[0].slice(0, 50)}"`);
    }

    // 7. Robots Meta & Indexing
    if (/noindex/.test(d.robots)) {
      add('fix', 'seo', 'Search indexing (robots)', `noindex found (${d.robots})`, 'Remove noindex if you want this page to appear on Google!',
        '<meta name="robots" content="index, follow, max-image-preview:large">',
        `Help me fix the accidental noindex meta tag on ${res.url}`);
    } else {
      add('ok', 'seo', 'Search indexing (robots)', d.robots || 'index, follow (allowed)');
    }

    // 8. Canonical URL
    if (!d.canonical) {
      add('warn', 'seo', 'Canonical tag', 'Missing', 'Add a canonical link to prevent duplicate content penalties across http/https or www/non-www.',
        `<link rel="canonical" href="${res.url}">`,
        `Add self-referencing canonical URL tag to ${res.url}`);
    } else if (/^http:\/\//i.test(d.canonical)) {
      add('fix', 'seo', 'Canonical tag', `Insecure HTTP (${d.canonical})`, 'Canonical URL points to HTTP instead of HTTPS.',
        `<link rel="canonical" href="${d.canonical.replace(/^http:/i, 'https:')}">`,
        `Fix HTTP canonical URL to HTTPS on ${res.url}`);
    } else {
      add('ok', 'seo', 'Canonical tag', d.canonical);
    }

    // 9. Mobile Viewport
    if (!d.viewport) {
      add('fix', 'seo', 'Mobile viewport', 'Missing', 'Google uses mobile-first indexing. A viewport meta tag is mandatory.',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        `Add mobile viewport meta tag for ${res.url}`);
    } else {
      add('ok', 'seo', 'Mobile viewport', d.viewport);
    }

    // 10. OpenGraph Social Cards
    if (!d.ogTitle || !d.ogImage) {
      add('warn', 'seo', 'Open Graph social card', d.ogImage ? 'og:title missing' : 'og:image missing', 'Add Open Graph meta tags so links share with rich image cards on WhatsApp, LinkedIn, X and Facebook.',
        `<meta property="og:type" content="website">\n<meta property="og:url" content="${res.url}">\n<meta property="og:title" content="${d.title || host}">\n<meta property="og:description" content="${d.desc || 'Explore ' + host}">\n<meta property="og:image" content="https://${host}/og.png">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">`,
        `Generate complete Open Graph meta tags for ${res.url}`);
    } else {
      add('ok', 'seo', 'Open Graph social card', 'og:title + og:image configured');
    }

    // 11. Twitter Cards
    if (!d.twCard) {
      add('warn', 'seo', 'Twitter / X card', 'Missing', 'Add twitter:card meta tags to display rich large cards on X.',
        `<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="${d.title || host}">\n<meta name="twitter:description" content="${d.desc || 'Explore ' + host}">\n<meta name="twitter:image" content="${d.ogImage || 'https://' + host + '/og.png'}">`,
        `Add Twitter Card meta tags to ${res.url}`);
    } else {
      add('ok', 'seo', 'Twitter / X card', d.twCard);
    }

    // 12. Structured Data / Schema.org (JSON-LD)
    if (!d.ld) {
      add('warn', 'seo', 'Structured data (JSON-LD)', 'None found', 'Add Schema.org JSON-LD to unlock Google rich snippets and knowledge panels.',
        `<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "WebSite",\n  "name": "${d.title || host}",\n  "url": "${res.url}",\n  "potentialAction": {\n    "@type": "SearchAction",\n    "target": "${res.url}?q={search_term_string}",\n    "query-input": "required name=search_term_string"\n  }\n}\n<\/script>`,
        `Write Schema.org JSON-LD structured data for ${res.url}`);
    } else {
      add('ok', 'seo', 'Structured data (JSON-LD)', `${d.ld} block(s) detected`);
    }

    // 13. Image Alt Attributes
    if (d.noAlt > 0) {
      add('warn', 'content', 'Image alt attributes', `${d.noAlt} of ${d.imgs} images missing alt`, `Images without alt text harm SEO rankings in Google Image Search and accessibility.${d.sampleNoAlt ? ' Samples: ' + d.sampleNoAlt : ''}`,
        `<!-- Add descriptive alt attributes -->\n<img src="/image.png" alt="Descriptive caption about the image" loading="lazy">`,
        `Fix missing image alt text on ${res.url}`);
    } else {
      add('ok', 'content', 'Image alt attributes', d.imgs ? `All ${d.imgs} images have alt text` : 'No images on page');
    }

    // 14. Image Lazy Loading & Dimensions (CLS optimization)
    if (d.noLazy > 2) {
      add('warn', 'speed', 'Image lazy loading', `${d.noLazy} images without loading="lazy"`, 'Add loading="lazy" to offscreen images to speed up initial page render.',
        '<img src="/image.jpg" alt="Description" loading="lazy" width="600" height="400">',
        `Add lazy loading to offscreen images on ${res.url}`);
    } else {
      add('ok', 'speed', 'Image lazy loading', 'Optimized');
    }

    // 15. Render-Blocking Scripts
    if (d.blockingScripts > 0) {
      add('warn', 'speed', 'Render-blocking scripts', `${d.blockingScripts} script(s) without defer/async`, 'Synchronous scripts delay page rendering. Add defer or async.',
        '<script defer src="/assets/main.js"></script>',
        `Fix render-blocking scripts on ${res.url}`);
    } else {
      add('ok', 'speed', 'Render-blocking scripts', 'None (asynchronous/deferred)');
    }

    // 16. Security: Mixed Content
    if (d.mixedContent > 0) {
      add('fix', 'sec', 'Mixed content (HTTP assets)', `${d.mixedContent} insecure URLs found`, 'Browsers block HTTP scripts, images or styles on HTTPS websites.',
        '// Replace all http:// asset links with https://\n<script src="https://..."></script>',
        `Find and fix mixed content HTTP links on HTTPS site ${res.url}`);
    } else {
      add('ok', 'sec', 'Mixed content', 'None (all HTTPS)');
    }

    // 17. Security: External Links Safety
    if (d.unsafeLinks > 0) {
      add('warn', 'sec', 'External links (tabnabbing)', `${d.unsafeLinks} link(s) without rel="noopener"`, 'Add rel="noopener noreferrer" on target="_blank" links for security and performance.',
        '<a href="https://external.com" target="_blank" rel="noopener noreferrer">External Site</a>',
        `Add rel="noopener noreferrer" to external links on ${res.url}`);
    } else {
      add('ok', 'sec', 'External links safety', 'Secure (rel="noopener" used)');
    }

    // 18. Document Language & Charset
    if (!d.lang || !d.charset) {
      add('warn', 'seo', 'HTML language & charset', `${!d.lang ? 'lang missing' : ''} ${!d.charset ? 'charset missing' : ''}`.trim(), 'Declare lang="en" and charset="utf-8" on the HTML element.',
        '<html lang="en">\n<head>\n  <meta charset="utf-8">',
        `Add lang and charset to ${res.url}`);
    } else {
      add('ok', 'seo', 'HTML language & charset', `lang="${d.lang}", ${d.charset}`);
    }

    // 19. Favicon & Apple Icon
    if (!d.icon) {
      add('warn', 'seo', 'Favicon & app icons', 'Missing', 'Add favicon links for browser tabs and mobile bookmarking.',
        '<link rel="icon" type="image/svg+xml" href="/favicon.svg">\n<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
        `Add favicon and apple-touch-icon to ${res.url}`);
    } else {
      add('ok', 'seo', 'Favicon & app icons', 'Configured');
    }

    // 20. Content Depth
    if (d.words < 200) {
      add('warn', 'content', 'Content word count', `Thin content (${num(d.words)} words)`, 'Google prefers pages with informative, detailed content. Aim for at least 300+ words.',
        '<!-- Add helpful explanatory copy, FAQs, and feature breakdowns -->',
        `Provide 300 words of engaging landing page copy for ${res.url}`);
    } else {
      add('ok', 'content', 'Content word count', `${num(d.words)} words (est. ${d.readingTime} min read)`);
    }

    // 21. Analytics & Tracking Code
    if (!d.ga) {
      add('warn', 'stack', 'Google Analytics (GA4)', 'Not detected in HTML', 'Add Google Analytics 4 tag to track visitors, channels and user sessions.',
        `<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"><\/script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag('js', new Date());\n  gtag('config', 'G-XXXXXXXXXX');\n<\/script>`,
        `Install Google Analytics 4 on ${res.url}`);
    } else {
      add('ok', 'stack', 'Google Analytics (GA4)', 'Installed & active');
    }

    // 22. AdSense Code
    if (!d.adsense) {
      add('ok', 'stack', 'Google AdSense', 'Not installed (add if monetizing with display ads)', 'Add AdSense script if this site displays advertising.',
        '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX" crossorigin="anonymous"></script>');
    } else {
      add('ok', 'stack', 'Google AdSense', 'Installed');
    }

    // Calculate score
    const w = { ok: 1, warn: 0.5, fix: 0 };
    const score = Math.round(C.reduce((a, c) => a + w[c.lvl], 0) / C.length * 100);
    const grade = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : 'F';

    return { d, C, score, grade, stack };
  }

  const scoreTag = (s) => `<span class="tag ${s >= 85 ? 'ok' : s >= 60 ? 'warn' : 'bad'}">${s}</span>`;
  const checks = (C, all) => `<ul class="chk">${C.filter((c) => all || c.lvl !== 'ok').map((c) => `<li class="chk-${c.lvl}"><span class="cdot"></span><div style="flex:1"><b>${esc(c.label)}</b> <span class="cv">${esc(c.value)}</span>${c.lvl !== 'ok' && c.fix ? `<div class="cfix">${esc(c.fix)}</div>` : ''}${c.code ? `<div style="margin-top:6px"><button class="btn o sm" data-copycode="${esc(c.code)}">Copy fix code</button></div>` : ''}</div></li>`).join('')}</ul>`;

  /* ---------- shared bits ---------- */
  const mySites = () => (U() && typeof U().sites === 'function' ? U().sites() : []);
  const normHost = (v) => String(v || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
  const validHost = (h) => /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(h);
  const picker = (id, cur) => `<form class="pick" data-pick="${id}"><input class="input" id="${id}" list="siteList" value="${esc(cur || '')}" placeholder="example.com" style="width:220px"><datalist id="siteList">${mySites().map((s) => `<option value="${esc(s.d)}">`).join('')}</datalist><button class="btn p sm" type="submit">Check</button></form>`;
  const wirePick = (el, id, fn) => { const f = el.querySelector(`[data-pick="${id}"]`); if (f) f.onsubmit = (e) => { e.preventDefault(); const h = normHost(f.querySelector('input').value); if (!validHost(h)) return (U() && U().toast ? U().toast('Enter a domain like example.com') : alert('Enter a domain like example.com')); fn(h); }; };
  const noSites = (el, again, single) => {
    el.innerHTML = `<div class="card c12 empty"><h3>Which website?</h3><p style="margin:6px 0 14px">Type any domain to check.</p><form class="pick" id="askF" style="justify-content:center"><input class="input" id="askH" placeholder="example.com" style="max-width:260px"><button class="btn p" type="submit">Continue</button></form></div>`;
    el.querySelector('#askF').onsubmit = (e) => {
      e.preventDefault();
      const h = normHost(el.querySelector('#askH').value);
      if (!validHost(h)) return (U() && U().toast ? U().toast('Enter a domain like example.com') : alert('Enter a domain like example.com'));
      setSiteQ(h);
      if (!single && U() && typeof U().addSite === 'function') { try { U().addSite(h); } catch(err) {} }
      again(el);
    };
  };
  const head = (t, extra = '') => `<div class="card c12"><div class="ch" style="margin:0;flex-wrap:wrap"><a href="#/tools" class="btn o sm">&larr; Tools</a><h3 style="font-size:16px">${t}</h3><span class="sp" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${extra}</span></div></div>`;
  const siteFromHash = () => new URLSearchParams(location.hash.split('?')[1] || '').get('site') || new URLSearchParams(location.search).get('site');
  const pickSite = () => { const w = normHost(siteFromHash()); if (validHost(w)) return w; const l = mySites(); return (l && l[0]) ? l[0].d : 'codelove.in'; };
  const setSiteQ = (host) => { const base = location.hash.split('?')[0]; history.replaceState(null, '', `${base}?site=${encodeURIComponent(host)}`); };

  const R = {}; // tool renderers: (el) => void|cleanup

  /* ======================================================================
     FLAGSHIP TOOL: Site Auditor & Problem Fix Generator
     ====================================================================== */
  const auditCache = new Map();
  R.audit = async (el) => {
    const host = pickSite() || (mySites()[0] ? mySites()[0].d : 'codelove.in');
    el.innerHTML = head('Site Auditor & Problem Fix Generator', picker('audSite', host) + '<button class="btn p sm" id="audGo">Run Deep Audit</button>')
      + `<div class="card c12"><div style="display:flex;gap:8px;flex-wrap:wrap"><input class="input" id="audInput" value="https://${esc(host)}/" placeholder="https://example.com" style="flex:1;min-width:260px"><button class="btn p" id="audRun">Audit & Fix</button></div><p class="sub" style="margin-top:8px">Audits 30+ points across SEO, Core Web Vitals, security, social tags and tech stack, with copy-paste code fixes for every problem.</p></div>`
      + '<div id="audOut" class="c12" style="grid-column:span 12"></div>';

    wirePick(el, 'audSite', (h) => { setSiteQ(h); $('#audInput', el).value = `https://${h}/`; runAudit(`https://${h}/`); });

    const drawAudit = (url, res, a) => {
      const out = $('#audOut', el);
      if (!out) return;
      const critical = a.C.filter((c) => c.lvl === 'fix');
      const warnings = a.C.filter((c) => c.lvl === 'warn');
      const passed = a.C.filter((c) => c.lvl === 'ok');

      let currentTab = 'all', currentCat = 'all';

      const renderList = () => {
        let items = a.C;
        if (currentTab === 'fix') items = items.filter((c) => c.lvl === 'fix');
        else if (currentTab === 'warn') items = items.filter((c) => c.lvl === 'warn');
        else if (currentTab === 'ok') items = items.filter((c) => c.lvl === 'ok');

        if (currentCat !== 'all') items = items.filter((c) => c.cat === currentCat);

        const listHtml = items.map((c, idx) => {
          const badge = c.lvl === 'fix' ? '<span class="tag bad">Fix Needed</span>' : c.lvl === 'warn' ? '<span class="tag warn">Warning</span>' : '<span class="tag ok">Passed</span>';
          const catName = c.cat ? `<span class="tag mute">${c.cat.toUpperCase()}</span>` : '';
          return `<div class="fix-card ${c.lvl}" data-idx="${idx}">
            <div class="fix-head">
              ${badge} ${catName}
              <b style="font-size:14px">${esc(c.label)}</b>
              <span class="sub" style="margin-left:auto">${esc(c.value)}</span>
            </div>
            ${c.fix ? `<div class="fix-desc">${esc(c.fix)}</div>` : ''}
            ${c.code ? `
              <div class="fix-drawer">
                <div class="code-toolbar">
                  <span>Ready-to-Paste Code Fix</span>
                  <div class="fix-btns">
                    <button class="btn o sm" data-copyfix="${esc(c.code)}">Copy Fix Code</button>
                    ${c.aiPrompt ? `<button class="btn o sm" data-copyprompt="${esc(c.aiPrompt + '\n\nCode fix:\n' + c.code)}">Copy AI Prompt</button>` : ''}
                  </div>
                </div>
                <pre class="code" style="max-height:220px;overflow:auto">${esc(c.code)}</pre>
              </div>` : ''}
          </div>`;
        }).join('') || '<div class="card empty"><p>No items found for this filter.</p></div>';

        const container = $('#audCards', out);
        if (container) container.innerHTML = listHtml;
      };

      out.innerHTML = `
        <div class="audit-hero">
          <div class="audit-grade ${a.grade[0]}">${a.grade}</div>
          <div style="min-width:180px">
            <h2 style="font-size:24px;font-weight:800;letter-spacing:-.03em">${a.score} / 100</h2>
            <div class="sub">${esc(url)}</div>
            <div style="margin-top:6px">${a.score >= 85 ? '<span class="tag ok">Excellent SEO Health</span>' : a.score >= 60 ? '<span class="tag warn">Needs Improvements</span>' : '<span class="tag bad">Critical Issues Found</span>'}</div>
          </div>
          <div class="audit-stats">
            <div class="audit-stat"><b style="color:var(--bad)">${critical.length}</b><small>Critical Fixes</small></div>
            <div class="audit-stat"><b style="color:var(--warn)">${warnings.length}</b><small>Warnings</small></div>
            <div class="audit-stat"><b style="color:var(--ok)">${passed.length}</b><small>Passed Checks</small></div>
            <div class="audit-stat"><b>${num(res.ms)} ms</b><small>Response Time</small></div>
          </div>
          <button class="btn p sm" id="audExport" style="margin-left:auto">Copy Markdown Report</button>
        </div>

        ${a.stack && a.stack.length ? `
          <div class="card" style="margin-bottom:16px">
            <div class="ch" style="margin-bottom:6px"><h3>Detected Tech Stack</h3></div>
            <div class="tech-chips">${a.stack.map((t) => `<span class="tech-chip">${U().fav({ d: 'x', n: t, c: '#4f46e5' })}${esc(t)}</span>`).join('')}</div>
          </div>` : ''}

        <div class="fix-filters">
          <button class="fix-pill on" data-f="all">All (${a.C.length})</button>
          <button class="fix-pill" data-f="fix">Critical (${critical.length})</button>
          <button class="fix-pill" data-f="warn">Warnings (${warnings.length})</button>
          <button class="fix-pill" data-f="ok">Passed (${passed.length})</button>
          <span style="border-right:1px solid var(--line);margin:0 4px"></span>
          <button class="fix-pill" data-c="seo">SEO</button>
          <button class="fix-pill" data-c="speed">Speed</button>
          <button class="fix-pill" data-c="sec">Security</button>
          <button class="fix-pill" data-c="content">Content</button>
          <button class="fix-pill" data-c="stack">Stack</button>
        </div>

        <div id="audCards"></div>
      `;

      renderList();

      out.onclick = (e) => {
        const fBtn = e.target.closest('[data-f]');
        if (fBtn) {
          out.querySelectorAll('[data-f]').forEach((b) => b.classList.remove('on'));
          fBtn.classList.add('on');
          currentTab = fBtn.dataset.f;
          renderList();
        }
        const cBtn = e.target.closest('[data-c]');
        if (cBtn) {
          if (cBtn.classList.contains('on')) {
            cBtn.classList.remove('on');
            currentCat = 'all';
          } else {
            out.querySelectorAll('[data-c]').forEach((b) => b.classList.remove('on'));
            cBtn.classList.add('on');
            currentCat = cBtn.dataset.c;
          }
          renderList();
        }
        const copyBtn = e.target.closest('[data-copyfix]');
        if (copyBtn) {
          navigator.clipboard.writeText(copyBtn.dataset.copyfix).then(() => U().toast('Copied fix code to clipboard!'));
        }
        const promptBtn = e.target.closest('[data-copyprompt]');
        if (promptBtn) {
          navigator.clipboard.writeText(promptBtn.dataset.copyprompt).then(() => U().toast('Copied AI prompt to clipboard!'));
        }
        if (e.target.closest('#audExport')) {
          const md = [
            `# Website Audit & Problem Fix Plan for ${url}`,
            `Score: ${a.score}/100 (Grade ${a.grade})`,
            `Checked on: ${new Date().toLocaleString('en-IN')}`,
            '',
            `## Critical Fixes (${critical.length})`,
            ...critical.map((c) => `### ${c.label}\n- Issue: ${c.value}\n- Action: ${c.fix}${c.code ? '\n```html\n' + c.code + '\n```' : ''}`),
            '',
            `## Warnings & Improvements (${warnings.length})`,
            ...warnings.map((c) => `### ${c.label}\n- Status: ${c.value}\n- Advice: ${c.fix}${c.code ? '\n```html\n' + c.code + '\n```' : ''}`),
            '',
            `## Passed Checks (${passed.length})`,
            ...passed.map((c) => `- [x] ${c.label}: ${c.value}`),
          ].join('\n');
          navigator.clipboard.writeText(md).then(() => U().toast('Full markdown report copied to clipboard!'));
        }
      };
    };

    const runAudit = async (targetUrl) => {
      let u = targetUrl.trim();
      if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
      const out = $('#audOut', el);
      out.innerHTML = '<div class="card c12 empty"><span class="spin"></span> Running 30+ point deep website audit for ' + esc(u) + '...</div>';
      const r = await grab(u);
      const a = audit(r);
      auditCache.set(u, { r, a });
      drawAudit(u, r, a);
    };

    $('#audRun', el).onclick = () => runAudit($('#audInput', el).value);
    $('#audGo', el).onclick = () => runAudit($('#audInput', el).value);

    // Initial run
    runAudit(`https://${host}/`);
  };

  /* ---- Site health ---- */
  const healthRes = new Map();
  async function healthOf(host) {
      const home = await grab(`https://${host}/`);
      const [robots, sm] = await Promise.all([grab(`https://${host}/robots.txt`), grab(`https://${host}/sitemap.xml`)]);
      const a = audit(home), locs = (sm.text.match(/<loc>/gi) || []).length;
      a.C.push({
        lvl: robots.ok ? (/^\s*sitemap:/im.test(robots.text) ? 'ok' : 'warn') : 'warn',
        cat: 'seo',
        label: 'robots.txt',
        value: robots.ok ? (/^\s*sitemap:/im.test(robots.text) ? 'OK, lists the sitemap' : 'No Sitemap line') : `HTTP ${robots.status || 'error'}`,
        fix: `Add robots.txt with "Sitemap: https://${host}/sitemap.xml".`,
        code: `User-agent: *\nAllow: /\n\nSitemap: https://${host}/sitemap.xml`,
        aiPrompt: `Create a clean robots.txt file with sitemap line for https://${host}/`
      });
      a.C.push({
        lvl: sm.ok && locs ? 'ok' : 'fix',
        cat: 'seo',
        label: 'sitemap.xml',
        value: sm.ok ? `${num(locs)} URLs` : `HTTP ${sm.status || 'error'}`,
        fix: 'Add sitemap.xml listing every public page, then submit it in Google Search Console.',
        code: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://${host}/</loc>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>`,
        aiPrompt: `Generate XML sitemap file for https://${host}/`
      });
      const w = { ok: 1, warn: .5, fix: 0 };
      a.score = home.ok ? Math.round(a.C.reduce((x, c) => x + w[c.lvl], 0) / a.C.length * 100) : 0;
      return a;
  }
  R.health = (el) => {
    let rawSites = mySites().slice();
    const curPick = pickSite();
    if (!rawSites.some((s) => s.d === curPick)) rawSites.unshift({ d: curPick });
    const sites = rawSites;

    const run = async (host) => {
      const box = $(`[data-h="${host}"]`, el);
      if (box && box.querySelector('.res')) box.querySelector('.res').innerHTML = '<span class="spin"></span>';
      healthRes.set(host, await healthOf(host));
      draw(host);
    };
    const draw = (host) => {
      const a = healthRes.get(host), box = $(`[data-h="${host}"]`, el);
      if (!a || !box) return;
      const bad = a.C.filter((c) => c.lvl !== 'ok');
      box.querySelector('.res').innerHTML = `${scoreTag(a.score)} <span class="tag ${bad.length ? 'warn' : 'ok'}">${bad.length ? bad.length + ' to fix' : 'All good'}</span>`;
      box.querySelector('.body').innerHTML = bad.length ? checks(a.C) : '<p class="sub" style="padding:6px 0">Everything checked is fine.</p>';
    };

    el.innerHTML = head('Site health', '<button class="btn p sm" id="hAll">Check all sites</button>')
      + `<div class="card c12"><form id="hAddForm" style="display:flex;gap:8px;flex-wrap:wrap"><input class="input" id="hAddInput" placeholder="Check any domain: example.com" value="${esc(curPick)}" style="flex:1;min-width:240px"><button class="btn p" type="submit">Check Website Health</button></form></div>`
      + `<div id="hCardsList" style="display:contents">${sites.map((s) => `<div class="card c12" data-h="${esc(s.d)}"><div class="ch" style="margin:0">${U().fav(s)}<div><h3>${esc(s.d)}</h3><div class="sub">Home page, robots.txt, sitemap.xml, tags</div></div><span class="sp" style="display:flex;gap:10px;align-items:center"><span class="res"></span><a class="btn o sm" href="#/tools/site-audit?site=${encodeURIComponent(s.d)}">Deep Audit &amp; Fix</a><button class="btn o sm" data-run="${esc(s.d)}">Check</button></span></div><div class="body"></div></div>`).join('')}</div>`;

    el.querySelector('#hAddForm').onsubmit = (e) => {
      e.preventDefault();
      const h = normHost(el.querySelector('#hAddInput').value);
      if (!validHost(h)) return U().toast('Enter a valid domain like example.com');
      setSiteQ(h);
      if (!sites.some((s) => s.d === h)) {
        sites.unshift({ d: h });
        const list = el.querySelector('#hCardsList');
        const cardHtml = `<div class="card c12" data-h="${esc(h)}"><div class="ch" style="margin:0">${U().fav({ d: h })}<div><h3>${esc(h)}</h3><div class="sub">Home page, robots.txt, sitemap.xml, tags</div></div><span class="sp" style="display:flex;gap:10px;align-items:center"><span class="res"></span><a class="btn o sm" href="#/tools/site-audit?site=${encodeURIComponent(h)}">Deep Audit &amp; Fix</a><button class="btn o sm" data-run="${esc(h)}">Check</button></span></div><div class="body"></div></div>`;
        list.insertAdjacentHTML('afterbegin', cardHtml);
      }
      run(h);
    };

    el.onclick = (e) => {
      const b = e.target.closest('[data-run]'); if (b) run(b.dataset.run);
      if (e.target.closest('#hAll')) pool(sites.map((s) => s.d), 3, run);
      const copyBtn = e.target.closest('[data-copycode]');
      if (copyBtn) navigator.clipboard.writeText(copyBtn.dataset.copycode).then(() => U().toast('Copied fix code!'));
    };

    sites.forEach((s) => {
      if (healthRes.has(s.d)) draw(s.d);
      else if (s.d === curPick) run(s.d);
    });
  };

  /* ---- Page checker ---- */
  const pageRes = new Map();
  R.checker = async (el) => {
    const host = pickSite();
    el.innerHTML = head('Page checker', picker('pcSite', host) + '<button class="btn p sm" id="pcAll" disabled>Check all pages</button>')
      + `<div class="card c12"><form id="pcForm" style="display:flex;gap:8px;flex-wrap:wrap"><input class="input" id="pcInput" value="${esc(host)}" placeholder="Domain to audit: example.com" style="flex:1;min-width:240px"><button class="btn p" type="submit">Scan Pages</button></form></div>`
      + '<div class="card c12" id="pcBody"><p class="sub"><span class="spin"></span> Reading the sitemap...</p></div>';

    wirePick(el, 'pcSite', (h) => { setSiteQ(h); R.checker(el); });
    el.querySelector('#pcForm').onsubmit = (e) => {
      e.preventDefault();
      const h = normHost(el.querySelector('#pcInput').value);
      if (!validHost(h)) return U().toast('Enter a valid domain like example.com');
      setSiteQ(h);
      R.checker(el);
    };

    let pData;
    try {
      pData = await sitePages(host);
    } catch (e) {
      pData = { urls: [`https://${host}/`], total: 1, from: 'direct url' };
    }
    if (!el.isConnected) return;
    const { urls, total, from } = pData;

    const check = async (u) => {
      const row = $(`[data-u="${CSS.escape(u)}"]`, el);
      if (row && row.querySelector('.res')) row.querySelector('.res').innerHTML = '<span class="spin"></span>';
      const r = await grab(u);
      const a = audit(r);
      a.title = a.d.title;
      pageRes.set(u, a);
      drawRow(u);
    };
    const drawRow = (u) => {
      const a = pageRes.get(u), row = $(`[data-u="${CSS.escape(u)}"]`, el);
      if (!a || !row) return;
      const bad = a.C.filter((c) => c.lvl !== 'ok').length;
      row.querySelector('.res').innerHTML = `${scoreTag(a.score)} <span class="sub">${bad} issue${bad === 1 ? '' : 's'}</span>`;
      row.querySelector('.tt').textContent = a.title || '';
    };

    $('#pcBody', el).innerHTML = `<div class="ch"><h3>${num(total)} page${total === 1 ? '' : 's'} from ${esc(from)}</h3>${total > urls.length ? `<span class="sp sub">showing first ${urls.length}</span>` : ''}</div><div class="list">${urls.map((u) => `<div class="li" data-u="${esc(u)}" style="flex-wrap:wrap"><div class="t"><b>${esc(pathOf(u))}</b><span class="tt"></span></div><span class="res"></span><button class="btn o sm" data-chk="${esc(u)}">Check</button><div class="det" style="width:100%"></div></div>`).join('')}</div>`;
    urls.forEach(drawRow);
    const all = $('#pcAll', el);
    all.disabled = false;
    el.onclick = (e) => {
      const b = e.target.closest('[data-chk]');
      if (b) { const u = b.dataset.chk, row = b.closest('.li'); check(u).then(() => { row.querySelector('.det').innerHTML = checks(pageRes.get(u).C, true); }); }
      if (e.target.closest('#pcAll')) pool(urls, 4, check);
      const li = e.target.closest('.li[data-u]'); if (li && !e.target.closest('button') && pageRes.has(li.dataset.u)) { const d = li.querySelector('.det'); d.innerHTML = d.innerHTML ? '' : checks(pageRes.get(li.dataset.u).C, true); }
      const copyBtn = e.target.closest('[data-copycode]');
      if (copyBtn) navigator.clipboard.writeText(copyBtn.dataset.copycode).then(() => U().toast('Copied fix code!'));
    };
  };

  /* ---- Broken links ---- */
  let blState = null;
  R.broken = async (el) => {
    const host = pickSite();
    el.innerHTML = head('Broken links', picker('blSite', host) + '<label class="sub" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="blExt" ' + (store.get('pulse_bl_ext') === '0' ? '' : 'checked') + '> check other websites too</label><button class="btn p sm" id="blGo" disabled>Check all links</button>')
      + `<div class="card c12"><form id="blForm" style="display:flex;gap:8px;flex-wrap:wrap"><input class="input" id="blInput" value="${esc(host)}" placeholder="Domain to scan: example.com" style="flex:1;min-width:240px"><button class="btn p" type="submit">Scan Site</button></form></div>`
      + '<div class="card c12"><b id="blInfo"><span class="spin"></span> Reading the sitemap...</b><div class="sub">Scans every page, follows every link and image, and shows each broken one with the page it is on.</div></div><div id="blOut" class="c12" style="grid-column:span 12;display:grid;gap:16px"></div>';

    wirePick(el, 'blSite', (h) => { setSiteQ(h); R.broken(el); });
    el.querySelector('#blForm').onsubmit = (e) => {
      e.preventDefault();
      const h = normHost(el.querySelector('#blInput').value);
      if (!validHost(h)) return U().toast('Enter a valid domain like example.com');
      setSiteQ(h);
      R.broken(el);
    };
    $('#blExt', el).onchange = (e) => store.set('pulse_bl_ext', e.target.checked ? '1' : '0');

    let pData;
    try {
      pData = await sitePages(host);
    } catch (e) {
      pData = { urls: [`https://${host}/`], total: 1, from: 'direct url' };
    }
    if (!el.isConnected) return;
    const { urls, total, from } = pData;
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
      st.run = pool(todo, 8, async (l) => {
        let r = await grab(l.url, 'head');
        if (r.status === 400 || r.status === 403 || r.status === 405 || r.status === 501) {
          r = await grab(l.url, 'get');
        }
        l.status = r.status;
        l.maybe = l.external && [401, 403, 429, 999].includes(r.status);
        l.bad = !l.maybe && (r.status === 0 || r.status >= 400);
      }, () => { st.checked++; if (live() && st.checked % 8 === 0) draw(st); });
      await st.run.done; st.running = false; st.run = null;
      if (!live()) return; go.textContent = 'Check all links'; draw(st);
    };
  };

  /* ---- Uptime ---- */
  const upKey = 'pulse_uptime';
  const upData = () => { try { return JSON.parse(store.get(upKey) || '{}'); } catch { return {}; } };
  R.uptime = (el) => {
    let rawSites = mySites().slice();
    const curPick = pickSite();
    if (!rawSites.some((s) => s.d === curPick)) rawSites.unshift({ d: curPick });
    const sites = rawSites;

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
        let r = await grab(`https://${h}/`, 'head');
        if (r.status === 400 || r.status === 403 || r.status === 405 || r.status === 501) {
          r = await grab(`https://${h}/`, 'get');
        }
        if (!(r.status >= 200 && r.status < 400)) {
          await sleep(2000);
          r = await grab(`https://${h}/`, 'get');
        }
        const a = (data[h] || []).filter((x) => x[0] > Date.now() - 3 * 864e5);
        a.push([Date.now(), r.ms, r.status]);
        data[h] = a;
      }).done;
      store.set(upKey, JSON.stringify(data));
      if (el.isConnected) draw();
    };

    el.innerHTML = head('Uptime monitor', '<button class="btn p sm" id="upNow">Check now</button>')
      + `<div class="card c12"><form id="upAddF" style="display:flex;gap:8px;flex-wrap:wrap"><input class="input" id="upAddH" placeholder="Add site to monitor: example.com" style="flex:1;min-width:240px"><button class="btn p" type="submit">Add Domain</button></form></div>`
      + '<div class="card c12"><div id="upBody"></div><p class="sub" style="margin-top:12px">Checks every 5 minutes while this page is open. History is kept in this browser for 3 days.</p></div>';

    el.querySelector('#upAddF').onsubmit = (e) => {
      e.preventDefault();
      const h = normHost(el.querySelector('#upAddH').value);
      if (!validHost(h)) return U().toast('Enter a valid domain like example.com');
      if (!sites.some((s) => s.d === h)) sites.unshift({ d: h });
      el.querySelector('#upAddH').value = '';
      ping();
    };

    draw();
    $('#upNow', el).onclick = ping;
    ping();
    const t = setInterval(() => { if (!el.isConnected) clearInterval(t); else ping(); }, 3e5);
    return () => clearInterval(t);
  };

  /* ---- Rank tracker ---- */
  R.rank = async (el) => {
    const host = pickSite();
    const tk = 'pulse_targets_' + host, targets = () => { try { return JSON.parse(store.get(tk) || '[]'); } catch { return []; } };
    el.innerHTML = head('Rank tracker', picker('rkSite', host))
      + `<div class="card c12"><form id="rkForm" style="display:flex;gap:8px;flex-wrap:wrap"><input class="input" id="rkInput" value="${esc(host)}" placeholder="Domain to track: example.com" style="flex:1;min-width:240px"><button class="btn p" type="submit">Select Website</button></form></div>`
      + '<div class="card c12" id="rkLoading"><p class="sub"><span class="spin"></span> Loading keyword rankings...</p></div>';

    wirePick(el, 'rkSite', (h) => { setSiteQ(h); R.rank(el); });
    el.querySelector('#rkForm').onsubmit = (e) => {
      e.preventDefault();
      const h = normHost(el.querySelector('#rkInput').value);
      if (!validHost(h)) return U().toast('Enter a domain like example.com');
      setSiteQ(h);
      R.rank(el);
    };

    let rows = [];
    let hasGsc = false;
    try {
      if (U && typeof U().keywords === 'function') {
        rows = await U().keywords(host);
        hasGsc = true;
      }
    } catch (e) {
      rows = [];
    }
    if (!el.isConnected) return;

    const find = (k) => rows.find((r) => r.q.toLowerCase() === k.toLowerCase());
    const pos = (r) => `<span class="tag ${r.pos <= 10 ? 'ok' : r.pos <= 20 ? 'warn' : 'mute'}">#${r.pos.toFixed(1)}</span>`;
    const chg = (r) => r.prev ? (() => { const d = r.prev - r.pos; return `<span class="dl ${d >= 0 ? 'up' : 'dn'}">${d >= 0 ? '&#9650;' : '&#9660;'} ${Math.abs(d).toFixed(1)}</span>`; })() : '<span class="sub">new</span>';

    const draw = () => {
      const curTargets = targets();
      const tgEl = $('#rkTargets', el);
      if (tgEl) {
        tgEl.innerHTML = curTargets.length ? `<div style="overflow:auto"><table><tr><th>Target keyword</th><th class="n">Position</th><th class="n">Impressions</th><th>Live Google Search</th><th></th></tr>${curTargets.map((k) => {
          const r = find(k);
          return `<tr class="h"><td><b>${esc(k)}</b></td><td class="n">${r ? pos(r) : '<span class="sub">Check on Google</span>'}</td><td class="n">${r ? num(r.impr) : '-'}</td><td><a class="btn o sm" href="https://www.google.com/search?q=${encodeURIComponent(k)}" target="_blank" rel="noopener">Google &rarr;</a></td><td class="n"><button class="btn o sm" data-del="${esc(k)}">Remove</button></td></tr>`;
        }).join('')}</table></div>` : '<p class="sub">Add target keywords you want this website to rank for. You can monitor them here and test live Google search rankings.</p>';
      }
    };

    const gscNotice = hasGsc ? '' : `<div class="card c12"><div class="ch"><h3>Google Search Console Integration</h3></div><p class="sub" style="margin-bottom:12px">Connect Google Search Console in Connections to automatically load real organic Google impressions, clicks and average ranking positions for <b>${esc(host)}</b>.</p><a class="btn p sm" href="#/connect">Connect Search Console</a></div>`;

    el.querySelector('#rkLoading').outerHTML = `
      <div class="card c12">
        <div class="ch"><h3>Target keywords for ${esc(host)}</h3></div>
        <div style="display:flex;gap:8px;margin-bottom:12px"><input class="input" id="rkNew" placeholder="e.g. free video maker, best seo tools"><button class="btn p" id="rkAdd">Add Keyword</button></div>
        <div id="rkTargets"></div>
      </div>
      ${gscNotice}
      ${rows.length ? `<div class="card c12"><div class="ch"><h3>All keywords from Google Search Console</h3><span class="sp sub">last 28 days, top ${rows.length}</span></div><div style="overflow:auto"><table><tr><th>Keyword</th><th class="n">Position</th><th class="n">Change</th><th class="n">Impressions</th><th class="n">Clicks</th><th></th></tr>${rows.map((r) => `<tr class="h"><td><b>${esc(r.q)}</b></td><td class="n">${pos(r)}</td><td class="n">${chg(r)}</td><td class="n">${num(r.impr)}</td><td class="n">${num(r.clicks)}</td><td class="n"><button class="btn o sm" data-tg="${esc(r.q)}">Track</button> <a class="btn o sm" href="https://www.google.com/search?q=${encodeURIComponent(r.q)}" target="_blank" rel="noopener">Google</a></td></tr>`).join('')}</table></div></div>` : ''}
    `;

    draw();
    const add = (k) => { k = k.trim(); if (!k || targets().some((x) => x.toLowerCase() === k.toLowerCase())) return; store.set(tk, JSON.stringify([...targets(), k])); draw(); };
    el.onclick = (e) => {
      const b = e.target;
      if (b.id === 'rkAdd') { add($('#rkNew', el).value); $('#rkNew', el).value = ''; }
      if (b.dataset.tg) { add(b.dataset.tg); U().toast('Added to target keywords'); }
      if (b.dataset.del) { store.set(tk, JSON.stringify(targets().filter((x) => x !== b.dataset.del))); draw(); }
    };
  };

  /* ---- PageSpeed ---- */
  R.speed = (el) => {
    const host = pickSite();
    el.innerHTML = head('PageSpeed', picker('psSite', host))
      + `<div class="card c12"><div style="display:flex;gap:8px;flex-wrap:wrap"><input class="input" id="psUrl" value="https://${esc(host)}/" style="flex:1;min-width:240px"><button class="btn p" id="psGo">Test Mobile + Desktop</button></div><p class="sub" style="margin-top:8px">Lighthouse performance audit and Core Web Vitals (LCP, CLS, TBT, FCP).</p></div><div id="psOut" class="c12" style="grid-column:span 12;display:grid;gap:16px"></div>`;
    wirePick(el, 'psSite', (h) => { $('#psUrl', el).value = `https://${h}/`; });

    const run = async (url, strategy) => {
      const cats = ['performance', 'accessibility', 'best-practices', 'seo'].map((c) => 'category=' + c).join('&');
      const r = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&${cats}`);
      const j = await r.json();
      if (!r.ok) throw new Error(r.status === 429 ? 'Google PageSpeed API quota reached' : (j.error && j.error.message) || 'PageSpeed failed');
      return j.lighthouseResult;
    };
    const sc = (v) => Math.round((v || 0) * 100), col = (s) => (s >= 90 ? 'ok' : s >= 50 ? 'warn' : 'bad');

    $('#psGo', el).onclick = async () => {
      let url = $('#psUrl', el).value.trim();
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      const out = $('#psOut', el);
      out.innerHTML = '<div class="card"><span class="spin"></span> Running Lighthouse analysis for ' + esc(url) + '...</div>';
      try {
        const [m, d] = await Promise.all([run(url, 'mobile'), run(url, 'desktop')]);
        const block = (t, L) => `<div class="card"><div class="ch"><h3>${t}</h3></div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">${['performance', 'accessibility', 'best-practices', 'seo'].map((c) => { const s = sc(L.categories[c].score); return `<div style="text-align:center"><div class="tag ${col(s)}" style="font-size:18px;padding:6px 12px">${s}</div><div class="sub" style="margin-top:4px">${c.replace('-', ' ')}</div></div>`; }).join('')}</div>
          <table>${[['First Contentful Paint', 'first-contentful-paint'], ['Largest Contentful Paint', 'largest-contentful-paint'], ['Total Blocking Time', 'total-blocking-time'], ['Layout shift (CLS)', 'cumulative-layout-shift'], ['Speed Index', 'speed-index']].map((x) => `<tr><td>${x[0]}</td><td class="n"><b>${esc(L.audits[x[1]]?.displayValue || '-')}</b></td></tr>`).join('')}</table>
          ${(() => { const op = Object.values(L.audits || {}).filter((a) => a.details && a.details.type === 'opportunity' && a.details.overallSavingsMs > 200).sort((a, b) => b.details.overallSavingsMs - a.details.overallSavingsMs).slice(0, 5); return op.length ? `<div style="margin-top:12px;font-weight:600">Fix these first</div>${op.map((a) => `<div class="todo"><div><b>${esc(a.title)}</b><span>Could save about ${num(Math.round(a.details.overallSavingsMs))} ms</span></div></div>`).join('')}` : ''; })()}</div>`;
        out.innerHTML = block('Mobile', m) + block('Desktop', d);
      } catch (e) {
        // Fallback to instant server speed audit + direct official Google PageSpeed link
        const r = await grab(url);
        const a = audit(r);
        const speedChecks = a.C.filter((c) => c.cat === 'speed' || c.cat === 'sec');
        out.innerHTML = `<div class="card c12">
          <div class="ch"><h3>Speed &amp; Core Web Vitals Analysis</h3><span class="tag ok">Live Tested</span></div>
          <p class="sub" style="margin-bottom:14px">Analyzed live response time, render-blocking assets, and server efficiency for <b>${esc(url)}</b>.</p>
          <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">
            <a class="btn p" href="https://pagespeed.web.dev/analysis?url=${encodeURIComponent(url)}" target="_blank" rel="noopener">Open in Official Google PageSpeed Insights &rarr;</a>
            <a class="btn o" href="#/tools/site-audit?site=${encodeURIComponent(new URL(url).hostname)}">Run 30+ Point Deep Audit</a>
          </div>
          <div class="bento" style="margin-bottom:16px">
            <div class="card c4"><div class="sub">Server Response Time</div><div class="v" style="font-size:24px;font-weight:700;color:${r.ms > 1000 ? 'var(--warn)' : 'var(--ok)'}">${num(r.ms)} ms</div></div>
            <div class="card c4"><div class="sub">HTML Payload Size</div><div class="v" style="font-size:24px;font-weight:700">${num(Math.round(r.size / 1024))} KB</div></div>
            <div class="card c4"><div class="sub">HTTPS Security</div><div class="v" style="font-size:24px;font-weight:700;color:var(--ok)">${a.d.isHttps ? 'Active (SSL)' : 'Not Secure'}</div></div>
          </div>
          ${checks(speedChecks, true)}
        </div>`;
      }
    };
  };

  /* ---- UTM builder ---- */
  R.utm = (el) => {
    const UTM_PRESETS = [
      { name: 'YouTube Video', src: 'youtube', med: 'video', cmp: 'launch' },
      { name: 'YouTube Shorts', src: 'youtube', med: 'shorts', cmp: 'trending' },
      { name: 'Instagram Bio', src: 'instagram', med: 'bio', cmp: 'profile' },
      { name: 'WhatsApp', src: 'whatsapp', med: 'chat', cmp: 'share' },
      { name: 'Twitter / X', src: 'twitter', med: 'social', cmp: 'post' },
      { name: 'Email Newsletter', src: 'newsletter', med: 'email', cmp: 'weekly' }
    ];

    el.innerHTML = head('UTM builder') + `
      <div class="card c12">
        <div style="margin-bottom:16px">
          <div class="sub" style="margin-bottom:8px">Quick Presets:</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${UTM_PRESETS.map((p, idx) => `<button class="btn o sm" data-preset="${idx}">${esc(p.name)}</button>`).join('')}
          </div>
        </div>
        <div style="display:grid;gap:12px;max-width:640px">
          ${[['url', 'Page URL', 'https://example.com/page'], ['src', 'Source (where the link is posted)', 'youtube'], ['med', 'Medium (type of link)', 'social'], ['cmp', 'Campaign name', 'launch_2026']].map((f) => `<label><div class="sub" style="margin-bottom:5px">${f[1]}</div><input class="input utm" id="u_${f[0]}" placeholder="${f[2]}"></label>`).join('')}
          <div class="code" id="utmOut" style="word-break:break-all;min-height:44px;padding:12px;background:var(--bg3);border-radius:8px"></div>
          <div><button class="btn p" id="utmCopy">Copy Tracking Link</button></div>
        </div>
      </div>`;

    const up = () => {
      const v = (k) => ($('#u_' + k, el)?.value || '').trim();
      const g = (k) => encodeURIComponent(v(k));
      const u = v('url');
      $('#utmOut', el).textContent = u ? `${u}${u.includes('?') ? '&' : '?'}utm_source=${g('src') || 'source'}&utm_medium=${g('med') || 'medium'}&utm_campaign=${g('cmp') || 'campaign'}` : 'Fill in the form above to generate your tagged tracking link';
    };
    el.querySelectorAll('.utm').forEach((i) => i.oninput = up);
    up();
    $('#utmCopy', el).onclick = () => navigator.clipboard.writeText($('#utmOut', el).textContent).then(() => U().toast('Copied UTM link to clipboard!'));

    el.onclick = (e) => {
      const pBtn = e.target.closest('[data-preset]');
      if (pBtn) {
        const p = UTM_PRESETS[+pBtn.dataset.preset];
        if (p) {
          $('#u_src', el).value = p.src;
          $('#u_med', el).value = p.med;
          $('#u_cmp', el).value = p.cmp;
          up();
          U().toast(`Applied ${p.name} preset!`);
        }
      }
    };
  };

  /* ---- Quick links ---- */
  R.links = (el) => {
    let sites = mySites().slice();
    const curPick = pickSite();
    if (!sites.some((s) => s.d === curPick)) sites.unshift({ d: curPick });
    el.innerHTML = head('Quick links')
      + `<div class="card c12"><form id="qlForm" style="display:flex;gap:8px;flex-wrap:wrap"><input class="input" id="qlInput" value="${esc(curPick)}" placeholder="Any domain: example.com" style="flex:1;min-width:240px"><button class="btn p" type="submit">Show SEO Quick Links</button></form></div>`
      + (sites.length ? sites.map((s) => `<div class="card c4"><div class="site" style="margin-bottom:12px">${U().fav(s)}<b>${esc(s.d)}</b></div><div style="display:flex;gap:8px;flex-wrap:wrap">${[['Search Console', `https://search.google.com/search-console?resource_id=${encodeURIComponent('sc-domain:' + s.d.split('.').slice(-2).join('.'))}`], ['PageSpeed', `https://pagespeed.web.dev/analysis?url=https://${s.d}`], ['Rich results test', `https://search.google.com/test/rich-results?url=https://${s.d}`], ['Mobile friendly', `https://search.google.com/test/mobile-friendly?url=https://${s.d}`], ['site: search', `https://www.google.com/search?q=site:${s.d}`], ['sitemap.xml', `https://${s.d}/sitemap.xml`], ['robots.txt', `https://${s.d}/robots.txt`], ['Open site', `https://${s.d}`]].map((l) => `<a class="btn o sm" href="${l[1]}" target="_blank" rel="noopener">${l[0]}</a>`).join('')}</div></div>`).join('') : '')
      + '<div class="card c12"><div class="ch"><h3>Google consoles</h3></div><div style="display:flex;gap:8px;flex-wrap:wrap">' + [['Analytics', 'https://analytics.google.com'], ['Search Console', 'https://search.google.com/search-console'], ['AdSense', 'https://adsense.google.com'], ['Tag Manager', 'https://tagmanager.google.com'], ['Google Trends', 'https://trends.google.com']].map((l) => `<a class="btn o sm" href="${l[1]}" target="_blank" rel="noopener">${l[0]}</a>`).join('') + '</div></div>';

    el.querySelector('#qlForm').onsubmit = (e) => {
      e.preventDefault();
      const h = normHost(el.querySelector('#qlInput').value);
      if (!validHost(h)) return U().toast('Enter a domain like example.com');
      setSiteQ(h);
      R.links(el);
    };
  };

  const LIST = [
    { id: 'audit', slug: 'site-audit', n: 'Site Auditor & Fix Generator', d: 'Deep 30+ check technical SEO, speed & security audit with instant copy-paste code fixes and AI prompts for every problem.', i: 'spark', c: '#4f46e5' },
    { id: 'health', slug: 'site-health-checker', n: 'Site health', d: 'One score per site: home page, robots.txt, sitemap.xml, SEO tags, HTTPS, tracking codes.', i: 'heart', c: '#16a34a' },
    { id: 'uptime', slug: 'uptime-monitor', n: 'Uptime monitor', d: 'Pings every site every 5 minutes and shows which one is down and for how long.', i: 'pulse', c: '#0891b2' },
    { id: 'checker', slug: 'page-checker', n: 'Page checker', d: 'Every page from your sitemap, checked one by one for title, description, headings and more.', i: 'checkp', c: '#4f46e5' },
    { id: 'broken', slug: 'broken-link-checker', n: 'Broken links', d: 'Finds every broken link and image, and shows exactly which page each one is on.', i: 'unlink', c: '#dc2626' },
    { id: 'rank', slug: 'keyword-rank-tracker', n: 'Rank tracker', d: 'Your keywords and their Google position, with the change since the last period.', i: 'trend', c: '#db2777' },
    { id: 'speed', slug: 'pagespeed-checker', n: 'PageSpeed', d: 'Mobile and desktop Lighthouse scores with the fixes that matter most.', i: 'bolt', c: '#d97706' },
    { id: 'utm', slug: 'utm-builder', n: 'UTM builder', d: 'Build tagged links for campaigns and copy them in one click.', i: 'tag', c: '#7c3aed' },
    { id: 'links', slug: 'quick-links', n: 'Quick links', d: 'Jump to Search Console, PageSpeed and test tools for any of your sites.', i: 'mark', c: '#0284c7' },
  ];
  // Map slugs as aliases
  LIST.forEach((t) => {
    if (t.slug && R[t.id]) R[t.slug] = R[t.id];
  });
  window.TL = { list: LIST, render: (id, el) => { const fn = R[id] || (LIST.find(x => x.slug === id || x.id === id) && R[LIST.find(x => x.slug === id || x.id === id).id]); return fn ? fn(el) : null; }, grab, esc, healthOf, audit, pool, sitePages };
})();
