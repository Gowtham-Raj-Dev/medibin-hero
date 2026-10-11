import { audio } from '../game/audio.js';
import { useAudioSettings } from '../hooks/useAudioSettings.js';
import { MusicIcon, VolumeIcon, MuteSlash } from './icons.jsx';

/** Music and sound-effect on/off buttons. */
export default function SoundToggles({ className = '' }) {
  const { musicOn, sfxOn } = useAudioSettings();
  const toggle = (kind) => {
    audio.unlock();
    if (kind === 'music') audio.setMusic(!musicOn);
    else audio.setSfx(!sfxOn);
    audio.click();
  };
  return (
    <div className={`sound-toggles ${className}`}>
      <button type="button" className={`icon-btn ${musicOn ? '' : 'is-off'}`} onClick={() => toggle('music')} aria-pressed={musicOn} title={musicOn ? 'Music on' : 'Music off'} aria-label="Toggle music">
        <MusicIcon />
        {!musicOn && <MuteSlash />}
      </button>
      <button type="button" className={`icon-btn ${sfxOn ? '' : 'is-off'}`} onClick={() => toggle('sfx')} aria-pressed={sfxOn} title={sfxOn ? 'Sound effects on' : 'Sound effects off'} aria-label="Toggle sound effects">
        <VolumeIcon />
        {!sfxOn && <MuteSlash />}
      </button>
    </div>
  );
}
