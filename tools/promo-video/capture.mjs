// Film the gameplay promo from the real game, one frame at a time (1920×1080, 30 fps).
//
//   npx vite --port 5199 --strictPort            (terminal 1: the dev server)
//   node tools/promo-video/capture.mjs            (terminal 2: frames → tools/promo-video/work/frames)
//   python tools/promo-video/build.py             (frames + narration + music → public/video/gameplay.mp4)
//
// Options: --frames D:\tmp      where the frames go (default tools/promo-video/work; ~250 MB)
//          --stills             save a PNG every 2 seconds instead (to check the framing)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORK = path.join(HERE, 'work');
const arg = (key, fallback) => {
  const i = process.argv.indexOf('--' + key);
  return i > 0 && process.argv[i + 1] !== undefined && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
};
const STILLS = process.argv.includes('--stills');
const OUT = path.join(path.resolve(String(arg('frames', WORK))), STILLS ? 'stills' : 'frames');
const URL = arg('url', 'http://localhost:5199/play');

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
page.on('console', (m) => {
  if (m.type() === 'error' || /context lost/i.test(m.text())) console.log(m.type() + ':', m.text().slice(0, 300));
});
await page.addInitScript({ path: path.join(HERE, 'clock.js') });
// a clean device with a few earlier players, so the results screen has a leaderboard to top
await page.addInitScript(() => {
  localStorage.setItem('medibin.player', JSON.stringify({ name: '', role: 'staff' }));
  localStorage.setItem('medibin.scores', JSON.stringify([
    { id: 'a', name: 'Anitha', role: 'staff', score: 128, date: '2026-10-01' },
    { id: 'b', name: 'Karthik', role: 'student', score: 96, date: '2026-10-02' },
    { id: 'c', name: 'Meena', role: 'public', score: 71, date: '2026-10-03' },
  ]));
});
await page.routeWebSocket(/.*/, () => {}); // no hot reload during the capture
await page.goto(URL);
await page.waitForSelector('.gate button[type=submit]:not([disabled])', { timeout: 120000 });
await page.addScriptTag({ path: path.join(HERE, 'director.js') });

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(WORK, { recursive: true });
const t0 = Date.now();
let frames = 0;
for (;;) {
  const step = await page.evaluate(() => window.__promo.step());
  if (step.done) break;
  if (!step.save) continue;
  if (STILLS) {
    if (frames % 60 === 30) await page.screenshot({ path: path.join(OUT, `t${String(Math.round(frames / 30)).padStart(3, '0')}.png`) });
  } else {
    await page.screenshot({ path: path.join(OUT, `f${String(frames).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 93 });
  }
  frames = step.frames;
  if (frames % 300 === 0) console.log(`  ${frames} frames   (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
const events = await page.evaluate(() => window.__promo.events);
fs.writeFileSync(path.join(WORK, 'timeline.json'), JSON.stringify({ fps: 30, frames, total: frames / 30, events }, null, 1));
console.log(`${frames} frames = ${(frames / 30).toFixed(1)} s → ${OUT}`);
await browser.close();
