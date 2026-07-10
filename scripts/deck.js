/* 4-page deck. Pages are content-sized (min-height) so nothing floats in dead space.
   Filmstrip frames are labelled by WHAT THE CUSTOMER SEES, measured from the frame's
   own pixels — not by a raw timestamp, which is meaningless to a founder. */

const DECK_CSS = `
.deck-page{width:1240px;min-height:1754px;background:#fff;position:relative;display:flex;flex-direction:column;
  font-family:'Inter','Segoe UI',system-ui,-apple-system,Arial,sans-serif;color:#16203a;overflow:hidden}
.dp-pad{padding:52px 62px 0;flex:1;display:flex;flex-direction:column}
.dp-eyebrow{font-size:13.5px;letter-spacing:2.5px;text-transform:uppercase;font-weight:700;color:#5B8DEF}
.dp-h1{font-size:52px;line-height:1.05;font-weight:800;letter-spacing:-1.5px;margin:14px 0 0}
.dp-h2{font-size:33px;font-weight:800;letter-spacing:-.7px;margin:9px 0 0}
.dp-sub{font-size:16.5px;color:#5A6683;line-height:1.5;margin-top:8px}
.dp-rule{height:4px;width:64px;background:#5B8DEF;border-radius:3px;margin:16px 0 0}
.dp-sec{font-size:12.5px;letter-spacing:1.5px;text-transform:uppercase;color:#8A94AC;font-weight:700}
.dp-foot{margin-top:auto;margin-left:62px;margin-right:62px;padding:14px 0 20px;display:flex;
  justify-content:space-between;align-items:center;font-size:12px;color:#8A94AC;border-top:1px solid #E6E9F0}
.dp-badge{display:inline-block;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:700}
.b-red{background:#FDECEA;color:#C0392B}.b-amber{background:#FEF4E6;color:#B4690E}.b-green{background:#E7F6EE;color:#1B7F4C}
.dp-card{border:1px solid #E6E9F0;border-radius:14px;padding:18px 20px;background:#fff}
.dp-tbl{width:100%;border-collapse:collapse;font-size:16px}
.dp-tbl th{text-align:left;font-size:11.5px;letter-spacing:1.2px;text-transform:uppercase;color:#8A94AC;
  padding:0 0 11px;font-weight:700;border-bottom:1px solid #E6E9F0}
.dp-tbl td{padding:14px 0;border-bottom:1px solid #F0F2F6;vertical-align:top}
.dp-num{width:36px;height:36px;border-radius:10px;background:#0F1729;color:#fff;display:flex;
  align-items:center;justify-content:center;font-weight:800;font-size:16px;flex:none}
.dp-code{background:#0F1729;color:#D7E3FF;border-radius:12px;padding:15px 18px;
  font:12.5px/1.7 ui-monospace,'SF Mono',Consolas,monospace;white-space:pre;overflow:hidden}
.dp-code .c{color:#7C89A8}.dp-code .k{color:#7FD0A6}.dp-code .s{color:#F0B37E}
.dp-bar{height:10px;border-radius:6px;background:#EEF1F6;overflow:hidden}
.dp-bar i{display:block;height:100%;border-radius:6px}
.dp-phase{display:flex;align-items:center;gap:14px;margin-bottom:10px}
.dp-phase .nm{width:128px;font-size:14px;font-weight:600;color:#3C475F}
.dp-phase .tm{width:74px;text-align:right;font-size:14px;font-weight:700;font-variant-numeric:tabular-nums}
.fs-frame{flex:1;min-width:0}
.fs-shot{border:1px solid #E0E4EC;border-radius:6px;overflow:hidden;background:#fff;aspect-ratio:9/19}
.fs-shot img{width:100%;height:100%;object-fit:cover;display:block}
.fs-lab{text-align:center;font-size:11px;margin-top:6px;font-weight:700;line-height:1.25}
.ab-photo{width:150px;height:150px;border-radius:16px;object-fit:cover;flex:none;border:3px solid #fff;
  box-shadow:0 6px 24px rgba(15,23,41,.18)}
.cs-card{border:1px solid #E6E9F0;border-radius:12px;padding:14px 16px;background:#fff}
.cs-score{font-size:22px;font-weight:800;letter-spacing:-.6px;font-variant-numeric:tabular-nums}
.cs-cat{font-size:10.5px;letter-spacing:1.1px;text-transform:uppercase;color:#8A94AC;font-weight:700}
.cs-rev{font-size:12px;color:#5A6683;margin-top:3px;font-weight:600}
.dp-link{color:#2B5FCC;font-weight:600;text-decoration:none}
`;

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmtMs = ms => ms >= 1000 ? (ms / 1000).toFixed(1) + ' s' : Math.round(ms) + ' ms';
const scoreHex = s => s == null ? '#98a2b8' : s < 50 ? '#C0392B' : s < 90 ? '#E67E22' : '#1B7F4C';

