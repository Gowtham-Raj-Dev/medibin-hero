// Small inline icon set (stroke icons, 24px grid).
const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const make = (children, extra = {}) =>
  function Icon(props) {
    return (
      <svg {...base} {...extra} {...props}>
        {children}
      </svg>
    );
  };

export const PlayIcon = make(<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" />);
export const PauseIcon = make(<><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" /><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" /></>);
export const HomeIcon = make(<><path d="M4 11.5 12 4l8 7.5" /><path d="M6.5 10v9.5h11V10" /></>);
export const RefreshIcon = make(<><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 4v5h-5" /></>);
export const MusicIcon = make(<><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></>);
export const VolumeIcon = make(<><path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z" /><path d="M15.5 9a4.2 4.2 0 0 1 0 6" /><path d="M18 6.5a8 8 0 0 1 0 11" /></>);
export const MuteSlash = make(<path d="M4 4l16 16" />, { className: 'mute-slash' });
export const HeartIcon = make(<path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" fill="currentColor" stroke="none" />);
export const FlameIcon = make(<path d="M12 21c3.9 0 6.5-2.6 6.5-6.2 0-2.8-1.7-4.7-3-6.3-.4 1.5-1.2 2.3-2 2.7.3-3-1-5.7-3.7-7.7.2 2.6-1 4.2-2.3 5.9C6.3 11 5.5 12.7 5.5 14.8 5.5 18.4 8.1 21 12 21z" fill="currentColor" stroke="none" />);
export const StarIcon = make(<path d="m12 3 2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8z" fill="currentColor" stroke="none" />);
export const TrophyIcon = make(<><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a3 3 0 0 0 3 4" /><path d="M16 6h3a3 3 0 0 1-3 4" /><path d="M12 13v4" /><path d="M8.5 20h7" /><path d="M10 17h4v3h-4z" /></>);
export const PhoneIcon = make(<><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></>);
export const MonitorIcon = make(<><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M9 20h6" /><path d="M12 16v4" /></>);
export const ClockIcon = make(<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>);
export const CheckIcon = make(<path d="m5 12.5 4.5 4.5L19 7.5" />, { strokeWidth: 3 });
export const CrossIcon = make(<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />, { strokeWidth: 3 });
export const ArrowRight = make(<><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>);
export const KeyboardIcon = make(<><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7.5 14h9" /></>);
export const MouseIcon = make(<><rect x="7" y="3" width="10" height="18" rx="5" /><path d="M12 7v3" /></>);
export const UserIcon = make(<><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>);

export function Logo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2ee6a8" />
          <stop offset="1" stopColor="#0b8f6c" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#logo-g)" />
      <rect x="14" y="17" width="36" height="7" rx="3.5" fill="#fff" />
      <rect x="26" y="11" width="12" height="6" rx="3" fill="#fff" />
      <path d="M18 27h28l-3.2 23a4 4 0 0 1-4 3.4H25.2a4 4 0 0 1-4-3.4z" fill="#fff" />
      <path d="M29 33h6v5h5v6h-5v5h-6v-5h-5v-6h5z" fill="#0b8f6c" />
    </svg>
  );
}
