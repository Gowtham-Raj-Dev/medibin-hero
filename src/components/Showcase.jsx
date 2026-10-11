import { useEffect, useRef, useState } from 'react';

/**
 * The "game image" on the home page: a live 3D preview of the bins. The static
 * cover picture shows first (and stays if WebGL is unavailable or on phones).
 */
export default function Showcase({ live = true }) {
  const mountRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!live) return undefined;
    let stage;
    let cancelled = false;
    // three.js is loaded on demand so the home page itself stays light
    import('../game/stage.js')
      .then(({ Stage }) => {
        if (cancelled || !mountRef.current) return;
        stage = new Stage(mountRef.current, { mode: 'showcase' });
        return stage.load().then(() => {
          if (!cancelled) setReady(true);
        });
      })
      .catch((err) => console.warn('3D preview unavailable:', err));
    return () => {
      cancelled = true;
      stage?.dispose();
    };
  }, [live]);

  return (
    <div className="showcase">
      <img className="showcase-poster" src={`${import.meta.env.BASE_URL}cover.jpg`} alt="MediBin Hero — four colour-coded hospital bins" />
      <div ref={mountRef} className={`showcase-live ${ready ? 'is-ready' : ''}`} />
    </div>
  );
}
