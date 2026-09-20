import { beforeEach, describe, expect, it } from 'vitest';
import { idb, wipeLocalDatabase } from '@/lib/idb';
import { LocalBackend, sanitizePeaks, sortTracks } from '@/lib/backend/local';
import type { Track } from '@shared/types';

const ARTIST_CODE = '00112233';

function makeBackend() {
  return new LocalBackend();
}

function audioFile(name = 'midnight.mp3', bytes = 4096): File {
  return new File([new Uint8Array(bytes)], name, { type: name.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg' });
}

async function publishDemoTrack(artist: LocalBackend, title = 'Midnight', artistName = 'Daniel') {
  return (
    await artist.publish({
      title,
      artistName,
      file: audioFile(),
      waveform: [0.2, 0.8, 0.5, 1],
      duration: 102.4,
    })
  ).track;
}

beforeEach(async () => {
  await wipeLocalDatabase();
});

describe('local engine — sessions', () => {
  it('rejects the wrong artist code and accepts the shared one', async () => {
    const backend = makeBackend();
    await expect(backend.loginArtist('12345678')).rejects.toMatchObject({ status: 401, code: 'INVALID_CODE' });

    const ok = await backend.loginArtist(ARTIST_CODE);
    expect(ok.user.role).toBe('artist');
    expect(ok.token).toBeTypeOf('string');
    backend.setToken(ok.token);
    await expect(backend.me()).resolves.toMatchObject({ user: { id: ok.user.id } });
  });

  it('returns the same artist identity for a known device key', async () => {
    const backend = makeBackend();
    const first = await backend.loginArtist(ARTIST_CODE);
    const second = await makeBackend().loginArtist(ARTIST_CODE, first.artistKey);
    expect(second.user.id).toBe(first.user.id);
  });

  it('restores a guest on reload without asking for anything', async () => {
    const created = await makeBackend().createGuest('Daniel');
    const revived = makeBackend();
    revived.setToken(created.token);
    await expect(revived.me()).resolves.toMatchObject({ user: { name: 'Daniel', role: 'guest' } });
  });

  it('locks after repeated wrong codes', async () => {
    const backend = makeBackend();
    for (let i = 0; i < 5; i += 1) {
      await expect(backend.loginArtist('00000000')).rejects.toMatchObject({ code: 'INVALID_CODE' });
    }
    await expect(backend.loginArtist(ARTIST_CODE)).rejects.toMatchObject({ code: 'TOO_MANY_ATTEMPTS' });
  });
});

describe('local engine — publishing', () => {
  it('stores the file, the measured duration and the waveform peaks', async () => {
    const artist = makeBackend();
    artist.setToken((await artist.loginArtist(ARTIST_CODE)).token);

    const track = await publishDemoTrack(artist);
    expect(track.title).toBe('Midnight');
    expect(track.duration).toBeCloseTo(102.4, 1);
    expect(track.waveform).toEqual([0.2, 0.8, 0.5, 1]);
    expect(track.rating.count).toBe(0);
    expect(track.isMine).toBe(true);

    const blob = await idb.get<{ blob: Blob }>('audio', track.id);
    expect(blob?.blob.size).toBe(4096);
  });

  it('refuses non-audio files and empty fields', async () => {
    const artist = makeBackend();
    artist.setToken((await artist.loginArtist(ARTIST_CODE)).token);
    await expect(
      artist.publish({ title: 'x', artistName: 'y', file: audioFile('notes.txt'), waveform: null, duration: 1 }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_FORMAT' });
    await expect(
      artist.publish({ title: '  ', artistName: 'y', file: audioFile(), waveform: null, duration: 1 }),
    ).rejects.toMatchObject({ code: 'INVALID_TITLE' });
  });

  it('rejects uploads from a guest session', async () => {
    const guest = makeBackend();
    guest.setToken((await guest.createGuest('Daniel')).token);
    await expect(
      guest.publish({ title: 'a', artistName: 'b', file: audioFile(), waveform: null, duration: 1 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('local engine — public ratings', () => {
  it('averages per component and derives the total from the raw rows', async () => {
    const artist = makeBackend();
    artist.setToken((await artist.loginArtist(ARTIST_CODE)).token);
    const track = await publishDemoTrack(artist);

    const g1 = makeBackend();
    g1.setToken((await g1.createGuest('One')).token);
    const after1 = (await g1.rateTrack(track.id, { quality: 27, listenability: 29, personal: 28 })).track;
    expect(after1.rating).toEqual({ count: 1, quality: 27, listenability: 29, personal: 28, total: 84 });

    const g2 = makeBackend();
    g2.setToken((await g2.createGuest('Two')).token);
    const after2 = (await g2.rateTrack(track.id, { quality: 30, listenability: 30, personal: 30 })).track;
    expect(after2.rating).toEqual({ count: 2, quality: 28.5, listenability: 29.5, personal: 29, total: 87 });
    // the community number and the visitor's own number side by side
    expect(after2.myRating?.total).toBe(90);
  });

  it('keeps one rating per guest: resubmitting edits, never adds', async () => {
    const artist = makeBackend();
    artist.setToken((await artist.loginArtist(ARTIST_CODE)).token);
    const track = await publishDemoTrack(artist);

    const guest = makeBackend();
    guest.setToken((await guest.createGuest('Solo')).token);
    await guest.rateTrack(track.id, { quality: 10, listenability: 10, personal: 10 });
    const updated = (await guest.rateTrack(track.id, { quality: 20, listenability: 20, personal: 20 })).track;

    expect(updated.rating.count).toBe(1);
    expect(updated.rating.total).toBe(60);
    expect(await idb.count('ratings')).toBe(1);
  });

  it('recomputes for everyone else without a reload', async () => {
    const artist = makeBackend();
    artist.setToken((await artist.loginArtist(ARTIST_CODE)).token);
    const track = await publishDemoTrack(artist);

    const guest = makeBackend();
    guest.setToken((await guest.createGuest('Reader')).token);
    await guest.rateTrack(track.id, { quality: 30, listenability: 30, personal: 30 });

    const studio = await artist.myTracks();
    expect(studio.tracks[0]?.rating.total).toBe(90);
    expect((await artist.overview()).overview).toMatchObject({ tracks: 1, ratings: 1, averageScore: 90 });
  });

  it('validates the 0..30 integer range and blocks artists from voting', async () => {
    const artist = makeBackend();
    artist.setToken((await artist.loginArtist(ARTIST_CODE)).token);
    const track = await publishDemoTrack(artist);

    const guest = makeBackend();
    guest.setToken((await guest.createGuest('Wild')).token);
    await expect(guest.rateTrack(track.id, { quality: 31, listenability: 0, personal: 0 })).rejects.toMatchObject({
      code: 'INVALID_RATING',
    });
    await expect(guest.rateTrack(track.id, { quality: 1.5, listenability: 0, personal: 0 })).rejects.toMatchObject({
      code: 'INVALID_RATING',
    });
    await expect(artist.rateTrack(track.id, { quality: 30, listenability: 30, personal: 30 })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('local engine — plays', () => {
  it('counts a play once per window and exposes the number', async () => {
    const artist = makeBackend();
    artist.setToken((await artist.loginArtist(ARTIST_CODE)).token);
    const track = await publishDemoTrack(artist);

    const guest = makeBackend();
    guest.setToken((await guest.createGuest('Listener')).token);
    expect(await guest.recordPlay(track.id)).toMatchObject({ counted: true });
    expect(await guest.recordPlay(track.id)).toMatchObject({ counted: false });

    const fresh = await guest.getTrack(track.id);
    expect(fresh.track.plays).toBe(1);
  });
});

describe('local engine — deletion', () => {
  it('lets only the owner delete, and removes everything with the track', async () => {
    const owner = makeBackend();
    owner.setToken((await owner.loginArtist(ARTIST_CODE)).token);
    const track = await publishDemoTrack(owner);

    const other = makeBackend();
    other.setToken((await other.loginArtist(ARTIST_CODE)).token); // brand new identity, same code
    await expect(other.deleteTrack(track.id)).rejects.toMatchObject({ code: 'NOT_OWNER' });

    const guest = makeBackend();
    guest.setToken((await guest.createGuest('Curious')).token);
    await expect(guest.deleteTrack(track.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await owner.deleteTrack(track.id);

    expect((await owner.myTracks()).tracks).toHaveLength(0);
    expect((await guest.listTracks({ sort: 'new' })).tracks).toHaveLength(0);
    await expect(guest.getTrack(track.id)).rejects.toMatchObject({ code: 'TRACK_DELETED', status: 410 });
    await expect(guest.recordPlay(track.id)).rejects.toMatchObject({ code: 'TRACK_DELETED' });
    await expect(guest.resolveAudioUrl({ ...track, audioUrl: `local:${track.id}` } as Track)).rejects.toMatchObject({
      code: 'TRACK_DELETED',
    });

    // ratings, plays and audio bytes are gone, not just hidden
    expect(await idb.count('ratings')).toBe(0);
    expect(await idb.count('plays')).toBe(0);
    expect(await idb.get('audio', track.id)).toBeUndefined();
  });

  it('stays deleted after an app reload', async () => {
    const owner = makeBackend();
    const session = await owner.loginArtist(ARTIST_CODE);
    owner.setToken(session.token);
    const track = await publishDemoTrack(owner);
    await owner.deleteTrack(track.id);

    const reloaded = makeBackend();
    reloaded.setToken(session.token);
    expect((await reloaded.myTracks()).tracks).toHaveLength(0);
    await expect(reloaded.getTrack(track.id)).rejects.toMatchObject({ code: 'TRACK_DELETED' });
  });
});

describe('local engine — feed helpers', () => {
  it('sorts the feed and searches by title or artist', async () => {
    const artist = makeBackend();
    artist.setToken((await artist.loginArtist(ARTIST_CODE)).token);
    const first = await publishDemoTrack(artist, 'Alpha', 'One');
    const second = await publishDemoTrack(artist, 'Beta', 'Two');
    // only guests can rate; the feed is read with a guest session
    const guest = makeBackend();
    guest.setToken((await guest.createGuest('Sorter')).token);
    await guest.rateTrack(second.id, { quality: 30, listenability: 30, personal: 30 });

    const top = await guest.listTracks({ sort: 'top' });
    expect(top.tracks.map((t) => t.id)).toEqual([second.id, first.id]);

    const search = await guest.listTracks({ sort: 'new', query: 'bet' });
    expect(search.tracks.map((t) => t.title)).toEqual(['Beta']);
  });

  it('keeps peaks bounded and falls back when the browser could not decode', () => {
    expect(sanitizePeaks([5, -1, Number.NaN, 0.5])).toEqual([1, 0.02, 0.1, 0.5]);
    expect(sanitizePeaks(null).length).toBeGreaterThan(8);
    expect(sortTracks([], 'top')).toEqual([]);
  });
});
