import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { normalizeTelegramHash, setupTelegram } from './lib/telegram';
import './styles/app.css';

document.body.classList.add('grain');

// Telegram's launch params live in location.hash (#tgWebAppData=...).
// The SDK (telegram-web-app.js, loaded via defer before this module) has
// already consumed that hash and populated window.Telegram.WebApp.initData.
// After that it's safe to rewrite the hash to a real app route, otherwise
// the hash router would see "tgWebAppData=..." and render NotFound.
try {
  normalizeTelegramHash();
} catch {
  /* never block boot */
}

// Prepare the Telegram mini-app shell (no-op in a regular browser) before the
// first paint: this is what removes Telegram's spinner and goes fullscreen.
setupTelegram();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
