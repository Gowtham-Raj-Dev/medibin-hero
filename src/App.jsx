import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Home from './pages/Home.jsx';

// The game (and three.js with it) is only downloaded when someone opens /play.
const Play = lazy(() => import('./pages/Play.jsx'));

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route
        path="/play"
        element={
          <Suspense fallback={<div className="route-loading">Loading game…</div>}>
            <Play />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
