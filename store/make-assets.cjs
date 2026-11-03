// Google Play store graphics (spec: store listing): phone screenshots framed at 1080 × 1920 (9:16)
// with a caption, and the 1024 × 500 featured graphic. Each is plain HTML rendered by Playwright;
// sources are real QueAura screens in store/source/. Run: node store/make-assets.cjs
// (needs Playwright). Host-app screenshots from a phone go in store/source/ and the list below.
const { chromium } = require('playwright');
const path = require('node:path');

const fs = require('node:fs');

const here = __dirname;
const fonts = path.join(here, '..', 'web', 'src', 'fonts');
// Pages are set from strings (a blank origin can't read local files), so images and fonts go in
// as data URLs.
const dataUrl = (file, type) => `data:${type};base64,${fs.readFileSync(file).toString('base64')}`;
const src = (f) => dataUrl(path.join(here, 'source', f), 'image/png');
const font = (f) => dataUrl(path.join(fonts, f), 'font/woff2');

const css = `
@font-face { font-family: 'Tilt Neon'; src: url('${font('TiltNeon-Regular.woff2')}'); }
@font-face { font-family: 'Big Shoulders Display'; src: url('${font('BigShouldersDisplay-Black.woff2')}'); font-weight: 900; }
@font-face { font-family: 'Manrope'; src: url('${font('Manrope-SemiBold.woff2')}'); font-weight: 600; }
:root { --bg: #120a1f; --violet: #b98cff; --gold: #ffd166; --text: #f4ecff; --muted: #b9a8d6; }
* { box-sizing: border-box; margin: 0; }
body { background: radial-gradient(ellipse at 50% 0%, #2a1650 0%, var(--bg) 60%); color: var(--text); font-family: 'Manrope'; overflow: hidden; }
.que { color: var(--violet); text-shadow: 0 0 18px rgb(185 140 255 / 0.7); }
.aura { color: var(--gold); text-shadow: 0 0 18px rgb(255 209 102 / 0.65); }
`;

/** A phone screen, or a landscape TV screen, under a caption, on the brand background. */
function screenshotPage({ image, title, sub, landscape }) {
  const shot = landscape
    ? `<div class="tv"><img src="${src(image)}"></div><div class="stand"></div>`
    : `<div class="phone"><img src="${src(image)}"></div>`;
  return `<!doctype html><html><head><style>${css}
    body { width: 1080px; height: 1920px; display: flex; flex-direction: column; align-items: center; padding-top: 120px; }
    h1 { font-family: 'Big Shoulders Display'; font-weight: 900; font-size: 108px; line-height: 1; text-transform: uppercase; letter-spacing: 2px; text-align: center; color: var(--gold); text-shadow: 0 0 24px rgb(255 209 102 / 0.55); padding: 0 70px; }
    p { font-size: 46px; color: var(--muted); text-align: center; margin-top: 28px; padding: 0 90px; }
    .phone { margin-top: 90px; width: 760px; height: 1350px; border-radius: 70px; padding: 22px; background: #07040d; box-shadow: 0 0 0 4px #3a2a5c, 0 0 80px rgb(185 140 255 / 0.35); overflow: hidden; }
    .phone img { width: 100%; height: 100%; object-fit: cover; object-position: top; border-radius: 50px; display: block; }
    .tv { margin-top: 260px; width: 980px; border-radius: 26px; padding: 16px; background: #07040d; box-shadow: 0 0 0 4px #3a2a5c, 0 0 90px rgb(255 209 102 / 0.25); }
    .tv img { width: 100%; display: block; border-radius: 14px; }
    .stand { width: 260px; height: 26px; margin-top: 18px; border-radius: 13px; background: #3a2a5c; }
  </style></head><body><h1>${title}</h1><p>${sub}</p>${shot}</body></html>`;
}

function featuredGraphic() {
  return `<!doctype html><html><head><style>${css}
    body { width: 1024px; height: 500px; position: relative; }
    .words { position: absolute; left: 64px; top: 92px; width: 420px; }
    .logo { font-family: 'Tilt Neon'; font-size: 104px; line-height: 1; }
    .tag { font-family: 'Big Shoulders Display'; font-weight: 900; font-size: 46px; line-height: 1.05; text-transform: uppercase; color: var(--text); margin-top: 26px; letter-spacing: 1px; }
    .sub { font-size: 22px; color: var(--muted); margin-top: 16px; }
    .tv { position: absolute; right: 40px; top: 70px; width: 470px; border-radius: 16px; padding: 10px; background: #07040d; box-shadow: 0 0 0 3px #3a2a5c, 0 0 60px rgb(255 209 102 / 0.25); }
    .tv img { width: 100%; display: block; border-radius: 8px; }
    .phone { position: absolute; right: 330px; top: 160px; width: 150px; height: 290px; border-radius: 24px; padding: 7px; background: #07040d; box-shadow: 0 0 0 3px #3a2a5c, 0 0 40px rgb(185 140 255 / 0.45); overflow: hidden; }
    .phone img { width: 100%; height: 100%; object-fit: cover; object-position: top; border-radius: 18px; display: block; }
  </style></head><body>
    <div class="words"><div class="logo"><span class="que">Que</span><span class="aura">Aura</span></div><div class="tag">The quiz night<br>on your phone</div><div class="sub">Everyone plays from their own phone. No app for them.</div></div>
    <div class="tv"><img src="${src('tv-reveal.png')}"></div>
    <div class="phone"><img src="${src('p3-question.png')}"></div>
  </body></html>`;
}

const screenshots = [
  { out: '1-play-on-your-phone.png', image: 'p3-question.png', title: 'Everyone plays on their own phone', sub: 'Tap your answer before the clock runs out.' },
  { out: '2-join-in-seconds.png', image: 'p1-join.png', title: 'Join in seconds', sub: 'Players scan a code. No app, no account.' },
  { out: '3-on-the-big-screen.png', image: 'tv-reveal.png', title: 'On the big screen', sub: 'Put the game on any smart TV for the whole room.', landscape: true },
  { out: '4-moments.png', image: 'p4-correct.png', title: 'Fastest finger first', sub: 'Multiple choice, closest guess, fastest finger and more.' },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const s of screenshots) {
    await page.setViewportSize({ width: 1080, height: 1920 });
    await page.setContent(screenshotPage(s), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(here, 'screenshots', s.out) });
  }
  await page.setViewportSize({ width: 1024, height: 500 });
  await page.setContent(featuredGraphic(), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(here, 'feature-graphic.png') });
  await browser.close();
  console.log('Written: store/screenshots/*.png, store/feature-graphic.png');
})();
