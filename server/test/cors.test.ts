import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestEnv, makeWav, type TestEnv } from './helpers.js';

/**
 * The static GitHub Pages build is a different origin from the API, so the API
 * has to answer preflights and let a media element read a stream. Without these
 * headers "Pages shell + own backend" fails at the first Range request.
 */
describe('CORS for cross-origin clients', () => {
  let env: TestEnv;

  beforeAll(async () => {
    env = await createTestEnv({ allowedOrigins: ['https://karalik19-a11y.github.io'] });
  });
  afterAll(() => env.cleanup());

  const origin = 'https://karalik19-a11y.github.io';

  it('answers the preflight a browser sends before a rated PUT', async () => {
    const res = await request(env.app)
      .options('/api/tracks/whatever/rating')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'PUT')
      .set('Access-Control-Request-Headers', 'authorization,content-type');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
    expect(res.headers['access-control-allow-methods']).toContain('PUT');
    expect(res.headers['access-control-allow-headers']).toContain('Range');
  });

  it('marks the audio stream readable and exposes range metadata', async () => {
    const guest = await request(env.app).post('/api/auth/guest').send({ name: 'CORS' });
    const token = guest.body.token as string;
    const artist = await request(env.app).post('/api/auth/artist').send({ password: '00112233' });

    const published = await request(env.app)
      .post('/api/tracks')
      .set('Authorization', `Bearer ${artist.body.token}`)
      .field('title', 'Range test')
      .field('artistName', 'CORS')
      .attach('audio', makeWav(1), 'range.wav');
    const id = published.body.track.id as string;

    const stream = await request(env.app).get(`/api/tracks/${id}/audio`).set('Origin', origin).set('Range', 'bytes=0-15');
    expect(stream.status).toBe(206);
    expect(stream.headers['access-control-allow-origin']).toBe(origin);
    expect(stream.headers['accept-ranges']).toBe('bytes');
    expect(stream.headers['content-range']).toContain('bytes 0-15/');

    const play = await request(env.app).post(`/api/tracks/${id}/play`).set('Origin', origin).set('Authorization', `Bearer ${token}`);
    expect(play.status).toBe(200);
    expect(play.body.counted).toBe(true);
  });

  it('does not widen access for origins that are not allowed', async () => {
    const res = await request(env.app).get('/api/health').set('Origin', 'https://evil.example');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('still serves the SPA itself without CORS headers on static files', async () => {
    const res = await request(env.app).get('/api/health');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
