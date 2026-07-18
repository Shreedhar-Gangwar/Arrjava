/* ============================================================
   ARRJAVA — Site builder
   Reads the publication content files in content/publications/
   (one .md file per publication — THE content database) and
   generates everything the site serves:

     publications.js        — data file the homepage reads
     publications/<id>.html — one standalone page per publication
     sitemap.xml            — list of all pages for search engines
     robots.txt             — points crawlers at the sitemap

   Run it with:   node build-publications.js
   (first time: npm install)

   Everything this script writes is OUTPUT — never edit those
   files by hand; the next build overwrites them. To change a
   publication, edit its file in content/publications/ (or use
   the Pages CMS admin UI) and re-run the build.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { marked } = require('marked');

/* ---- Site address ----
   Used for the sitemap, robots.txt and per-page canonical/share tags.
   ⚠ UPDATE THIS ONE LINE AT DEPLOYMENT when the real domain exists
   (e.g. 'https://arrjava.in'), then re-run: node build-publications.js */
const SITE_URL = 'https://shreedhar-gangwar.github.io/Arrjava';

/* The legal disclaimer appended to every publication. Owner's domain —
   do not edit this text (see CLAUDE.md section 6). */
const DISCLAIMER = '<p class="pub-disclaimer">This note is for general information only and is not legal advice. Facts of each matter differ; obtain specific advice before acting.</p>';

/* Category → accent colour. Keys MUST match the category values in
   .pages.yml exactly (that dropdown is what Ravi picks from). Muted,
   earthy tones chosen to sit with the ink/paper/gold palette. To add a
   new category: add it to .pages.yml AND here. Any category without an
   entry falls back to the neutral colour below and still works. */
const CATEGORY_COLORS = {
  'Practice Note · Civil Procedure':      '#6b231d',
  'Advisory Note · Commercial':           '#C73828',
  'Client Guide · Succession':            '#ABEB9D',
  'Client Guide · Family Law':            '#283e2a',
  'Practice Note · Criminal Law':         '#9C7F52',
  'Commentary · Legal Developments':      '#c596c5'
};
const CATEGORY_FALLBACK = '#8a8375';                  // warm grey

/* Short labels shown in the homepage legend (the cards themselves still
   show the full category). Keys must match CATEGORY_COLORS. */
const CATEGORY_LABELS = {
  'Practice Note · Civil Procedure':      'Civil Procedure',
  'Advisory Note · Commercial':           'Commercial Law',
  'Client Guide · Succession':            'Succession Law',
  'Client Guide · Family Law':            'Family Law',
  'Practice Note · Criminal Law':         'Criminal Law',
  'Commentary · Legal Developments':      'Legal Developments'
};

/* ---- 1. Read the content files ---- */
const contentDir = path.join(__dirname, 'content', 'publications');
const files = fs.readdirSync(contentDir).filter(f => f.endsWith('.md'));
if (!files.length) {
  console.error('ERROR: no content files found in content/publications/ — refusing to build.');
  process.exit(1);
}

const MONTHS = ['January','February','March','April','May','June','July',
                'August','September','October','November','December'];

const pubs = files.map(f => {
  const raw = fs.readFileSync(path.join(contentDir, f), 'utf8');
  // Split "--- frontmatter --- body"
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) { console.error('ERROR: ' + f + ' has no valid front matter.'); process.exit(1); }
  const meta = yaml.load(m[1]);
  for (const need of ['title', 'category', 'date', 'abstract']) {
    if (!meta[need]) { console.error('ERROR: ' + f + ' is missing "' + need + '".'); process.exit(1); }
  }
  // js-yaml gives a Date for unquoted YYYY-MM-DD; accept a string too.
  const d = meta.date instanceof Date ? meta.date : new Date(String(meta.date));
  if (isNaN(d)) { console.error('ERROR: ' + f + ' has an unreadable date.'); process.exit(1); }
  const category = String(meta.category);
  return {
    id: f.replace(/\.md$/, ''),
    category: category,
    color: CATEGORY_COLORS[category] || CATEGORY_FALLBACK,
    date: MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear(),  // shown as e.g. "June 2026"
    sortDate: d,
    title: String(meta.title),
    abstract: String(meta.abstract),
    // marked encodes apostrophes as &#39;; keep them literal so the
    // stored text stays clean and matches the original writing.
    body: marked.parse(m[2].trim()).trim().replace(/&#39;/g, "'") + '\n' + DISCLAIMER
  };
});

