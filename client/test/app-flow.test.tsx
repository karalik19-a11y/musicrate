// @vitest-environment happy-dom
/**
 * End-to-end run of the whole product on the *static* build: the same code path
 * GitHub Pages serves, with the on-device engine as the database.
 *
 * Artist code → publish a real MP3 → it survives a reload → a new guest sees
 * and rates it → the public score updates everywhere → the owner deletes it and
 * nothing (ratings, plays, bytes, links) is left behind.
 */
import './setup-dom';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '@/App';
import { idb, wipeLocalDatabase } from '@/lib/idb';

const WAIT = { timeout: 8000, interval: 25 };
const text = (): string => document.body.textContent ?? '';

async function see(pattern: RegExp, label = pattern.source): Promise<void> {
  await waitFor(() => {
    if (!pattern.test(text())) throw new Error(`never appeared: ${label} :: ${text().slice(0, 260)}`);
  }, WAIT);
}

function allButtons(match: RegExp): HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].filter((b) => match.test(b.textContent ?? ''));
}

async function press(match: RegExp, options: { last?: boolean } = {}): Promise<void> {
  await waitFor(() => {
    const found = allButtons(match);
    if (found.length === 0) throw new Error(`no button ${match} :: ${text().slice(0, 200)}`);
  }, WAIT);
  const found = allButtons(match);
  const target = options.last ? found[found.length - 1] : found[0];
  await act(async () => {
    fireEvent.click(target!);
  });
}

async function pressSelector(selector: string): Promise<void> {
  await waitFor(() => {
    if (!document.querySelector(selector)) throw new Error(`no element ${selector}`);
  }, WAIT);
  await act(async () => {
    fireEvent.click(document.querySelector(selector)!);
  });
}

function fill(selector: string, value: string): void {
  const input = document.querySelector(selector) as HTMLInputElement | null;
  if (!input) throw new Error(`no input ${selector}`);
  fireEvent.change(input, { target: { value } });
}

async function goto(hash: string): Promise<void> {
  await act(async () => {
    window.location.hash = hash;
    // react-router's hash history reacts to popstate, not to a manual hashchange
    window.dispatchEvent(new PopStateEvent('popstate'));
    await new Promise((resolve) => setTimeout(resolve, 60));
  });
}

async function trackId(): Promise<string> {
  const rows = await idb.all<{ id: string }>('tracks');
  const live = rows.find((r) => !('deletedAt' in r && r.deletedAt));
  if (!live) throw new Error('no track in the vault');
  return live.id;
}

describe('MUSICRATE on a static host', () => {
  beforeEach(async () => {
    window.location.hash = '';
    await wipeLocalDatabase();
    localStorage.clear();
  });

  it('walks the full artist → guest → rating → delete journey', async () => {
    let id = '';
    const view = render(createElement(App));

    /* ---------------- start screen ---------------- */
    await see(/Your sound\. Your space\./);

    /* ---------------- artist access ---------------- */
    await press(/Я артист/);
    await see(/ARTIST ACCESS/);
    fill('[aria-label="Пароль"]', '12345678');
    await press(/Войти/);
    await see(/Неверный код доступа/);

    fill('[aria-label="Пароль"]', '00112233');
    await press(/Войти/);
    await see(/STUDIO/);
    await see(/Your sound starts here\./);

    /* ---------------- publish a track ---------------- */
    await press(/Upload track/);
    await see(/NEW TRACK/);
    fill('input[name="title"]', 'Midnight');
    fill('input[name="artistName"]', 'Daniel');

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array(2048)], 'midnight.mp3', { type: 'audio/mpeg' });
    await act(async () => {
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
      fireEvent.change(fileInput, { target: { files: [file] } });
    });
    await see(/midnight\.mp3/);

    await press(/Опубликовать/);
    await see(/TRACK LIVE/);
    id = await trackId();

    /* ---------------- reopen the app: session + data survive ---------------- */
    await goto('/');
    view.unmount();
    render(createElement(App));
    await see(/STUDIO/, 'auto sign-in into the studio');
    await see(/Midnight/);
    expect(await idb.count('audio')).toBe(1);

    /* ---------------- a brand new guest hears it ---------------- */
    await goto('/studio/profile');
    await see(/Выйти/);
    await press(/Выйти/);
    await press(/Выйти/, { last: true });
    await see(/Your sound\. Your space\./, 'back to the start screen');

    await press(/Я гость/);
    await press(/Новый гость/);
    await see(/Как тебя зовут\?/);
    fill('input[name="name"]', 'Daniel');
    await press(/Поехали/);
    await see(/HOME/);
    await see(/Midnight/);

    /* ---------------- play it ---------------- */
    await goto(`/track/${id}`);
    await see(/MIDNIGHT/i);
    await pressSelector('[aria-label="Играть"]');
    await waitFor(async () => {
      expect(await idb.count('plays')).toBeGreaterThan(0);
    }, WAIT);

    /* ---------------- rate it 27 + 29 + 28 → 84 / 90 ---------------- */
    await press(/Оценить/);
    const sliders = await waitFor(() => {
      const found = [...document.querySelectorAll<HTMLInputElement>('input[type="range"]')];
      if (found.length < 3) throw new Error('rating sheet not ready');
      return found;
    }, WAIT);
    await act(async () => {
      fireEvent.change(sliders[0]!, { target: { value: '27' } });
      fireEvent.change(sliders[1]!, { target: { value: '29' } });
      fireEvent.change(sliders[2]!, { target: { value: '28' } });
    });
    await press(/Отправить/);
    await see(/84/);
    await see(/1 оценка/i);
    expect((await idb.all<{ quality: number }>('ratings'))[0]?.quality).toBe(27);

    /* ---------------- the artist deletes it ---------------- */
    await goto('/profile'); // guest profile
    await see(/Сменить пользователя/);
    await press(/Сменить пользователя/);
    await press(/Сменить/, { last: true });
    await see(/Гость|LISTENER|Новый гость/i, 'guest entry screen');
    await goto('/');
    await see(/Your sound\. Your space\./);

    await press(/Я артист/);
    fill('[aria-label="Пароль"]', '00112233');
    await press(/Войти/);
    await see(/STUDIO/);
    await goto('/studio/tracks');
    await see(/Midnight/);
    await see(/84/); // the artist reads the same public score the guests do

    await pressSelector('[aria-label="Действия"]');
    await press(/Удалить/); // menu item
    await see(/Трек будет удалён из приложения/); // the menu closes, then the sheet slides in
    await press(/Удалить/, { last: true });
    await see(/TRACK DELETED/i);
    await see(/Your sound starts here\./);

    /* ---------------- nothing is left behind ---------------- */
    expect(await idb.count('audio')).toBe(0);
    expect(await idb.count('ratings')).toBe(0);
    expect(await idb.count('plays')).toBe(0);

    await goto('/');
    await goto(`/track/${id}`);
    await see(/не найден|удал|TRACK/i, 'the dead link explains itself');
  }, 60_000);
});
