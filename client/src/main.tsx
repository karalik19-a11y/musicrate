import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { setupTelegram } from './lib/telegram';
import './styles/app.css';

document.body.classList.add('grain');

// Prepare the Telegram mini-app shell (no-op in a regular browser) before the
// first paint: this is what removes Telegram's spinner and goes fullscreen.
setupTelegram();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