// Newest first, matching how the homepage has always listed them.
pubs.sort((a, b) => b.sortDate - a.sortDate);

/* ---- 2. Helpers ---- */
// Escape text that goes inside HTML (titles, abstracts). Bodies are
// the owner's own trusted writing, inserted as-is.
const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Plain, single-line version of the abstract for the meta description.
const metaText = s => esc(String(s).replace(/\s+/g, ' ').trim()).slice(0, 200);
// URL-safe anchor slug for a category name (for in-page jump links).
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// Category display helpers (fall back gracefully for unmapped categories).
const catLabel = c => CATEGORY_LABELS[c] || c;
const catColor = c => CATEGORY_COLORS[c] || CATEGORY_FALLBACK;
// Lowercased plain-text blob for a publication, used by the library
// page's keyword search: title + category + abstract + body (tags
// stripped). esc() keeps it safe inside an HTML attribute.
const searchText = p => esc(
  (p.title + ' ' + p.category + ' ' + p.abstract + ' ' +
   String(p.body).replace(/<[^>]+>/g, ' '))
  .replace(/\s+/g, ' ').trim().toLowerCase());
// The structured-data block search engines read to understand a page
// is an article: headline, description, publisher, date.
const jsonLd = p => JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: p.title,
  description: String(p.abstract).replace(/\s+/g, ' ').trim(),
  url: SITE_URL + '/publications/' + p.id + '.html',
  datePublished: p.sortDate.toISOString().slice(0, 10),
  author: { '@type': 'Organization', name: 'ARRJAVA — Advocates & Legal Consultants' },
  publisher: { '@type': 'Organization', name: 'ARRJAVA — Advocates & Legal Consultants' }
}, null, 2);