function foot(company, n, total) {
  return `<div class="dp-foot"><span><b style="color:#16203a">Eleven Eleven Media</b> &nbsp;·&nbsp; Store Speed Teardown</span>
    <span>${esc(company)} &nbsp;·&nbsp; ${n} / ${total}</span></div>`;
}

/* Label a frame by what the customer sees. `ink` is measured from the frame's own
   pixels (0 = uniform blank, 1 = busy). Falls back to milestone timing if absent. */
function frameLabel(f, fcpMs, lcpMs) {
  const ink = f.ink;
  if (typeof ink === 'number') {
    if (ink < 0.08) return { txt: 'Blank screen', col: '#C0392B' };
    if (ink < 0.35) return { txt: 'Partly drawn', col: '#E67E22' };
    return { txt: 'Content visible', col: '#1B7F4C' };
  }
  if (fcpMs && f.t < fcpMs) return { txt: 'Blank screen', col: '#C0392B' };
  if (lcpMs && f.t < lcpMs) return { txt: 'Partly drawn', col: '#E67E22' };
  return { txt: 'Content visible', col: '#1B7F4C' };
}

/* ---------- PAGE 1: cover + verdict ---------- */
function pageOne(r, dateStr, total) {
  const m = r.m, s = m.score;
  const cells = [['LCP', m.lcp], ['TBT', m.tbt], ['CLS', m.cls], ['SI', m.si]];
  const extras = [
    m.totalWeight ? ['Page weight', m.totalWeight.replace('Total size was ', '')] : null,
    m.mainThread ? ['Main-thread work', m.mainThread] : null,
    m.serverMs ? ['Server response', m.serverMs + ' ms'] : null,
  ].filter(Boolean);

  return `<div class="deck-page">
    <div style="background:linear-gradient(150deg,#0F1729 0%,#1B2A47 62%,#22345C 100%);padding:38px 62px 32px;position:relative;overflow:hidden">
      <div style="position:absolute;right:-140px;top:-170px;width:520px;height:520px;border-radius:50%;
        background:radial-gradient(circle,rgba(91,141,239,.26),transparent 68%)"></div>
      <div style="position:relative;display:flex;justify-content:space-between;align-items:flex-end;gap:36px">
        <div>
          <div class="dp-eyebrow" style="color:#8FB2F5">Store Speed Teardown</div>
          <h1 class="dp-h1" style="color:#fff">${esc(r.company)}</h1>
          <div style="font-size:16px;color:#A9B6D4;margin-top:8px">${esc(r.domain)}</div>
          <div style="font-size:14.5px;color:#8FA1C4;margin-top:16px;max-width:540px;line-height:1.55">
            Generated from a live Google PageSpeed Insights test. Every number, filename and script named
            inside is from <b style="color:#fff">your store</b>.
          </div>
        </div>
        <div style="text-align:right;flex:none">
          <div style="font-size:12px;color:#8FA1C4;letter-spacing:1.6px;text-transform:uppercase;font-weight:700">Google Performance</div>
          <div style="display:flex;align-items:baseline;gap:9px;justify-content:flex-end;margin-top:6px">
            <div style="font-size:98px;font-weight:800;letter-spacing:-3.5px;line-height:.88;color:${scoreHex(s)}">${s == null ? '—' : s}</div>
            <div style="font-size:26px;color:#6E7EA0;font-weight:700">/100</div>
          </div>
          <div style="font-size:13.5px;color:#A9B6D4;margin-top:9px">Mobile · ${esc(m.lcp || '—')} to load main content</div>
        </div>
      </div>
    </div>

    <div class="dp-pad" style="padding-top:26px">
      <div class="dp-eyebrow">01 &mdash; Diagnosis</div>
      <h2 class="dp-h2">Google's verdict on your store</h2>
      <div class="dp-sub">Run it yourself at pagespeed.web.dev &mdash; same test, same numbers.</div>

      ${r.panel ? `<div style="margin-top:20px;border:1px solid #E6E9F0;border-radius:14px;overflow:hidden">
        <img src="${r.panel}" style="width:100%;display:block"></div>` : ''}

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:13px;margin-top:20px">
        ${cells.map(([k, v]) => `<div class="dp-card" style="padding:15px 17px">
          <div style="font-size:25px;font-weight:800;letter-spacing:-.6px">${esc(v || '—')}</div>
          <div style="font-size:12px;color:#6C7590;font-weight:600;margin-top:4px">${k}</div></div>`).join('')}
      </div>

      ${extras.length ? `<div style="display:grid;grid-template-columns:repeat(${extras.length},1fr);gap:13px;margin-top:13px">
        ${extras.map(([l, v]) => `<div class="dp-card" style="padding:13px 17px">
          <div style="font-size:12px;color:#6C7590;font-weight:600">${l}</div>
          <div style="font-size:20px;font-weight:800;margin-top:3px">${esc(v)}</div></div>`).join('')}
      </div>` : ''}

      <div style="margin-top:16px;padding:14px 18px;background:#F7F9FC;border-radius:12px;font-size:14px;color:#4A5570;line-height:1.55">
        Google's research: as mobile load time goes from <b>1s to 3s</b>, the probability a visitor bounces rises <b>32%</b>.
        Conversion rate falls roughly <b>7% for every additional second</b>.
      </div>
    </div>
    ${foot(r.company, 1, total)}
  </div>`;
}

