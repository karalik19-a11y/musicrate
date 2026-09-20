import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Track } from '@shared/types';
import { api, auth, createTestEnv, makeWav, type TestEnv } from './helpers.js';
import { TelegramBot } from '../src/telegram/bot.js';
import {
  appButtonUrl,
  formatDuration,
  helpMessage,
  newTrackMessage,
  trackButtonUrl,
  welcomeMessage,
} from '../src/telegram/messages.js';

/* ---------------------------- pure formatting ---------------------------- */

describe('telegram message texts', () => {
  it('greets a known user by first name and explains the subscription', () => {
    const text = welcomeMessage('Daniel');
    expect(text).toContain('Привет, Daniel!');
    expect(text).toContain('/stop');
  });

  it('greets an anonymous user without a dangling comma', () => {
    expect(welcomeMessage()).not.toContain('Привет,');
    expect(welcomeMessage(undefined)).toContain('Привет!');
  });

  it('announces a new track with title, artist and duration', () => {
    const track = {
      title: 'Midnight',
      artistName: 'Daniel',
      duration: 182.4,
    } as Track;
    const text = newTrackMessage(track);
    expect(text).toContain('«Midnight» — Daniel');
    expect(text).toContain('⏱ 3:02');
    expect(text).toContain('0 до 90');
  });

  it('omits the duration line for zero-length tracks', () => {
    expect(newTrackMessage({ title: 'T', artistName: 'A', duration: 0 } as Track)).not.toContain('⏱');
  });

  it('formats durations like the client does', () => {
    expect(formatDuration(0)).toBe('');
    expect(formatDuration(61)).toBe('1:01');
    expect(formatDuration(3_723)).toBe('1:02:03');
  });

  it('builds deep links into the mini app for any webapp URL shape', () => {
    expect(trackButtonUrl('https://example.com/musicrate/', 'abc123')).toBe('https://example.com/musicrate/#/track/abc123');
    expect(trackButtonUrl('https://example.com', 'abc123')).toBe('https://example.com/#/track/abc123');
    expect(trackButtonUrl('https://example.com/app//', 'x')).toBe('https://example.com/app/#/track/x');
  });

  it('keeps the app button URL as configured', () => {
    expect(appButtonUrl('https://example.com/musicrate/')).toBe('https://example.com/musicrate/');
  });

  it('help text mentions both commands', () => {
    const text = helpMessage();
    expect(text).toContain('/start');
    expect(text).toContain('/stop');
  });
});

/* --------------------------- subscriber storage --------------------------- */

describe('telegram subscribers repo', () => {
  let env: TestEnv;

  beforeAll(async () => {
    env = await createTestEnv();
  });
  afterAll(() => env.cleanup());

  it('subscribes, lists and unsubscribes chats', async () => {
    await env.ctx.telegram.subscribe(100, { firstName: 'Daniel', username: 'dan' });
    await env.ctx.telegram.subscribe(200, { username: 'mira' });
    expect(await env.ctx.telegram.listChatIds()).toEqual([100, 200]);
    expect(await env.ctx.telegram.count()).toBe(2);

    expect(await env.ctx.telegram.unsubscribe(100)).toBe(true);
    expect(await env.ctx.telegram.unsubscribe(100)).toBe(false);
    expect(await env.ctx.telegram.listChatIds()).toEqual([200]);
  });

  it('re-subscribing the same chat refreshes the profile instead of duplicating', async () => {
    await env.ctx.telegram.subscribe(300, { firstName: 'Old' });
    await env.ctx.telegram.subscribe(300, { firstName: 'New', username: 'new' });
    expect(await env.ctx.telegram.count()).toBe(2); // 200 + 300, no duplicate row
  });
});

/* ----------------------- publish → notification wiring ----------------------- */

describe('publishing a track notifies subscribers', () => {
  it('fires the notifier once with the published track', async () => {
    const notifyNewTrack = vi.fn().mockResolvedValue(undefined);
    const env = await createTestEnv({}, { notifier: { notifyNewTrack } });
    try {
      const login = await api(env.app).post('/api/auth/artist').send({ password: '00112233' });
      expect(login.status).toBe(200);

      const res = await api(env.app)
        .post('/api/tracks')
        .set(auth(login.body.token))
        .field('title', 'Notify Me')
        .field('artistName', 'Daniel')
        .attach('audio', makeWav(1), 'notify.wav');
      expect(res.status).toBe(201);

      await vi.waitFor(() => expect(notifyNewTrack).toHaveBeenCalledTimes(1));
      const call = notifyNewTrack.mock.calls[0] as [Track];
      expect(call[0].id).toBe(res.body.track.id);
      expect(call[0].title).toBe('Notify Me');
      expect(trackButtonUrl('https://example.com/musicrate/', call[0].id)).toContain(call[0].id);
    } finally {
      env.cleanup();
    }
  });

  it('publishing without a configured notifier still succeeds', async () => {
    const env = await createTestEnv(); // no token, no injected notifier
    try {
      const login = await api(env.app).post('/api/auth/artist').send({ password: '00112233' });
      const res = await api(env.app)
        .post('/api/tracks')
        .set(auth(login.body.token))
        .field('title', 'Silent Drop')
        .field('artistName', 'Daniel')
        .attach('audio', makeWav(1), 'silent.wav');
      expect(res.status).toBe(201);
      expect(env.ctx.notifier).toBeNull();
    } finally {
      env.cleanup();
    }
  });
});

