#!/usr/bin/env node
/**
 * Overnight PSI batch runner for GitHub Actions.
 * Reuses the exact same extraction logic as the browser tool (engine.js),
 * so scores and roadmaps can never drift between the two.
 *
 * Saves:
 *   results/psi_results.csv   — scores, roadmap top fix, recoverable seconds, wedge, email opener
 *   results/lhr/<slug>.json   — the raw Lighthouse result, so Teardown Studio can build decks offline
 */

const fs = require('fs');
const path = require('path');
const { buildEngine } = require('./engine.js');

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, [])
);

const CSV = args.csv;
const START = Math.max(0, parseInt(args.start || '1', 10) - 1);
const COUNT = parseInt(args.count || '150', 10);
const OUT = args.out || 'results/psi_results.csv';
const JSON_DIR = args['json-dir'] || 'results/lhr';
const KEY = process.env.PSI_API_KEY;

if (!KEY) { console.error('Missing PSI_API_KEY secret.'); process.exit(1); }
if (!CSV || !fs.existsSync(CSV)) { console.error('CSV not found: ' + CSV); process.exit(1); }

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.mkdirSync(JSON_DIR, { recursive: true });

/* ---------- tiny CSV parser (quoted fields, embedded commas) ---------- */
function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const head = rows.shift().map(h => h.trim());
  return rows.filter(r => r.length > 1).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
}
const csvEscape = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const slugBase = s => (s || 'lead').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'lead';
/* Two brands can slug identically ("The Black Tux" / "The Black-Tux"), which would
   silently overwrite one another's JSON. Keep a registry and suffix duplicates. */
const _slugSeen = new Set();
function uniqueSlug(name) {
  const base = slugBase(name);
  if (!_slugSeen.has(base)) { _slugSeen.add(base); return base; }
  for (let i = 2; ; i++) {
    const cand = `${base}_${i}`;
    if (!_slugSeen.has(cand)) { _slugSeen.add(cand); return cand; }
  }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- PSI ---------- */
const psiUrl = u => 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=' +
  encodeURIComponent(u) + '&strategy=mobile&category=performance&category=accessibility' +
  '&category=best-practices&category=seo&key=' + KEY;

async function runPSI(url) {
  /* The slowest stores are the best prospects — and the most likely to time out.
     180s + 4 attempts keeps them in the pipeline instead of silently dropping them. */
  /* Cut from 4 attempts to 2. A lead that can't produce an LHR in two 180s tries
     with an 8s cooldown is either genuinely broken or under a stampede — burning
     another 32s of runtime on it costs more than it's worth. */
  const ATTEMPTS = 2, TIMEOUT_MS = 180000;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const res = await fetch(psiUrl(url), { signal: AbortSignal.timeout(TIMEOUT_MS) });
      const j = await res.json();
      if (j.error) throw new Error(j.error.message);
      if (!j.lighthouseResult) throw new Error('no lighthouseResult');
      return j.lighthouseResult;
    } catch (e) {
      console.log(`    attempt ${attempt}/${ATTEMPTS} failed: ${e.message}`);
      if (attempt < ATTEMPTS) await sleep(5000 * attempt);
    }
  }
  return null;
}

function opener(r) {
  const m = r.m;
  if (m.phases && m.phases['Load Delay'] > 800)
    return `Ran ${r.domain} through Google's speed test — your hero image doesn't even start downloading for ${(m.phases['Load Delay'] / 1000).toFixed(1)}s, which is why your LCP is ${m.lcp}.`;
  if (m.lcpImage && m.lcpImageKb)
    return `Ran ${r.domain} through Google's speed test — ${m.lcpImage.split('/').pop().split('?')[0]} ships at ${(m.lcpImageKb / 1024).toFixed(1)}MB, and it's why the page takes ${m.lcp} to paint on a phone.`;
  if (m.lcp)
    return `Ran ${r.domain} through Google's speed test — ${m.lcp} to paint on mobile, and roughly ${(r.totalSaveMs / 1000).toFixed(1)}s of that is recoverable.`;
  return `Ran ${r.domain} through Google's PageSpeed test — worth 60 seconds of your time.`;
}

const COLS = ['Company', 'Website', 'Mobile Score', 'Accessibility', 'Best Practices', 'SEO',
  'LCP', 'CLS', 'TBT', 'Speed Index', 'TTFB ms', 'Page Weight', 'Recoverable (s)', 'Top Fix',
  'Largest Image', 'Largest Image KB', 'Render-Blocking', 'Third Parties', 'Heavy Apps',
  'Wedge', 'Email Opener', 'LHR File'];