/* ---------- PAGE 2: filmstrip + LCP phases + third parties ---------- */
function pageTwo(r, total) {
  const m = r.m;
  const frames = (m.filmstripJpg || []).slice(0, 8);
  const ph = m.phases;
  const phTotal = ph ? Object.values(ph).reduce((a, b) => a + b, 0) : 0;
  const phColors = { 'TTFB': '#8A94AC', 'Load Delay': '#C0392B', 'Load Time': '#E67E22', 'Render Delay': '#B4690E' };
  const blanks = frames.filter(f => typeof f.ink === 'number' ? f.ink < 0.08 : (m.fcpMs && f.t < m.fcpMs));
  const lastBlank = blanks.length ? blanks[blanks.length - 1] : null;

  return `<div class="deck-page"><div class="dp-pad">
    <div class="dp-eyebrow">02 &mdash; Where the time goes</div>
    <h2 class="dp-h2">What your customer actually sees</h2>
    <div class="dp-sub">Google's camera, frame by frame, on a mid-tier phone over 4G.</div>
    <div class="dp-rule"></div>

    ${frames.length ? `<div style="display:flex;gap:7px;margin-top:24px">
      ${frames.map(f => { const L = frameLabel(f, m.fcpMs, m.lcpMs); return `<div class="fs-frame">
        <div class="fs-shot"><img src="${f.data}"></div>
        <div class="fs-lab" style="color:${L.col}">${L.txt}</div></div>`; }).join('')}
    </div>
    ${lastBlank ? `<div style="margin-top:13px;padding:14px 18px;background:#FDF3F2;border-radius:11px;font-size:15px;color:#5A4340;line-height:1.55">
      <b style="color:#C0392B">Your customer stares at a blank white screen for the first ${fmtMs(lastBlank.t)}.</b>
      Nothing has been drawn yet &mdash; the browser is still fetching scripts and stylesheets.
    </div>` : ''}` : ''}

    ${ph ? `<div style="margin-top:26px">
      <div class="dp-sec">Your ${esc(m.lcp || '')} LCP, broken into its four phases</div>
      <div style="margin-top:14px">
      ${Object.entries(ph).map(([k, v]) => `<div class="dp-phase">
        <div class="nm">${esc(k)}</div>
        <div style="flex:1"><div class="dp-bar"><i style="width:${phTotal ? Math.max(2, v / phTotal * 100) : 0}%;background:${phColors[k] || '#5B8DEF'}"></i></div></div>
        <div class="tm">${fmtMs(v)}</div></div>`).join('')}
      </div>
      ${ph['Load Delay'] && ph['Load Delay'] > 800 ? `<div style="margin-top:12px;font-size:14.5px;color:#4A5570;line-height:1.6">
        <b style="color:#C0392B">Load Delay is your biggest phase.</b> The browser sat idle for ${fmtMs(ph['Load Delay'])} &mdash; not even <i>aware</i> your hero image existed &mdash; because it was busy with scripts and stylesheets first. This is the single most fixable second on the page.
      </div>` : ''}
    </div>` : ''}

    ${m.thirdParties && m.thirdParties.length ? `<div style="margin-top:26px">
      <div class="dp-sec">Third-party scripts competing with your storefront</div>
      <table class="dp-tbl" style="margin-top:11px">
        <tr><th>Script</th><th style="width:150px">Blocks main thread</th><th style="width:110px">Weight</th></tr>
        ${m.thirdParties.slice(0, 5).map(t => `<tr>
          <td style="font-weight:600;padding:10px 0">${esc(t.name)}</td>
          <td style="padding:10px 0;font-weight:700;color:${t.blockMs > 100 ? '#C0392B' : '#5A6683'}">${t.blockMs ? t.blockMs + ' ms' : '&mdash;'}</td>
          <td style="padding:10px 0;color:#5A6683">${t.kb} KB</td></tr>`).join('')}
      </table>
    </div>` : ''}
    </div>
    ${foot(r.company, 2, total)}
  </div>`;
}