/* ------------------- live bot against a mocked Bot API ------------------- */

interface MockCall {
  method: string;
  payload: Record<string, any>;
}

/** A stand-in api.telegram.org: records calls, feeds queued updates. */
function startMockTelegram() {
  const calls: MockCall[] = [];
  const updates: Record<string, any>[] = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const method = req.url!.split('/').pop()!;
      const payload = body ? JSON.parse(body) : {};
      calls.push({ method, payload });
      const reply = (result: unknown) => {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ ok: true, result }));
      };
      if (method === 'getMe') {
        reply({ id: 1, is_bot: true, username: 'musicrate_test_bot' });
      } else if (method === 'getUpdates') {
        // Simulate a long poll: hand over whatever is queued, after a pause.
        setTimeout(() => reply(updates.splice(0)), 20);
      } else if (method === 'sendMessage') {
        reply({ message_id: calls.length });
      } else {
        reply(true);
      }
    });
  });
  return { calls, push: (update: Record<string, any>) => void updates.push(update), server };
}

describe('TelegramBot against a mocked Bot API', () => {
  let env: TestEnv;
  let bot: TelegramBot;
  let mock: ReturnType<typeof startMockTelegram>;

  beforeAll(async () => {
    env = await createTestEnv();
  });
  afterAll(async () => {
    await bot?.stop();
    await new Promise<void>((resolve) => {
      mock.server.closeAllConnections();
      mock.server.close(() => resolve());
    });
    env.cleanup();
  });

  const sentTo = (chatId: number) => mock.calls.filter((c) => c.method === 'sendMessage' && c.payload.chat_id === chatId);

  it('boots, handles /start, announces tracks, and honours blocks', async () => {
    const wrap = startMockTelegram();
    await new Promise<void>((resolve) => wrap.server.listen(0, '127.0.0.1', resolve));
    const port = (wrap.server.address() as AddressInfo).port;
    mock = { calls: wrap.calls, push: wrap.push, server: wrap.server };

    bot = new TelegramBot({
      token: 'TEST:TOKEN',
      webappUrl: 'https://example.com/musicrate/',
      apiUrl: `http://127.0.0.1:${port}`,
      repo: env.ctx.telegram,
    });
    await bot.start();
    expect(mock.calls.some((c) => c.method === 'getMe')).toBe(true);
    expect(mock.calls.some((c) => c.method === 'deleteWebhook')).toBe(true);
    expect(mock.calls.some((c) => c.method === 'setChatMenuButton')).toBe(true);

    // A user presses Start in a private chat → subscribed + welcome with the app button.
    mock.push({
      update_id: 100,
      message: {
        message_id: 1,
        chat: { id: 4242, type: 'private' },
        from: { id: 4242, is_bot: false, first_name: 'Mira', username: 'mira' },
        text: '/start',
      },
    });
    await vi.waitFor(() => expect(sentTo(4242).length).toBeGreaterThan(0));
    expect(await env.ctx.telegram.listChatIds()).toEqual([4242]);
    const welcome = sentTo(4242)[0]?.payload ?? {};
    expect(welcome.text).toContain('Привет, Mira!');
    expect(welcome.reply_markup.inline_keyboard[0][0].web_app.url).toBe('https://example.com/musicrate/');

    // A track is published → every subscriber gets the announcement with a
    // deep link straight to the track.
    await bot.notifyNewTrack({ id: 'track_xyz', title: 'Drop', artistName: 'Mira', duration: 61 } as Track);
    await vi.waitFor(() => expect(sentTo(4242).length).toBeGreaterThan(1));
    const announce = sentTo(4242).at(-1)!.payload;
    expect(announce.text).toContain('«Drop» — Mira');
    expect(announce.text).toContain('⏱ 1:01');
    expect(announce.reply_markup.inline_keyboard[0][0].web_app.url).toBe(
      'https://example.com/musicrate/#/track/track_xyz',
    );

    // Blocking the bot (my_chat_member → kicked) silently unsubscribes.
    mock.push({
      update_id: 101,
      my_chat_member: {
        chat: { id: 4242, type: 'private' },
        from: { id: 4242, is_bot: false, first_name: 'Mira' },
        new_chat_member: { status: 'kicked' },
      },
    });
    await vi.waitFor(() => expect(env.ctx.telegram.listChatIds()).resolves.toEqual([]));

    // A queued update is never processed twice (offset advanced past it).
    await bot.notifyNewTrack({ id: 'track_2', title: 'Nope', artistName: 'X', duration: 0 } as Track);
    await vi.waitFor(() => expect(mock.calls.filter((c) => c.method === 'getUpdates').length).toBeGreaterThan(2));
    expect(sentTo(4242).length).toBe(2); // nothing new was sent to the unsubscribed chat
  });
});
