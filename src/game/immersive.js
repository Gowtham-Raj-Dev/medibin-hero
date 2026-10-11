// Phones and tablets play fullscreen and in landscape.
// Browsers only allow this from a tap, so call enterImmersive() inside a click handler.

export const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches;

export async function enterImmersive() {
  if (!isTouchDevice()) return;
  const root = document.documentElement;
  try {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' });
      else root.webkitRequestFullscreen?.();
    }
  } catch {
    // iPhone Safari has no fullscreen for pages — the game still runs in the normal view
  }
  try {
    await screen.orientation?.lock?.('landscape');
  } catch {
    // no orientation lock (iPhone, in-app browsers): Play.jsx turns the game sideways with CSS instead
  }
}

export function exitImmersive() {
  try {
    screen.orientation?.unlock?.();
  } catch {
    // nothing to unlock
  }
  try {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (document.webkitFullscreenElement) document.webkitExitFullscreen?.();
  } catch {
    // already out of fullscreen
  }
}
