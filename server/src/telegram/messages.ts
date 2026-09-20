import type { Track } from '@shared/types';

/**
 * Texts and buttons the bot sends. Pure functions — unit-tested, and kept
 * free of any parse_mode so user-provided titles can never inject markup.
 */

/** mm:ss (or h:mm:ss) from seconds — mirrors the client's formatTime. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

/** The web app entry (used for the persistent "open" button). */
export function appButtonUrl(webappUrl: string): string {
  return webappUrl;
}

/** Deep link straight into the newly published track inside the mini app. */
export function trackButtonUrl(webappUrl: string, trackId: string): string {
  return `${webappUrl.replace(/\/+$/, '')}/#/track/${trackId}`;
}

export function welcomeMessage(firstName?: string): string {
  const hi = firstName ? `Привет, ${firstName}!` : 'Привет!';
  return [
    hi,
    '',
    'Это MUSICRATE — закрытая музыкальная платформа: артисты выкладывают треки, а гости оценивают их от 0 до 90.',
    '',
    'Как только на сайте появится новый трек, я пришлю сюда сообщение с кнопкой.',
    'Остановить рассылку можно в любой момент командой /stop.',
  ].join('\n');
}

export function helpMessage(): string {
  return [
    'MUSICRATE — закрытая музыкальная платформа.',
    '',
    '• Кнопка ниже открывает приложение',
    '• /start — подписаться на новые треки',
    '• /stop — отключить рассылку',
  ].join('\n');
}

export function newTrackMessage(track: Track): string {
  const lines = ['🎧 Новый трек на MUSICRATE', '', `«${track.title}» — ${track.artistName}`];
  const duration = formatDuration(track.duration);
  if (duration) lines.push(`⏱ ${duration}`);
  lines.push('', 'Послушай и поставь оценку от 0 до 90.');
  return lines.join('\n');
}
