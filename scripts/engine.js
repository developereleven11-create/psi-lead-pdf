/* Shared engine: parse a modern LHR, produce findings + prioritized roadmap.
   Written as a plain function so it can be unit-tested in node and pasted into the browser tool. */

function buildEngine(lhr, technologies) {
  const a = lhr.audits || {}, c = lhr.categories || {};
  const cs = n => c[n]?.score != null ? Math.round(c[n].score * 100) : null;
  const dv = id => a[id]?.displayValue || null;
  const num = v => (typeof v === 'number' && isFinite(v)) ? v : 0;

  // --- metric savings (modern) with overallSavingsMs fallback (deprecated) ---
  const savedMs = id => {
    const au = a[id]; if (!au) return 0;
    const ms = au.metricSavings || {};
    const best = Math.max(num(ms.LCP), num(ms.FCP));
    if (best) return Math.round(best);
    return Math.round(num(au.details?.overallSavingsMs));
  };
  const savedKb = id => Math.round(num(a[id]?.details?.overallSavingsBytes) / 1024);

  // --- LCP image: try 4 sources, deepest-first ---
  function findLcpImage() {
    // 1. prioritize-lcp-image debugData initiatorPath
    const ip = a['prioritize-lcp-image']?.details?.debugData?.initiatorPath;
    if (Array.isArray(ip) && ip[0]?.url) return ip[0].url;
    // 2. recursive snippet walk in lcp-element (handles nested list>table>items)
    const walk = items => {
      for (const it of items || []) {
        const sn = it?.node?.snippet || '';
        const m = sn.match(/(?:src|srcset)="([^"\s]+)/);
        if (m) return m[1];
        if (it?.items) { const r = walk(it.items); if (r) return r; }
      }
      return null;
    };
    const w = walk(a['largest-contentful-paint-element']?.details?.items);
    if (w) return w;
    // 3. biggest optimizable image
    for (const id of ['uses-optimized-images', 'modern-image-formats', 'uses-responsive-images']) {
      const items = a[id]?.details?.items || [];
      if (items.length) {
        const big = items.reduce((p, x) => num(x.totalBytes) > num(p.totalBytes) ? x : p, items[0]);
        if (big.url) return big.url;
      }
    }
    return null;
  }

  function imageBytes(url) {
    for (const id of ['uses-optimized-images', 'modern-image-formats', 'uses-responsive-images']) {
      for (const it of a[id]?.details?.items || []) {
        if (it.url === url && it.totalBytes) return Math.round(it.totalBytes / 1024);
      }
    }
    return null;
  }

  // --- LCP phase breakdown (the single most persuasive diagnostic) ---
  function lcpPhases() {
    const items = a['largest-contentful-paint-element']?.details?.items || [];
    for (const t of items) {
      if (t.items && t.items.some(x => x.phase)) {
        const out = {};
        t.items.forEach(x => out[x.phase] = Math.round(num(x.timing)));
        return out;
      }
    }
    return null;
  }

  // --- third parties, real entity names + blocking time ---
  function thirdParties() {
    const items = a['third-party-summary']?.details?.items || [];
    return items
      .map(i => ({ name: i.entity?.text || i.entity || '—', kb: Math.round(num(i.transferSize) / 1024), blockMs: Math.round(num(i.blockingTime)) }))
      .filter(x => x.name !== '—')
      .sort((x, y) => (y.blockMs - x.blockMs) || (y.kb - x.kb))
      .slice(0, 6);
  }

  const renderBlocking = (a['render-blocking-resources']?.details?.items || [])
    .map(i => ({ url: i.url, kb: Math.round(num(i.totalBytes) / 1024), ms: Math.round(num(i.wastedMs)) }))
    .sort((x, y) => y.ms - x.ms);

  const m = {
    score: cs('performance'), acc: cs('accessibility'), bp: cs('best-practices'), seo: cs('seo'),
    fcp: dv('first-contentful-paint'), lcp: dv('largest-contentful-paint'),
    tbt: dv('total-blocking-time'), cls: dv('cumulative-layout-shift'), si: dv('speed-index'),
    lcpMs: Math.round(num(a['largest-contentful-paint']?.numericValue)),
    fcpMs: Math.round(num(a['first-contentful-paint']?.numericValue)),
    tbtMs: Math.round(num(a['total-blocking-time']?.numericValue)),
    totalWeight: dv('total-byte-weight'),
    mainThread: dv('mainthread-work-breakdown'),
    serverMs: Math.round(num(a['server-response-time']?.details?.items?.[0]?.responseTime)),
    filmstrip: (a['screenshot-thumbnails']?.details?.items || []).map(i => ({ t: i.timing, data: i.data })),
    finalShot: a['final-screenshot']?.details?.data || null,
  };
  m.lcpImage = findLcpImage();
  m.lcpImageKb = m.lcpImage ? imageBytes(m.lcpImage) : null;
  m.phases = lcpPhases();
  m.thirdParties = thirdParties();
  m.renderBlocking = renderBlocking;
  m.rbCount = renderBlocking.length;
  m.rbMs = renderBlocking.reduce((s, x) => s + x.ms, 0);
  m.unusedJsKb = savedKb('unused-javascript');
  m.legacyJsKb = savedKb('legacy-javascript');
  m.imgSavKb = savedKb('uses-optimized-images') || savedKb('modern-image-formats');
  m.respImgKb = savedKb('uses-responsive-images');

  // ---------- PRIORITIZED ROADMAP ----------
  // each: {title, saveMs, effort, phase, why, how}
  const R = [];
  const push = (o) => { if (o.saveMs > 40 || o.always) R.push(o); };

  push({
    title: 'Preload & prioritise the LCP image',
    saveMs: savedMs('prioritize-lcp-image'),
    effort: 'Low', phase: 'Sprint day 1',
    why: m.lcpImage ? `Your hero image (${m.lcpImage.split('/').pop().split('?')[0]}) is discovered late by the browser.` : 'The largest image is discovered late by the browser.',
    how: 'Add fetchpriority="high" to the hero <img> and a <link rel="preload"> in theme.liquid head.',
  });
  push({
    title: 'Compress & convert images to WebP/AVIF',
    saveMs: Math.max(savedMs('uses-optimized-images'), savedMs('modern-image-formats')),
    effort: 'Low', phase: 'Sprint day 1',
    why: m.imgSavKb ? `${m.imgSavKb} KB of image weight is avoidable on this page alone.` : 'Images are served in legacy formats.',
    how: 'Re-encode at quality 80, serve WebP with AVIF fallback via Shopify image_url filters.',
  });
  push({
    title: 'Properly size images for mobile',
    saveMs: savedMs('uses-responsive-images'),
    effort: 'Low', phase: 'Sprint day 1',
    why: m.respImgKb ? `${m.respImgKb} KB wasted sending desktop-sized images to phones.` : 'Oversized images are sent to mobile devices.',
    how: 'Add width/height + srcset breakpoints so phones fetch a 412px-wide asset, not a 2000px one.',
  });
  push({
    title: 'Eliminate render-blocking CSS/JS',
    saveMs: savedMs('render-blocking-resources') || m.rbMs,
    effort: 'Medium', phase: 'Sprint day 2',
    why: m.rbCount ? `${m.rbCount} files block first paint for ~${m.rbMs} ms — the screen stays blank until they finish.` : 'Stylesheets block first paint.',
    how: 'Inline critical CSS, defer the rest, move non-essential scripts to defer/async.',
  });
  push({
    title: 'Tame third-party apps',
    saveMs: m.thirdParties.reduce((s, x) => s + x.blockMs, 0),
    effort: 'Medium', phase: 'Sprint day 2',
    why: m.thirdParties.length ? `${m.thirdParties.slice(0, 3).map(x => x.name).join(', ')} block the main thread while your page tries to render.` : 'Third-party scripts block the main thread.',
    how: 'Lazy-load below-fold widgets, replace heavy apps with native theme code, delay analytics until interaction.',
  });
  push({
    title: 'Remove unused JavaScript',
    saveMs: Math.round(m.unusedJsKb * 1.6), // ~1.6ms per KB parse+exec on mid-tier mobile
    effort: 'Medium', phase: 'Sprint day 2',
    why: m.unusedJsKb ? `${m.unusedJsKb} KB of JS downloads, parses and executes but is never used on this page.` : 'Unused JavaScript is shipped to every visitor.',
    how: 'Tree-shake theme bundles, remove dead app scripts, code-split by template.',
  });
  push({
    title: 'Speed up server response (TTFB)',
    saveMs: savedMs('server-response-time'),
    effort: 'Low', phase: 'Sprint day 3',
    why: m.serverMs ? `Your server takes ${m.serverMs} ms before sending a single byte.` : 'Server response is slow.',
    how: 'Trim Liquid loops in layout, cache heavy sections, cut app blocks that query on render.',
  });
  push({
    title: 'Drop legacy JavaScript polyfills',
    saveMs: Math.round(m.legacyJsKb * 1.6),
    effort: 'Low', phase: 'Sprint day 3',
    why: m.legacyJsKb ? `${m.legacyJsKb} KB of polyfills shipped to modern browsers that don't need them.` : 'Legacy polyfills are shipped unnecessarily.',
    how: 'Target modern baseline in the build; drop ES5 transpilation for evergreen browsers.',
  });

  R.sort((x, y) => y.saveMs - x.saveMs);
  const top = R.filter(r => r.saveMs > 0).slice(0, 6);
  const totalSaveMs = top.reduce((s, r) => s + r.saveMs, 0);
  const projectedLcpMs = Math.max(1200, m.lcpMs - totalSaveMs);

  // ---------- HEAVY APPS from the lead's own tech stack ----------
  const HEAVY = ["Hotjar","Klaviyo","Yotpo","Attentive","Gorgias","Trustpilot","BounceExchange",
    "Visual Website Optimizer","Optimizely","Wisepops","Privy","Justuno","AfterShip","Loox","Judge.me",
    "Stamped","Tidio","Zendesk","Intercom","Drift","SnapEngage","AudioEye","accessiBe","OneTrust",
    "Segment.io","HeapAnalytics","Lucky Orange"];
  const apps = HEAVY.filter(x => (technologies || '').toLowerCase().includes(x.toLowerCase()));

  return { m, roadmap: top, totalSaveMs, projectedLcpMs, apps };
}

if (typeof module !== 'undefined') module.exports = { buildEngine };
