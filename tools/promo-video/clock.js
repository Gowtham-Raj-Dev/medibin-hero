// Runs in the game page before any of its scripts (capture.mjs adds it as an init script) and
// puts the page on a virtual clock: time only moves when __clock.tick(ms) is called. The 3D
// stage, React's count-up and every CSS animation / transition then advance exactly one video
// frame at a time, however long the computer needs to draw it.
(() => {
  const realFrame = window.requestAnimationFrame.bind(window);
  let now = 0;
  let queue = [];
  let handle = 0;
  const seen = new WeakSet();

  performance.now = () => now;
  window.requestAnimationFrame = (callback) => {
    queue.push([++handle, callback]);
    return handle;
  };
  window.cancelAnimationFrame = (id) => {
    queue = queue.filter(([h]) => h !== id);
  };

  // the same dice every run, so the same waste items come up
  let seed = 20261011;
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  window.__clock = {
    tick(ms) {
      now += ms;
      const run = queue;
      queue = [];
      for (const [, callback] of run) callback(now);
      for (const animation of document.getAnimations()) {
        if (!seen.has(animation)) {
          // new since the last frame: it has been running in real time, so start it again from 0
          seen.add(animation);
          animation.pause();
          animation.currentTime = 0;
        }
        animation.currentTime = Number(animation.currentTime ?? 0) + ms;
      }
    },
    /** Let React commit and the browser paint what the last tick changed. */
    settle: () => new Promise((resolve) => realFrame(() => realFrame(resolve))),
  };
})();
