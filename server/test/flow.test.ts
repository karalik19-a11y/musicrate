import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Track } from '@shared/types';
import { api, auth, createTestEnv, makeWav, type TestEnv } from './helpers.js';

let env: TestEnv;

beforeAll(async () => {
  env = await createTestEnv();
});
afterAll(() => env.cleanup());

describe('MUSICRATE end-to-end API flow', () => {
  let artistToken = '';
  let artistKey = '';
  let artistId = '';
  let guest1 = '';
  let guest2 = '';
  let guest1Code = '';
  let track: Track;

  it('rejects a wrong artist code and accepts the right one', async () => {
    const bad = await api(env.app).post('/api/auth/artist').send({ password: '12345678' });
    expect(bad.status).toBe(401);
    expect(bad.body.error).toBe('INVALID_CODE');

    const ok = await api(env.app).post('/api/auth/artist').send({ password: '00112233' });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTypeOf('string');
    expect(ok.body.artistKey).toBeTypeOf('string');
    expect(ok.body.user.role).toBe('artist');
    artistToken = ok.body.token;
    artistKey = ok.body.artistKey;
    artistId = ok.body.user.id;
  });

  it('re-links a password login to the same artist identity via artistKey', async () => {
    const again = await api(env.app).post('/api/auth/artist').send({ password: '00112233', artistKey });
    expect(again.status).toBe(200);
    expect(again.body.user.id).toBe(artistId);
  });

  it('publishes a real audio file with server-measured duration', async () => {
    const res = await api(env.app)
      .post('/api/tracks')
      .set(auth(artistToken))
      .field('title', 'Midnight')
      .field('artistName', 'Daniel')
      .field('waveform', JSON.stringify(Array.from({ length: 64 }, (_, i) => (i % 7) / 7)))
      .attach('audio', makeWav(2), 'midnight.wav');
    expect(res.status).toBe(201);
    track = res.body.track;
    expect(track.title).toBe('Midnight');
    expect(track.artistName).toBe('Daniel');
    expect(track.duration).toBeGreaterThan(1.9);
    expect(track.duration).toBeLessThan(2.1);
    expect(track.waveform).toHaveLength(64);
    expect(track.rating.count).toBe(0);
    expect(track.isMine).toBe(true);
  });

  it('rejects files that are not audio', async () => {
    const res = await api(env.app)
      .post('/api/tracks')
      .set(auth(artistToken))
      .field('title', 'Fake')
      .field('artistName', 'X')
      .attach('audio', Buffer.from('definitely not audio'), 'fake.mp3');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_AUDIO');
  });

  it('registers a guest with just a name and shows the published track', async () => {
    const reg = await api(env.app).post('/api/auth/guest').send({ name: 'Daniel' });
    expect(reg.status).toBe(201);
    expect(reg.body.user.role).toBe('guest');
    expect(reg.body.user.recoveryCode).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    guest1 = reg.body.token;
    guest1Code = reg.body.user.recoveryCode;

    const list = await api(env.app).get('/api/tracks').set(auth(guest1));
    expect(list.status).toBe(200);
    expect(list.body.tracks.map((t: Track) => t.id)).toContain(track.id);
    expect(list.body.tracks[0].isMine).toBe(false);
  });

  it('streams audio with range support', async () => {
    const full = await api(env.app).get(track.audioUrl);
    expect(full.status).toBe(200);
    expect(full.headers['content-type']).toContain('audio/wav');
    expect(full.headers['accept-ranges']).toBe('bytes');

    const partial = await api(env.app).get(track.audioUrl).set('Range', 'bytes=0-99');
    expect(partial.status).toBe(206);
    expect(partial.headers['content-range']).toMatch(/^bytes 0-99\//);
  });

  it('counts plays but dedupes rapid repeats', async () => {
    const first = await api(env.app).post(`/api/tracks/${track.id}/play`).set(auth(guest1));
    expect(first.body.counted).toBe(true);
    const second = await api(env.app).post(`/api/tracks/${track.id}/play`).set(auth(guest1));
    expect(second.body.counted).toBe(false);
    const detail = await api(env.app).get(`/api/tracks/${track.id}`).set(auth(guest1));
    expect(detail.body.track.plays).toBe(1);
  });

  it('guest 1 rates 27 + 29 + 28 → public score 84 / 90 with 1 rating', async () => {
    const res = await api(env.app)
      .put(`/api/tracks/${track.id}/rating`)
      .set(auth(guest1))
      .send({ quality: 27, listenability: 29, personal: 28 });
    expect(res.status).toBe(200);
    expect(res.body.track.rating).toMatchObject({ count: 1, quality: 27, listenability: 29, personal: 28, total: 84 });
    expect(res.body.track.myRating).toMatchObject({ quality: 27, listenability: 29, personal: 28, total: 84 });
  });

  it('re-submitting by the same guest updates instead of duplicating', async () => {
    const res = await api(env.app)
      .put(`/api/tracks/${track.id}/rating`)
      .set(auth(guest1))
      .send({ quality: 30, listenability: 30, personal: 30 });
    expect(res.body.track.rating.count).toBe(1);
    expect(res.body.track.rating.total).toBe(90);
  });

  it('validates the 0..30 range and integer scores', async () => {
    const res = await api(env.app)
      .put(`/api/tracks/${track.id}/rating`)
      .set(auth(guest1))
      .send({ quality: 31, listenability: 10, personal: 10 });
    expect(res.status).toBe(400);
    const frac = await api(env.app)
      .put(`/api/tracks/${track.id}/rating`)
      .set(auth(guest1))
      .send({ quality: 10.5, listenability: 10, personal: 10 });
    expect(frac.status).toBe(400);
  });

  it('guest 2 sees the current score and their rating is averaged in', async () => {
    const reg = await api(env.app).post('/api/auth/guest').send({ name: 'Nika' });
    guest2 = reg.body.token;
    const before = await api(env.app).get(`/api/tracks/${track.id}`).set(auth(guest2));
    expect(before.body.track.rating.total).toBe(90);
    expect(before.body.track.myRating).toBeNull();

    const res = await api(env.app)
      .put(`/api/tracks/${track.id}/rating`)
      .set(auth(guest2))
      .send({ quality: 20, listenability: 20, personal: 20 });
    expect(res.body.track.rating).toMatchObject({ count: 2, quality: 25, listenability: 25, personal: 25, total: 75 });
    expect(res.body.track.myRating.total).toBe(60);
  });

  it('artists cannot rate, guests cannot publish or delete', async () => {
    const rate = await api(env.app)
      .put(`/api/tracks/${track.id}/rating`)
      .set(auth(artistToken))
      .send({ quality: 30, listenability: 30, personal: 30 });
    expect(rate.status).toBe(403);

    const publish = await api(env.app)
      .post('/api/tracks')
      .set(auth(guest1))
      .field('title', 'Nope')
      .field('artistName', 'Nope')
      .attach('audio', makeWav(1), 'nope.wav');
    expect(publish.status).toBe(403);

    const del = await api(env.app).delete(`/api/tracks/${track.id}`).set(auth(guest1));
    expect(del.status).toBe(403);
  });

  it('artist sees the live public rating in the studio', async () => {
    const mine = await api(env.app).get('/api/artist/tracks').set(auth(artistToken));
    expect(mine.status).toBe(200);
    const t = mine.body.tracks.find((x: Track) => x.id === track.id);
    expect(t.rating.total).toBe(75);
    expect(t.rating.count).toBe(2);
    expect(t.plays).toBe(1);

    const overview = await api(env.app).get('/api/artist/overview').set(auth(artistToken));
    expect(overview.body.overview).toMatchObject({ tracks: 1, plays: 1, ratings: 2, averageScore: 75 });
  });

  it('another artist cannot delete a track they do not own', async () => {
    const other = await api(env.app).post('/api/auth/artist').send({ password: '00112233' });
    expect(other.body.user.id).not.toBe(artistId);
    const del = await api(env.app).delete(`/api/tracks/${track.id}`).set(auth(other.body.token));
    expect(del.status).toBe(403);
    expect(del.body.error).toBe('NOT_OWNER');
  });

  it('the owner deletes the track and it disappears everywhere', async () => {
    const del = await api(env.app).delete(`/api/tracks/${track.id}`).set(auth(artistToken));
    expect(del.status).toBe(204);

    const list = await api(env.app).get('/api/tracks').set(auth(guest1));
    expect(list.body.tracks.map((t: Track) => t.id)).not.toContain(track.id);

    const page = await api(env.app).get(`/api/tracks/${track.id}`).set(auth(guest1));
    expect(page.status).toBe(410);
    expect(page.body.error).toBe('TRACK_DELETED');

    const audio = await api(env.app).get(track.audioUrl);
    expect(audio.status).toBe(410);

    const rate = await api(env.app)
      .put(`/api/tracks/${track.id}/rating`)
      .set(auth(guest2))
      .send({ quality: 1, listenability: 1, personal: 1 });
    expect(rate.status).toBe(410);

    const mine = await api(env.app).get('/api/artist/tracks').set(auth(artistToken));
    expect(mine.body.tracks).toHaveLength(0);

    const ratings = await env.ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM ratings WHERE track_id = ?', [
      track.id,
    ]);
    expect(Number(ratings?.n)).toBe(0);
  });

  it('restores a guest profile from its recovery code and honours logout', async () => {
    const restored = await api(env.app).post('/api/auth/guest/restore').send({ code: guest1Code.toLowerCase() });
    expect(restored.status).toBe(200);
    expect(restored.body.user.name).toBe('Daniel');

    const me = await api(env.app).get('/api/me').set(auth(guest1));
    expect(me.status).toBe(200);
    const out = await api(env.app).post('/api/auth/logout').set(auth(guest1));
    expect(out.status).toBe(204);
    const gone = await api(env.app).get('/api/me').set(auth(guest1));
    expect(gone.status).toBe(401);
  });
});