/* ---- 3. The page template (design matches index.html) ---- */
const page = p => `<!DOCTYPE html>
<!-- GENERATED FILE — do not edit. Built by build-publications.js from content/publications/${p.id}.md -->
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
.cat-band{width:70px;height:8px;border-radius:4px;margin-bottom:26px;background:linear-gradient(180deg,color-mix(in srgb,${p.color} 72%,#fff),${p.color});box-shadow:0 2px 9px -3px ${p.color}}
.cat{font-size:.62rem;letter-spacing:.26em;text-transform:uppercase;color:var(--gold)}
h1{font-size:clamp(1.8rem,4vw,2.6rem);line-height:1.2;margin:18px 0 10px}
.date{font-family:var(--serif);font-style:italic;color:var(--ink-soft);margin-bottom:38px;display:block}
article{-webkit-user-select:none;-moz-user-select:none;user-select:none}
article h1,article h2,article h3,article h4,article h5,article h6{font-family:var(--serif);font-size:1.25rem;font-weight:500;margin:34px 0 10px;color:var(--ink)}
article p{font-size:.95rem;color:var(--ink-soft);margin-bottom:16px}
article strong{font-weight:500;color:var(--ink)}
article a{border-bottom:1px solid var(--gold)}
article ul,article ol{margin:0 0 16px 22px;font-size:.95rem;color:var(--ink-soft)}
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
  <div class="cat-band" aria-hidden="true"></div>
  <span class="cat">${esc(p.category)}</span>
  <h1>${esc(p.title)}</h1>
  <span class="date">${esc(p.date)} · ARRJAVA, Agra</span>
  <article>
    ${p.body}
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

/* ---- 3b. The full library page (publications/index.html) ----
   Every publication, grouped into category sections, with a jump-nav at
   the top for easy traversal. Categories appear in canonical order
   (CATEGORY_COLORS), any unmapped ones after. Newest-first within each. */
const archivePage = (groups) => `<!DOCTYPE html>
<!-- GENERATED FILE — do not edit. Built by build-publications.js -->
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Publications — ARRJAVA</title>
<meta name="description" content="The full library of practice notes, advisory notes and client guides authored by ARRJAVA, Advocates &amp; Legal Consultants, Agra — grouped by area of law.">
<link rel="canonical" href="${SITE_URL}/publications/">
<meta property="og:type" content="website">
<meta property="og:title" content="Publications — ARRJAVA">
<meta property="og:url" content="${SITE_URL}/publications/">
<meta property="og:site_name" content="ARRJAVA — Advocates &amp; Legal Consultants">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
:root{
  --ink:#14181d;--ink-soft:#2a3038;--paper:#f7f4ee;--paper-deep:#efeae0;
  --gold:#b08d3e;--gold-soft:#c9ac6a;--line:rgba(20,24,29,.14);
  --serif:'Cormorant Garamond',Georgia,serif;--sans:'Inter',system-ui,sans-serif;
}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{background:var(--paper);color:var(--ink);font-family:var(--sans);font-weight:300;line-height:1.7;-webkit-font-smoothing:antialiased}
::selection{background:var(--gold);color:#fff}
a{color:inherit;text-decoration:none}
h1,h2,h3{font-family:var(--serif);font-weight:500;letter-spacing:.01em}

header{border-bottom:1px solid var(--line);padding:18px 6vw;display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:14px}
.brand .mark{width:38px;height:38px;display:block}
.brand-text .name{font-family:var(--serif);font-size:1.15rem;letter-spacing:.32em;font-weight:600}
.brand-text .tag{font-size:.52rem;letter-spacing:.28em;text-transform:uppercase;color:var(--gold)}
.back{font-size:.66rem;letter-spacing:.22em;text-transform:uppercase;color:var(--ink-soft);border-bottom:1px solid transparent;transition:color .3s,border-color .3s}
.back:hover{color:var(--gold);border-color:var(--gold)}

main{max-width:1180px;margin:0 auto;padding:64px 6vw 90px}
.kicker{font-size:.66rem;letter-spacing:.34em;text-transform:uppercase;color:var(--gold);margin-bottom:18px}
h1{font-size:clamp(2rem,4.4vw,3rem);line-height:1.12}
.intro{margin-top:18px;max-width:60ch;color:var(--ink-soft)}

.pubsearch{margin-top:36px}
.pubsearch input{width:100%;max-width:440px;background:transparent;border:1px solid var(--line);padding:13px 16px;font-family:var(--sans);font-size:.95rem;color:var(--ink);outline:none;transition:border-color .3s}
.pubsearch input:focus{border-color:var(--gold)}
.noresults{margin-top:48px;color:var(--ink-soft);font-size:.95rem}
.filters{display:flex;flex-wrap:wrap;gap:10px 12px;margin:26px 0 8px;padding-bottom:34px;border-bottom:1px solid var(--line)}
.filt{display:flex;align-items:center;gap:9px;font-family:inherit;font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-soft);background:transparent;border:1px solid var(--line);padding:9px 15px;cursor:pointer;transition:border-color .3s,color .3s,background .3s}
.filt:hover{color:var(--ink);border-color:var(--gold)}
.filt.on{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.filt .dot{width:11px;height:11px;border-radius:3px;flex:none}

.catsec{margin-top:64px;scroll-margin-top:24px}
.catsec h2{display:flex;align-items:center;gap:14px;font-size:1.5rem}
.catsec h2 .bar{width:34px;height:8px;border-radius:4px;flex:none}
.count{font-size:.66rem;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-soft);margin-left:4px}
.agrid{margin-top:28px;display:grid;grid-template-columns:repeat(3,1fr);gap:26px}
@media(max-width:960px){.agrid{grid-template-columns:1fr 1fr}}
@media(max-width:640px){.agrid{grid-template-columns:1fr}}
.acard{background:var(--paper);border:1px solid var(--line);padding:34px 30px;display:flex;flex-direction:column;position:relative;transition:box-shadow .4s}
.acard::before{content:"";position:absolute;top:-1px;left:-1px;right:-1px;height:8px;background:linear-gradient(180deg,color-mix(in srgb,var(--cat) 72%,#fff),var(--cat))}
.acard:hover{box-shadow:0 20px 46px -24px rgba(20,24,29,.35)}
.acard .date{font-family:var(--serif);font-style:italic;font-size:.82rem;color:var(--ink-soft)}
.acard h3{font-size:1.2rem;line-height:1.3;margin:8px 0 12px}
.acard p{font-size:.84rem;color:var(--ink-soft);flex:1}
.acard .more{margin-top:22px;font-size:.64rem;letter-spacing:.22em;text-transform:uppercase;display:flex;align-items:center;gap:10px}
.acard .more::after{content:"⟶";color:var(--gold)}

footer{background:var(--ink);color:rgba(247,244,238,.6);padding:44px 6vw;font-size:.7rem;line-height:1.8;margin-top:80px}
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
  <a class="back" href="../index.html#publications">← Home</a>
</header>

<main>
  <p class="kicker">Publications</p>
  <h1>The library, by area of law.</h1>
  <p class="intro">Every practice note, advisory note and client guide authored by the chambers, grouped by area of law. Publications are provided in a read-only format for on-screen reading.</p>

  <div class="pubsearch">
    <input id="pubSearch" type="search" placeholder="Search publications by keyword…" aria-label="Search publications by keyword" autocomplete="off">
  </div>

  <nav class="filters" aria-label="Filter by category">
    <button class="filt on" type="button" data-cat="all" aria-pressed="true">All</button>
    ${groups.map(g => `<button class="filt" type="button" data-cat="${slug(g.category)}" aria-pressed="false"><span class="dot" style="background:${g.color}"></span>${esc(catLabel(g.category))}</button>`).join('\n    ')}
  </nav>

  ${groups.map(g => `<section class="catsec" id="${slug(g.category)}">
    <h2><span class="bar" style="background:${g.color}"></span>${esc(catLabel(g.category))}<span class="count">${g.items.length} ${g.items.length === 1 ? 'piece' : 'pieces'}</span></h2>
    <div class="agrid">
      ${g.items.map(p => `<a class="acard" style="--cat:${p.color}" data-search="${searchText(p)}" href="${p.id}.html">
        <span class="date">${esc(p.date)}</span>
        <h3>${esc(p.title)}</h3>
        <p>${esc(p.abstract)}</p>
        <span class="more">Read</span>
      </a>`).join('\n      ')}
    </div>
  </section>`).join('\n\n  ')}

  <p class="noresults" id="noResults" style="display:none">No publications match your search.</p>
</main>

<footer>
  <p class="fbrand">ARRJAVA</p>
  <p class="disclaimer">This website is for informational purposes only and does not constitute solicitation, advertisement, or legal advice. In conformity with the rules of the Bar Council of India, ARRJAVA does not solicit work. Content is provided solely at the visitor's specific request. Nothing herein creates an advocate–client relationship.</p>
</footer>

<script>
/* Category filter tabs + keyword search. A card shows when it matches
   the active category (or All) AND the search box. Section headings and
   per-category counts follow what's visible. Without JS every section
   shows (graceful). */
(function(){
  var input=document.getElementById('pubSearch');
  var filts=[].slice.call(document.querySelectorAll('.filt'));
  var secs=[].slice.call(document.querySelectorAll('.catsec'));
  var noRes=document.getElementById('noResults');
  var activeCat='all';
  function apply(){
    var q=(input.value||'').trim().toLowerCase();
    var total=0;
    secs.forEach(function(sec){
      var shown=0;
      [].slice.call(sec.querySelectorAll('.acard')).forEach(function(card){
        var catOk=activeCat==='all'||sec.id===activeCat;
        var qOk=!q||card.getAttribute('data-search').indexOf(q)!==-1;
        var show=catOk&&qOk;
        card.style.display=show?'':'none';
        if(show){shown++;total++;}
      });
      sec.style.display=shown?'':'none';
      var c=sec.querySelector('.count');
      if(c)c.textContent=shown+(shown===1?' piece':' pieces');
    });
    noRes.style.display=total?'none':'';
  }
  filts.forEach(function(b){
    b.addEventListener('click',function(){
      filts.forEach(function(x){var on=x===b;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on?'true':'false');});
      activeCat=b.getAttribute('data-cat');
      apply();
    });
  });
  input.addEventListener('input',apply);
})();
</script>
</body>
</html>
`;

/* ---- 4. Write publications.js (the data file the homepage reads) ---- */
const dataOut = pubs.map(({ id, category, color, date, title, abstract, body }) =>
  ({ id, category, color, date, title, abstract, body }));
fs.writeFileSync(path.join(__dirname, 'publications.js'),
  '/* GENERATED FILE — do not edit. Built by build-publications.js from content/publications/ */\n' +
  'window.ARRJAVA_PUBLICATIONS = ' + JSON.stringify(dataOut, null, 2) + ';\n' +
  // Category → colour and → short-label maps, in canonical order, for
  // the homepage legend.
  'window.ARRJAVA_CATEGORY_COLORS = ' + JSON.stringify(CATEGORY_COLORS, null, 2) + ';\n' +
  'window.ARRJAVA_CATEGORY_LABELS = ' + JSON.stringify(CATEGORY_LABELS, null, 2) + ';\n');
console.log('  wrote publications.js (' + pubs.length + ' publications)');

/* ---- 5. Write one page per publication; remove pages whose
        content file no longer exists (deleted publications) ---- */
const outDir = path.join(__dirname, 'publications');
fs.mkdirSync(outDir, { recursive: true });
const wanted = new Set(pubs.map(p => p.id + '.html'));
// Never delete index.html (the generated library page, not a publication).
fs.readdirSync(outDir).filter(f => f.endsWith('.html') && f !== 'index.html' && !wanted.has(f)).forEach(f => {
  fs.unlinkSync(path.join(outDir, f));
  console.log('  removed stale publications/' + f);
});
pubs.forEach(p => {
  fs.writeFileSync(path.join(outDir, p.id + '.html'), page(p));
  console.log('  wrote publications/' + p.id + '.html');
});

// Group for the library page: canonical categories first, any unmapped
// ones after; items stay newest-first (pubs is already sorted).
const groups = [
  ...Object.keys(CATEGORY_COLORS),
  ...[...new Set(pubs.map(p => p.category))].filter(c => !(c in CATEGORY_COLORS))
]
  .map(category => ({ category, color: catColor(category), items: pubs.filter(p => p.category === category) }))
  .filter(g => g.items.length);
fs.writeFileSync(path.join(outDir, 'index.html'), archivePage(groups));
console.log('  wrote publications/index.html (library, ' + groups.length + ' categories)');

/* ---- 6. Sitemap: tells search engines every page that exists ---- */
const urls = [
  SITE_URL + '/',
  SITE_URL + '/publications/',
  ...pubs.map(p => SITE_URL + '/publications/' + p.id + '.html')
];
fs.writeFileSync(path.join(__dirname, 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map(u => '  <url><loc>' + esc(u) + '</loc></url>').join('\n') +
  '\n</urlset>\n');
console.log('  wrote sitemap.xml (' + urls.length + ' pages)');

/* ---- 7. robots.txt: points crawlers at the sitemap. ---- */
fs.writeFileSync(path.join(__dirname, 'robots.txt'),
  'User-agent: *\nAllow: /\nSitemap: ' + SITE_URL + '/sitemap.xml\n');
console.log('  wrote robots.txt');

console.log('Built ' + pubs.length + ' publication(s).');
