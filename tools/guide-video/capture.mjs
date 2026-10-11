// Film the bin-guide video one frame at a time (1920×1080, 30 fps).
//
//   npx vite --port 5199 --strictPort            (terminal 1: the dev server)
//   python tools/guide-video/vo.py                (narration; its line lengths set the timing)
//   node tools/guide-video/capture.mjs            (terminal 2: frames for both languages)
//   python tools/guide-video/build.py             (frames + narration + music → public/video/)
//
// Options: --lang ta            one language (default: en,ta)
//          --frames D:\tmp      where the frames go (default tools/guide-video/work; ~500 MB a language)
//          --stills 3,20.5,41   only save PNG stills at these seconds (to check the framing)
//          --from 1200          carry on an interrupted capture at this frame (use with one --lang)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORK = path.join(HERE, 'work');
const arg = (key, fallback) => {
  const i = process.argv.indexOf('--' + key);
  return i > 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const LANGS = String(arg('lang', 'en,ta')).split(',');
const FRAMES = path.resolve(String(arg('frames', WORK)));
const STILLS = arg('stills', '') ? String(arg('stills')).split(',').map(Number) : null;
const FROM = Number(arg('from', 0));
const URL = arg('url', 'http://localhost:5199/tools/guide-video/film.html');

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  // the real GPU: the software renderer is far too slow for the shadows
  args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
});

for (const lang of LANGS) {
  const durations = JSON.parse(fs.readFileSync(path.join(WORK, lang, 'vo', 'durations.json'), 'utf8'));
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' || /context lost/i.test(m.text())) console.log(m.type() + ':', m.text().slice(0, 300));
  });
  // the dev server's hot-reload socket never connects: saving a file during the capture must not reload the page
  await page.routeWebSocket(/.*/, () => {});
  await page.goto(URL);
  await page.waitForFunction(() => window.__film, null, { timeout: 120000 });
  const info = await page.evaluate(([l, d]) => window.__film.init(l, d), [lang, durations]);
  fs.mkdirSync(path.join(WORK, lang), { recursive: true });
  fs.writeFileSync(path.join(WORK, lang, 'timeline.json'), JSON.stringify(info, null, 1));
  console.log(`${lang}: ${info.frames} frames = ${info.total.toFixed(1)} s`);

  const out = path.join(FRAMES, lang, STILLS ? 'stills' : 'frames');
  fs.mkdirSync(out, { recursive: true });
  const t0 = Date.now();
  if (STILLS) {
    let next = 0;
    for (const seconds of STILLS) {
      const target = Math.min(info.frames - 1, Math.round(seconds * info.fps));
      // frames in between are drawn but not saved (the bins' springs and the confetti carry over)
      await page.evaluate(async ([from, to]) => {
        for (let i = from; i < to; i++) await window.__film.frame(i, false);
      }, [next, target]);
      await page.evaluate((i) => window.__film.frame(i), target);
      await page.screenshot({ path: path.join(out, `t${seconds.toFixed(1).padStart(6, '0')}.png`) });
      next = target + 1;
    }
    console.log(`  ${STILLS.length} stills → ${out}`);
  } else {
    // --from: frames before it are drawn but not saved again (the film has to be played from the start)
    await page.evaluate(async (to) => {
      for (let i = 0; i < to; i++) await window.__film.frame(i, false);
    }, FROM);
    for (let i = FROM; i < info.frames; i++) {
      await page.evaluate((f) => window.__film.frame(f), i);
      await page.screenshot({ path: path.join(out, `f${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 93 });
      if (i % 300 === 299) console.log(`  ${i + 1} / ${info.frames}   (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    }
    console.log(`  ${info.frames} frames → ${out}   (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  await page.close();
}
await browser.close();
