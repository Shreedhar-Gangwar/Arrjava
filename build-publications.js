/* ============================================================
   ARRJAVA — Publication page generator
   Reads publications.js (the content database — never modified
   by this script) and writes one standalone HTML page per
   publication into the publications/ folder.

   Run it with:   node build-publications.js
   Run it again whenever publications.js changes. Pages in
   publications/ are OUTPUT — never edit them by hand; edits
   would be overwritten on the next build.
   ============================================================ */
const fs = require('fs');
const path = require('path');

/* ---- Site address ----
   Used for the sitemap, robots.txt and per-page canonical/share tags.
   ⚠ UPDATE THIS ONE LINE AT DEPLOYMENT when the real domain exists
   (e.g. 'https://arrjava.in'), then re-run: node build-publications.js */
const SITE_URL = 'https://shreedhar-gangwar.github.io/Arrjava';

/* ---- 1. Load the content database exactly as a browser would ---- */
const src = fs.readFileSync(path.join(__dirname, 'publications.js'), 'utf8');
const window = {};            // publications.js assigns onto `window`
eval(src);                    // safe: our own local file, same code the site runs
const pubs = window.ARRJAVA_PUBLICATIONS || [];
if (!pubs.length) {
  console.error('ERROR: no publications found in publications.js — refusing to build.');
  process.exit(1);
}

/* ---- 2. Helpers ---- */
// Escape text that goes inside HTML (titles, abstracts). Bodies are
// already trusted HTML written via the publishing flow, inserted as-is.
const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Plain, single-line version of the abstract for the meta description.
const metaText = s => esc(String(s).replace(/\s+/g, ' ').trim()).slice(0, 200);
// Turn a human date line like "June 2026" into machine form "2026-06"
// for search engines. Returns null if the format isn't recognised.
const MONTHS = ['january','february','march','april','may','june','july',
                'august','september','october','november','december'];
const isoDate = s => {
  const m = String(s).trim().toLowerCase().match(/^([a-z]+)\s+(\d{4})$/);
  if (!m) return null;
  const idx = MONTHS.indexOf(m[1]);
  return idx === -1 ? null : m[2] + '-' + String(idx + 1).padStart(2, '0');
};
// The structured-data block search engines read to understand a page
// is an article: headline, description, publisher, date.
const jsonLd = p => {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: p.title,
    description: String(p.abstract).replace(/\s+/g, ' ').trim(),
    url: SITE_URL + '/publications/' + p.id + '.html',
    author: { '@type': 'Organization', name: 'ARRJAVA — Advocates & Legal Consultants' },
    publisher: { '@type': 'Organization', name: 'ARRJAVA — Advocates & Legal Consultants' }
  };
  const d = isoDate(p.date);
  if (d) data.datePublished = d;
  return JSON.stringify(data, null, 2);
};