/* ---------- PAGE 3: roadmap ---------- */
function pageThree(r, total) {
  const rows = r.roadmap.slice(0, 6);
  const maxSave = Math.max(...rows.map(x => x.saveMs), 1);
  const eff = e => e === 'Low' ? 'b-green' : e === 'Medium' ? 'b-amber' : 'b-red';
  return `<div class="deck-page"><div class="dp-pad">
    <div class="dp-eyebrow">03 &mdash; The fix list</div>
    <h2 class="dp-h2">Ranked by seconds recovered</h2>
    <div class="dp-sub">From your audit data &mdash; ordered by impact, not by what's easiest to sell.</div>
    <div class="dp-rule"></div>

    <div style="display:flex;gap:13px;margin-top:22px">
      <div class="dp-card" style="flex:1;background:#0F1729;border-color:#0F1729;color:#fff">
        <div style="font-size:11.5px;letter-spacing:1.3px;text-transform:uppercase;color:#8FA1C4;font-weight:700">Recoverable</div>
        <div style="font-size:34px;font-weight:800;margin-top:5px;letter-spacing:-1.1px">${fmtMs(r.totalSaveMs)}</div></div>
      <div class="dp-card" style="flex:1">
        <div style="font-size:11.5px;letter-spacing:1.3px;text-transform:uppercase;color:#8A94AC;font-weight:700">LCP today</div>
        <div style="font-size:34px;font-weight:800;margin-top:5px;color:#C0392B;letter-spacing:-1.1px">${esc(r.m.lcp || '—')}</div></div>
      <div class="dp-card" style="flex:1">
        <div style="font-size:11.5px;letter-spacing:1.3px;text-transform:uppercase;color:#8A94AC;font-weight:700">LCP after</div>
        <div style="font-size:34px;font-weight:800;margin-top:5px;color:#1B7F4C;letter-spacing:-1.1px">~${fmtMs(r.projectedLcpMs)}</div></div>
    </div>

    <table class="dp-tbl" style="margin-top:24px">
      <tr><th style="width:46px"></th><th>Fix</th><th style="width:128px">Time saved</th><th style="width:92px">Effort</th></tr>
      ${rows.map((x, i) => `<tr>
        <td><div class="dp-num">${i + 1}</div></td>
        <td><div style="font-weight:700;font-size:16.5px">${esc(x.title)}</div>
            <div style="color:#5A6683;font-size:14px;line-height:1.5;margin-top:4px">${esc(x.why)}</div>
            <div style="color:#8A94AC;font-size:13px;margin-top:4px"><b style="color:#5B8DEF">How:</b> ${esc(x.how)}</div></td>
        <td><div style="font-weight:800;font-size:17.5px;font-variant-numeric:tabular-nums">${fmtMs(x.saveMs)}</div>
            <div class="dp-bar" style="margin-top:6px;width:92px"><i style="width:${x.saveMs / maxSave * 100}%;background:#5B8DEF"></i></div></td>
        <td><span class="dp-badge ${eff(x.effort)}">${esc(x.effort)}</span></td></tr>`).join('')}
    </table>
    <div style="margin-top:14px;font-size:12.5px;color:#8A94AC;line-height:1.55">
      Savings are Google's own <i>metricSavings</i> estimates from your Lighthouse run. Real-world results vary; treat the ranking as reliable and the totals as directional.
    </div>
    </div>
    ${foot(r.company, 3, total)}
  </div>`;
}

