# ARRJAVA — Roadmap / future plans

Ideas agreed for later, not yet built. This file is for reference only; nothing
here is live. (For the near-term deployment checklist, see CLAUDE.md → section 2
"Deployment checklist".)

---

## Publications: popularity + editorial ordering

**Goal:** show the most valuable publications first — combining real readership
data with Ravi's editorial judgement, rather than either raw clicks or plain
newest-first.

**Decided approach (2026-07-17): merge "analytics" + "editorial control".**
Analytics tells us what people actually read; Ravi decides what leads. The site
does NOT auto-rank by clicks (that risks clickbait pieces burying newer work, and
click counts can be inflated by bots/refreshes).

### Part A — Analytics (measure what's read)
- Add a privacy-friendly, cookieless analytics tool so we can see per-article
  read counts. No cookie-consent banner needed — suits a law firm's privacy ethos
  and India's DPDP Act.
- **Preferred: Umami (free cloud tier)** — free up to ~100k views/month, shows a
  clear per-article breakdown (exactly what we need). **Simpler fallback:
  Cloudflare Web Analytics (free).** Avoid Google Analytics (cookies + consent
  banner + sends visitor data to Google — poor fit here).
- Wire the tracking snippet into `build-publications.js` so every page, including
  each publication page, is counted automatically — no work for Ravi.
- Cost: $0 on the free tiers (confirm current terms at signup, they can change).
- **Timing:** only worth doing once the site is on its real domain with real
  visitors — on the GitHub preview it would only count us testing.

### Part B — Editorial control (Ravi decides what leads)
- Give Ravi a way in the CMS to "feature" / pin chosen publications to the front,
  informed by the analytics from Part A.
- Likely shape: a "featured" flag (and/or a manual order number) added to the
  publication fields in `.pages.yml` + front matter; the build sorts featured
  pieces first, then falls back to the current newest-first order for the rest.
- Ravi's workflow stays UI-only: he ticks "feature this" in the same form he
  already uses. No code.

### Open questions to settle when we build Part B
- Simple pin-to-front (one or a few featured slots) vs full manual ordering?
- How many featured slots before it falls back to newest-first?
- Should a featured piece also get a small "Featured" label on its card?

### Suggested sequence
1. At deployment: add Part A (analytics), watch the data for a while.
2. When desired: add Part B (editorial featuring), using what Part A revealed.