/* When `timeout 320m` fires in the workflow, we get SIGTERM. Flush whatever's
   in memory to disk before the process ends so no leads are lost between the last
   write() call and the interrupt. */
let flushOnExit = null;
process.on('SIGTERM', () => {
  console.log('Received SIGTERM — flushing partial results.');
  if (flushOnExit) flushOnExit();
  process.exit(0);
});

(async () => {
  const leads = parseCSV(fs.readFileSync(CSV, 'utf8')).filter(l => (l.Website || '').trim());
  const batch = leads.slice(START, START + COUNT);
  console.log(`Loaded ${leads.length} leads. Testing rows ${START + 1}–${START + batch.length}.`);

  // resume: keep rows already in the output file
  let existing = [];
  if (fs.existsSync(OUT)) {
    existing = parseCSV(fs.readFileSync(OUT, 'utf8'));
    console.log(`Found ${existing.length} existing rows — appending.`);
  }
  const done = new Set(existing.map(r => r.Website));
  // reserve slugs already used by previous runs so we never clobber their JSON
  for (const r of existing) {
    const f = (r['LHR File'] || '').split('/').pop().replace(/\.json$/, '');
    if (f) _slugSeen.add(f);
  }
  const out = [...existing];

  const write = () => {
    const lines = [COLS.join(',')];
    for (const r of out) lines.push(COLS.map(c => csvEscape(r[c])).join(','));
    fs.writeFileSync(OUT, lines.join('\n') + '\n');
  };
  flushOnExit = write;

  for (let i = 0; i < batch.length; i++) {
    const lead = batch[i];
    let url = lead.Website.trim();
    if (!/^https?:/.test(url)) url = 'https://' + url;
    if (done.has(url)) { console.log(`[${i + 1}/${batch.length}] ${lead.Company} — already done, skipping`); continue; }

    console.log(`[${i + 1}/${batch.length}] ${lead.Company} — ${url}`);
    const lhr = await runPSI(url);

    if (!lhr) {
      out.push({ Company: lead.Company, Website: url, Wedge: 'PSI failed' });
      write(); await sleep(1500); continue;
    }

    const r = buildEngine(lhr, lead.Technologies || '');
    r.domain = url.replace(/https?:\/\/(www\.)?/, '').replace(/\/.*/, '');
    const file = uniqueSlug(lead.Company) + '.json';
    fs.writeFileSync(path.join(JSON_DIR, file), JSON.stringify(lhr));

    out.push({
      'Company': lead.Company, 'Website': url,
      'Mobile Score': r.m.score ?? '', 'Accessibility': r.m.acc ?? '',
      'Best Practices': r.m.bp ?? '', 'SEO': r.m.seo ?? '',
      'LCP': r.m.lcp || '', 'CLS': r.m.cls || '', 'TBT': r.m.tbt || '', 'Speed Index': r.m.si || '',
      'TTFB ms': r.m.serverMs || '', 'Page Weight': r.m.totalWeight || '',
      'Recoverable (s)': r.totalSaveMs ? (r.totalSaveMs / 1000).toFixed(1) : '',
      'Top Fix': r.roadmap[0]?.title || '',
      'Largest Image': r.m.lcpImage || '', 'Largest Image KB': r.m.lcpImageKb || '',
      'Render-Blocking': r.m.rbCount ?? '',
      'Third Parties': (r.m.thirdParties || []).map(x => x.name).join(' | '),
      'Heavy Apps': (r.apps || []).join(' | '),
      'Wedge': (r.m.score ?? 100) < 60 ? 'CWVO Sprint' : 'CRO/SEO angle',
      'Email Opener': opener(r), 'LHR File': 'lhr/' + file,
    });

    console.log(`    score ${r.m.score} · LCP ${r.m.lcp} · ${(r.totalSaveMs / 1000).toFixed(1)}s recoverable`);
    write();                 // save after every lead — a crash never loses work
    await sleep(1500);       // stay well under 240 req/min
  }

  const slow = out.filter(r => r['Wedge'] === 'CWVO Sprint').length;
  console.log(`\nDone. ${out.length} rows total. CWVO-wedge: ${slow}. Results in ${OUT}`);
})();
