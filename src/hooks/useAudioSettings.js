import { useSyncExternalStore } from 'react';
import { audio } from '../game/audio.js';

let snapshot = { musicOn: audio.musicOn, sfxOn: audio.sfxOn };
const subscribe = (notify) =>
  audio.subscribe(() => {
    snapshot = { musicOn: audio.musicOn, sfxOn: audio.sfxOn };
    notify();
  });

/** Music / sound-effect switches, shared by every page. */
export function useAudioSettings() {
  return useSyncExternalStore(subscribe, () => snapshot);
}
