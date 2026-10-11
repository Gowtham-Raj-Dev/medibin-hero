import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/base.css';
import App from './App.jsx';

// The fonts are declared and preloaded in index.html. Wait for them before the first render so
// text never shows in a fallback font and then changes. On a very slow connection, stop waiting
// after a moment rather than hold the page back.
const fontsReady = Promise.all([
  document.fonts.load('500 16px "Outfit Variable"'),
  document.fonts.load('800 16px "Baloo Thambi 2 Variable"'),
  document.fonts.load('700 16px "Baloo Thambi 2 Variable"', 'தமிழ்'),
]).catch(() => {});
// BASE_URL is '/' locally and '/<repo>/' on GitHub Pages; the router and every public file path follow it.
const giveUp = new Promise((resolve) => setTimeout(resolve, 2500));

Promise.race([fontsReady, giveUp]).then(() => {
  createRoot(document.getElementById('root')).render(
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <App />
    </BrowserRouter>,
  );
});