/* ---- 3. The page template (design matches index.html) ---- */
const page = p => `<!DOCTYPE html>
<!-- GENERATED FILE — do not edit. Built by build-publications.js from publications.js -->
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(p.title)} — ARRJAVA</title>
<meta name="description" content="${metaText(p.abstract)}">
<link rel="canonical" href="${SITE_URL}/publications/${p.id}.html">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${metaText(p.abstract)}">
<meta property="og:url" content="${SITE_URL}/publications/${p.id}.html">
<meta property="og:site_name" content="ARRJAVA — Advocates &amp; Legal Consultants">
<script type="application/ld+json">
${jsonLd(p)}
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
:root{
  --ink:#14181d;
  --ink-soft:#2a3038;
  --paper:#f7f4ee;
  --paper-deep:#efeae0;
  --gold:#b08d3e;
  --gold-soft:#c9ac6a;
  --line:rgba(20,24,29,.14);
  --serif:'Cormorant Garamond',Georgia,serif;
  --sans:'Inter',system-ui,sans-serif;
}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--paper);color:var(--ink);font-family:var(--sans);font-weight:300;line-height:1.7;-webkit-font-smoothing:antialiased}
::selection{background:var(--gold);color:#fff}
a{color:inherit;text-decoration:none}
h1,h2{font-family:var(--serif);font-weight:500;letter-spacing:.01em}

header{border-bottom:1px solid var(--line);padding:18px 6vw;display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:14px}
.brand .mark{width:38px;height:38px;display:block}
.brand-text{line-height:1.15}
.brand-text .name{font-family:var(--serif);font-size:1.15rem;letter-spacing:.32em;font-weight:600}
.brand-text .tag{font-size:.52rem;letter-spacing:.28em;text-transform:uppercase;color:var(--gold)}
.back{font-size:.66rem;letter-spacing:.22em;text-transform:uppercase;color:var(--ink-soft);border-bottom:1px solid transparent;transition:color .3s,border-color .3s}
.back:hover{color:var(--gold);border-color:var(--gold)}

main{max-width:760px;margin:0 auto;padding:70px 6vw 90px}
.cat{font-size:.62rem;letter-spacing:.26em;text-transform:uppercase;color:var(--gold)}
h1{font-size:clamp(1.8rem,4vw,2.6rem);line-height:1.2;margin:18px 0 10px}
.date{font-family:var(--serif);font-style:italic;color:var(--ink-soft);margin-bottom:38px;display:block}
article{-webkit-user-select:none;-moz-user-select:none;user-select:none}
article h4{font-family:var(--serif);font-size:1.25rem;margin:34px 0 10px;color:var(--ink)}
article p{font-size:.95rem;color:var(--ink-soft);margin-bottom:16px}
article .pub-disclaimer{font-size:.7rem;border-top:1px solid var(--line);padding-top:18px;margin-top:36px;font-style:italic}
.all-link{display:inline-block;margin-top:44px;font-size:.66rem;letter-spacing:.24em;text-transform:uppercase;color:var(--ink)}
.all-link::before{content:"⟵";color:var(--gold);margin-right:12px}

footer{background:var(--ink);color:rgba(247,244,238,.6);padding:44px 6vw;font-size:.7rem;line-height:1.8}
footer .fbrand{font-family:var(--serif);letter-spacing:.32em;color:var(--paper);font-size:1rem;margin-bottom:10px}
footer .disclaimer{max-width:70ch}
</style>
</head>
<body>

<header>
  <a class="brand" href="../index.html" aria-label="ARRJAVA home">
    <svg class="mark" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="1.5" y="1.5" width="61" height="61" fill="none" stroke="#b08d3e" stroke-width="1.5"/>
      <path d="M32 12 L46 50 H40.5 L32 25.5 L23.5 50 H18 Z" fill="#14181d"/>
      <line x1="24" y1="40" x2="40" y2="40" stroke="#b08d3e" stroke-width="1.8"/>
      <circle cx="32" cy="18" r="1.8" fill="#b08d3e"/>
    </svg>
    <span class="brand-text">
      <span class="name">ARRJAVA</span><br>
      <span class="tag">Advocates &amp; Legal Consultants</span>
    </span>
  </a>
  <a class="back" href="../index.html#publications">All publications</a>
</header>

<main>
  <span class="cat">${esc(p.category)}</span>
  <h1>${esc(p.title)}</h1>
  <span class="date">${esc(p.date)} · ARRJAVA, Agra</span>
  <article>
    ${p.body.trim()}
  </article>
  <a class="all-link" href="../index.html#publications">All publications</a>
</main>

<footer>
  <p class="fbrand">ARRJAVA</p>
  <p class="disclaimer">This website is for informational purposes only and does not constitute solicitation, advertisement, or legal advice. In conformity with the rules of the Bar Council of India, ARRJAVA does not solicit work. Content is provided solely at the visitor's specific request. Nothing herein creates an advocate–client relationship.</p>
</footer>

<script>
/* Same light read-only deterrent used by the site's on-page reader */
const doc=document.querySelector('article');
['contextmenu','copy','cut','dragstart','selectstart'].forEach(ev=>
  doc.addEventListener(ev,e=>e.preventDefault()));
</script>
</body>
</html>
`;

/* ---- 4. Write one page per publication ---- */
const outDir = path.join(__dirname, 'publications');
fs.mkdirSync(outDir, { recursive: true });
pubs.forEach(p => {
  const file = path.join(outDir, p.id + '.html');
  fs.writeFileSync(file, page(p));
  console.log('  wrote publications/' + p.id + '.html');
});

/* ---- 5. Sitemap: tells search engines every page that exists ---- */
const urls = [
  SITE_URL + '/',
  ...pubs.map(p => SITE_URL + '/publications/' + p.id + '.html')
];
const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map(u => '  <url><loc>' + esc(u) + '</loc></url>').join('\n') +
  '\n</urlset>\n';
fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), sitemap);
console.log('  wrote sitemap.xml (' + urls.length + ' pages)');

/* ---- 6. robots.txt: points crawlers at the sitemap.
   publish.html is not listed here on purpose — it already carries a
   noindex tag, and robots.txt entries are public and would advertise it. */
fs.writeFileSync(path.join(__dirname, 'robots.txt'),
  'User-agent: *\nAllow: /\nSitemap: ' + SITE_URL + '/sitemap.xml\n');
console.log('  wrote robots.txt');

console.log('Built ' + pubs.length + ' publication page(s).');
