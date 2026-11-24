/* Build step for GitHub Pages (run by .github/workflows/deploy.yml, or `node scripts/build-pages.js` locally).
   Webly is one page app, but every public URL gets its own HTML file so Google sees the right title,
   description, canonical and structured data for each page:
     site/tools/index.html, site/tools/<tool>/index.html, site/sites/index.html  (indexable)
     site/dashboard/index.html                                                     (noindex)
   It also rewrites site/sitemap.xml from the same page list (site/pages.js). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const SITE = path.join(__dirname, '..', 'site'), HOST = 'https://webly.codelove.in';
const ctx = {}; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(SITE, 'pages.js'), 'utf8'), ctx);
const { ROUTES, byId } = ctx.PAGES;
const base = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
const escA = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const today = new Date().toISOString().slice(0, 10);

function page(r, { noindex } = {}) {
  const url = HOST + r.path, t = escA(r.title), d = escA(r.desc);
  let h = base
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${t}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${d}">`)
    .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`)
    .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${t}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${d}">`)
    .replace(/<meta name="twitter:url" content="[^"]*">/, `<meta name="twitter:url" content="${url}">`)
    .replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${t}">`)
    .replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${d}">`);
  if (noindex) h = h.replace(/<meta name="robots" content="[^"]*">/, '<meta name="robots" content="noindex, nofollow">');
  // Sub pages get their own structured data (the home page's FAQ only belongs on the home page).
  if (r.path !== '/') {
    const crumbs = [{ n: 'Webly', u: HOST + '/' }];
    if (r.tool) crumbs.push({ n: 'Free SEO tools', u: HOST + '/tools/' });
    crumbs.push({ n: r.tool ? byId(r.tool).name : r.title.split(':')[0].split('|')[0].trim(), u: url });
    const graph = [
      { '@type': 'WebPage', '@id': url + '#page', url, name: r.title, description: r.desc, isPartOf: { '@id': HOST + '/#website' }, inLanguage: 'en' },
      { '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.n, item: c.u })) },
    ];
    if (r.tool) { const t2 = byId(r.tool); graph.push({ '@type': 'WebApplication', name: `${t2.name} by Webly`, url, description: r.desc, applicationCategory: 'BusinessApplication', operatingSystem: 'Any (web browser)', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, featureList: t2.points, publisher: { '@id': 'https://codelove.in/#organization' } }); }
    if (r.path === '/tools/') graph.push({ '@type': 'ItemList', itemListElement: ROUTES.filter((x) => x.tool).map((x, i) => ({ '@type': 'ListItem', position: i + 1, url: HOST + x.path, name: byId(x.tool).name })) });
    h = h.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, `<script type="application/ld+json">\n${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 1)}\n</script>`);
  }
  return h;
}
const write = (rel, html) => { const f = path.join(SITE, rel, 'index.html'); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); };

let n = 0;
for (const r of ROUTES) { if (r.path === '/') continue; write(r.path, page(r)); n++; }
write('/dashboard/', page({ path: '/dashboard', title: 'Dashboard · Webly', desc: ROUTES[0].desc }, { noindex: true })); n++;

const urls = [...ROUTES.map((r) => ({ loc: HOST + r.path, p: r.priority, f: r.path === '/' || r.path === '/sites/' ? 'daily' : 'weekly' })), { loc: HOST + '/privacy.html', p: '0.4', f: 'monthly' }, { loc: HOST + '/terms.html', p: '0.4', f: 'monthly' }];
fs.writeFileSync(path.join(SITE, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u.f}</changefreq>\n    <priority>${u.p}</priority>\n  </url>`).join('\n')}\n</urlset>\n`);
console.log(`build-pages: ${n} pages written, sitemap has ${urls.length} URLs`);
