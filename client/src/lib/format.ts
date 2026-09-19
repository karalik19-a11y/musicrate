/** mm:ss (or h:mm:ss) from seconds. */
export function formatTime(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

/** Russian plural forms: plural(3, ['оценка', 'оценки', 'оценок']) → "3 оценки". */
export function plural(n: number, forms: [string, string, string], withNumber = true): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  let form: string;
  if (abs > 10 && abs < 20) form = forms[2];
  else if (last > 1 && last < 5) form = forms[1];
  else if (last === 1) form = forms[0];
  else form = forms[2];
  return withNumber ? `${formatInt(n)} ${form}` : form;
}

export const ratingsLabel = (n: number) => plural(n, ['оценка', 'оценки', 'оценок']);
export const playsLabel = (n: number) => plural(n, ['прослушивание', 'прослушивания', 'прослушиваний']);
export const tracksLabel = (n: number) => plural(n, ['трек', 'трека', 'треков']);

/** 1842 → "1 842" (thin non-breaking spaces, like iOS ru locale). */
export function formatInt(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009');
}

/** Community average component: one decimal, "27.1". */
export function formatScore(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1);
}

/** Total 0..90 rounded to an integer for the headline number. */
export function formatTotal(value: number): string {
  return String(Math.round(value));
}

export function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays <= 0 && now.toDateString() === d.toDateString()) return 'сегодня';
  if (diffDays === 1) return 'вчера';
  if (diffDays < 7) return `${diffDays} дн. назад`;
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Score tier used for colouring badges. */
export function scoreTier(total: number, count: number): 'none' | 'low' | 'mid' | 'high' {
  if (count === 0) return 'none';
  if (total >= 72) return 'high';
  if (total >= 50) return 'mid';
  return 'low';
}