/* ---------- PAGE 4: gift + offer ---------- */
function pageFour(r, total) {
  const m = r.m, s = m.score;
  const img = m.lcpImage ? m.lcpImage.split('/').pop().split('?')[0] : 'your-hero-image.jpg';
  const preSave = r.roadmap.find(x => /Preload/.test(x.title))?.saveMs || 800;
  const tp = (m.thirdParties || []).filter(x => x.blockMs > 0).slice(0, 3);
  return `<div class="deck-page"><div class="dp-pad">
    <div class="dp-eyebrow" style="color:#1B7F4C">04 &mdash; Yours to keep</div>
    <h2 class="dp-h2">Three fixes you can ship today</h2>
    <div class="dp-sub">No agency required. Copy, paste, save.</div>
    <div class="dp-rule" style="background:#1B7F4C"></div>

    <div style="margin-top:22px">
      <div style="display:flex;align-items:center;gap:12px">
        <div class="dp-num" style="background:#1B7F4C">1</div>
        <div style="font-weight:700;font-size:17px">Preload your hero image
          <span class="dp-badge b-green" style="margin-left:6px">~${fmtMs(Math.max(400, preSave))} faster</span></div>
      </div>
      <div style="color:#5A6683;font-size:14px;margin:7px 0 9px 48px">In <b>theme.liquid</b>, paste inside &lt;head&gt;. Tells the browser to fetch your hero before it finishes reading your stylesheets.</div>
      <div class="dp-code" style="margin-left:48px">&lt;link <span class="k">rel</span>=<span class="s">"preload"</span> <span class="k">as</span>=<span class="s">"image"</span> <span class="k">fetchpriority</span>=<span class="s">"high"</span>
      <span class="k">href</span>=<span class="s">"${esc(m.lcpImage || '/path/to/' + img)}"</span>&gt;</div>
    </div>

    <div style="margin-top:20px">
      <div style="display:flex;align-items:center;gap:12px">
        <div class="dp-num" style="background:#1B7F4C">2</div>
        <div style="font-weight:700;font-size:17px">Stop lazy-loading the hero
          <span class="dp-badge b-green" style="margin-left:6px">~300 ms faster</span></div>
      </div>
      <div style="color:#5A6683;font-size:14px;margin:7px 0 9px 48px">Most Shopify themes lazy-load every image. For the one visible on arrival, that delays the very thing Google measures.</div>
      <div class="dp-code" style="margin-left:48px"><span class="c">- </span>&lt;img <span class="k">loading</span>=<span class="s">"lazy"</span> <span class="k">src</span>=<span class="s">"&hellip;${esc(img)}"</span>&gt;
<span class="c">+ </span>&lt;img <span class="k">loading</span>=<span class="s">"eager"</span> <span class="k">fetchpriority</span>=<span class="s">"high"</span> <span class="k">src</span>=<span class="s">"&hellip;${esc(img)}"</span>&gt;</div>
    </div>

    <div style="margin-top:20px">
      <div style="display:flex;align-items:center;gap:12px">
        <div class="dp-num" style="background:#1B7F4C">3</div>
        <div style="font-weight:700;font-size:17px">Compress it properly
          ${m.lcpImageKb ? `<span class="dp-badge b-green" style="margin-left:6px">saves ~${Math.round(m.lcpImageKb * 0.7)} KB</span>` : ''}</div>
      </div>
      <div style="color:#5A6683;font-size:14px;margin:7px 0 0 48px">
        ${m.lcpImageKb ? `Your <b>${esc(img)}</b> ships at <b>${m.lcpImageKb} KB</b>. ` : ''}Drop it into <b>squoosh.app</b>, choose WebP at quality 80, re-upload in your theme editor. Ten minutes, no code.
      </div>
    </div>

    ${tp.length ? `<div style="margin-top:20px;background:#FFF8E8;border-left:4px solid #F0B429;border-radius:0 10px 10px 0;padding:14px 18px">
      <div style="font-weight:700;font-size:14.5px;margin-bottom:5px">Bonus: your heaviest scripts</div>
      <div style="font-size:13.5px;color:#5A5240;line-height:1.65">
      ${tp.map(x => `<b>${esc(x.name)}</b> blocks ${x.blockMs} ms`).join(' &nbsp;·&nbsp; ')}. Delay these until first scroll and your Total Blocking Time drops immediately.</div></div>` : ''}

    <div style="margin-top:26px;background:linear-gradient(150deg,#0F1729,#1D2B4A);border-radius:18px;padding:30px 34px;color:#fff;position:relative;overflow:hidden">
      <div style="position:absolute;right:-110px;bottom:-130px;width:380px;height:380px;border-radius:50%;
        background:radial-gradient(circle,rgba(91,141,239,.24),transparent 70%)"></div>
      <div style="position:relative">
        <div class="dp-eyebrow" style="color:#8FB2F5">What happens next</div>
        <div style="font-size:28px;font-weight:800;letter-spacing:-.6px;margin-top:8px">The Core Web Vitals Sprint</div>
        <div style="font-size:15px;color:#A9B6D4;margin-top:7px;max-width:700px;line-height:1.55">
          Everything on page 3 &mdash; implemented in your theme, tested, shipped in 72 hours. If your score doesn't move, you don't pay. That's the whole deal.
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:20px">
          ${[[22,81],[34,75],[38,91],[42,79]].map(([a,b]) => `
            <div style="border-radius:11px;padding:13px 10px;background:rgba(255,255,255,.06);text-align:center">
              <div style="font-size:22px;font-weight:800;letter-spacing:-.6px">
                <span style="color:#E06B5C">${a}</span>
                <span style="color:#6E7EA0;font-size:16px;margin:0 5px">&#8594;</span>
                <span style="color:#5FCF9B">${b}</span></div>
              <div style="font-size:10px;color:#8FA1C4;margin-top:4px;letter-spacing:.5px">MOBILE SCORE</div></div>`).join('')}
        </div>
        <div style="margin-top:22px;background:#5B8DEF;border-radius:14px;padding:18px 22px;display:flex;
          justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:19px;font-weight:800;letter-spacing:-.3px">Your score today: ${s == null ? '—' : s}. Let's move it.</div>
            <div style="font-size:13.5px;color:#EAF1FE;margin-top:3px">72 hours &middot; You only pay if the score improves &middot; No improvement, no invoice</div>
          </div>
          <div style="text-align:right;font-size:15.5px;font-weight:800">Eleven Eleven Media</div>
        </div>
      </div>
    </div>
    </div>
    ${foot(r.company, 4, total)}
  </div>`;
}

/* ---------- PAGE 5: who's behind this ---------- */
function pageFive(r, total, cfg) {
  const c = cfg || {};
  const cases = [
    ['Skincare',          34, 75, '$1M MRR'],
    ['Supplement',        22, 81, '$710K/mo'],
    ['Athleisure',        42, 79, '$550K/mo'],
    ['Luxury jewellery',  38, 91, ''],
    ['Women\'s apparel',  51, 74, ''],
    ['Art & craft',       28, 70, ''],
    ['Supplement',        48, 74, ''],
    ['Lifestyle',         49, 72, ''],
  ];
  return `<div class="deck-page"><div class="dp-pad">
    <div class="dp-eyebrow">05 &mdash; Who's behind this</div>
    <h2 class="dp-h2">About me</h2>
    <div class="dp-rule"></div>

    <div style="display:flex;gap:26px;align-items:flex-start;margin-top:26px">
      ${c.photo ? `<img class="ab-photo" src="${c.photo}" alt="Yash">` : ''}
      <div style="flex:1">
        <div style="font-size:19px;font-weight:700;line-height:1.5;color:#16203a">
          I'm Yash, and I run <b>Eleven Eleven Media</b> &mdash; we help 7-figure DTC and ecommerce brands add
          an additional <b>$10k&ndash;$30k/mo</b> in compounding revenue organically.
        </div>
        <div style="font-size:15px;color:#5A6683;line-height:1.6;margin-top:12px">
          We've taken <b style="color:#1B7F4C">170+ brands</b> from scores stuck in the 20s and 30s into the 70s, 80s and 90s.
          Not case studies in theory &mdash; live stores doing millions a month.
        </div>
        <div style="display:flex;gap:22px;margin-top:16px;font-size:14px">
          ${c.linkedin ? `<a class="dp-link" href="${c.linkedin}">LinkedIn &rarr;</a>` : ''}
          ${c.website ? `<a class="dp-link" href="${c.website}">${c.website.replace(/^https?:\/\//,'')} &rarr;</a>` : ''}
        </div>
      </div>
    </div>

    <div style="margin-top:32px">
      <div class="dp-sec">Core Web Vitals results for some of them</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:14px">
        ${cases.map(([cat, a, b, rev]) => `<div class="cs-card">
          <div class="cs-cat">${esc(cat)}</div>
          <div class="cs-score" style="margin-top:6px">
            <span style="color:#C0392B">${a}</span>
            <span style="color:#98A2B8;font-size:15px;margin:0 5px">&#8594;</span>
            <span style="color:#1B7F4C">${b}</span></div>
          ${rev ? `<div class="cs-rev">${esc(rev)}</div>` : '<div class="cs-rev" style="color:#C3C9D6">&mdash;</div>'}
        </div>`).join('')}
      </div>
      <div style="margin-top:12px;font-size:12.5px;color:#8A94AC;line-height:1.55">
        Mobile PageSpeed score, before &rarr; after. Real stores, real theme work &mdash; no synthetic test pages.
      </div>
    </div>

    <div style="margin-top:30px;display:grid;grid-template-columns:repeat(3,1fr);gap:13px">
      ${[['170+','Ecommerce brands served'],['72 hrs','Typical sprint turnaround'],['0','You pay if the score doesn\'t move']]
        .map(([n,l])=>`<div class="dp-card" style="text-align:center;padding:18px 14px">
          <div style="font-size:30px;font-weight:800;letter-spacing:-1px;color:#0F1729">${n}</div>
          <div style="font-size:12.5px;color:#6C7590;font-weight:600;margin-top:5px;line-height:1.4">${l}</div></div>`).join('')}
    </div>

    <div style="margin-top:30px;padding:22px 26px;background:#F7F9FC;border-radius:14px;
      display:flex;justify-content:space-between;align-items:center;gap:20px">
      <div>
        <div style="font-size:17px;font-weight:800">Want the rest of ${esc(r.company)}'s fixes done for you?</div>
        <div style="font-size:14px;color:#5A6683;margin-top:5px">Reply to this email, or book a 15-minute call. If the score doesn't improve, there's no invoice.</div>
      </div>
      ${c.website ? `<a class="dp-link" href="${c.website}" style="flex:none;background:#5B8DEF;color:#fff;
        padding:13px 22px;border-radius:10px;font-size:14.5px;font-weight:700;text-decoration:none">Book a call</a>` : ''}
    </div>
    </div>
    ${foot(r.company, 5, total)}
  </div>`;
}

function deckHtml(r, dateStr, cfg) {
  const total = 5;
  return [pageOne(r, dateStr, total), pageTwo(r, total), pageThree(r, total),
          pageFour(r, total), pageFive(r, total, cfg)];
}

if (typeof module !== 'undefined') module.exports = { DECK_CSS, deckHtml };
