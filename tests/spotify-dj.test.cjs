/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { NextRequest } = require('next/server');

function load(file, mocks = {}) {
  const filename = resolve(file);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = module.paths;
  mod.require = name => name === 'server-only' ? {} : name in mocks ? mocks[name] : require(name);
  mod._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, filename);
  return mod.exports;
}
const dj = load('src/lib/spotify/dj.ts');
const track = (id, bpm) => ({ id, uri: `spotify:track:${id}`, name: id, artists: [], duration_ms: 240000, bpm, fetchedAt: Date.now(), provider: 'reccobeats', lookupStatus: bpm ? 'matched' : 'missing' });
const state = (id, progress_ms, extra = {}) => ({ item: track(id, 120), progress_ms, is_playing: true, device: { id: 'device' }, repeat_state: 'off', shuffle_state: false, ...extra });

test('direct nearest BPM, history relaxation, stable ties and unknown tracks', () => {
  const tracks = [track('a', 128), track('b', 140), track('c', 145), track('d', 162), track('x', null)];
  assert.equal(dj.chooseTrack(tracks, 143, 'a', []).id, 'c');
  assert.equal(dj.chooseTrack(tracks, 143, 'a', ['c']).id, 'b');
  assert.equal(dj.chooseTrack(tracks, 143, 'a', ['b', 'c', 'd']).id, 'c');
  assert.equal(dj.chooseTrack([track('a', 71.5), track('b', 140)], 143, '', []).id, 'b');
  assert.equal(dj.chooseTrack([track('b', 142), track('a', 144)], 143, '', []).id, 'a');
  assert.equal(dj.chooseTrack([track('x', null), track('z', NaN)], 143, '', []), null);
});

test('heart-rate measurement decodes 8/16-bit and rejects off-body/malformed packets', () => {
  const decode = bytes => dj.parseHeartRate(new DataView(Uint8Array.from(bytes).buffer));
  assert.equal(decode([0, 143]), 143);
  assert.equal(decode([1, 4, 1]), 260);
  assert.equal(decode([6, 143]), 143);
  for (const bytes of [[], [0], [1, 10], [4, 143], [0, 0], [1, 255, 255]]) assert.equal(decode(bytes), null);
});

test('target includes only fresh samples, never old or future observations', () => {
  assert.equal(dj.targetHeartRate([{ bpm: 140, at: 6000 }, { bpm: 146, at: 10000 }, { bpm: 99, at: 4000 }, { bpm: 99, at: 11000 }], 10000), 143);
  assert.equal(dj.targetHeartRate([{ bpm: 140, at: 1 }], 10000), null);
});

test('decision at 3:45 is committed once, survives pauses/seeks, and resets on next song', () => {
  const clock = new dj.DecisionClock();
  assert.equal(clock.update(state('a', 224000)), false);
  assert.equal(clock.update(state('a', 225000, { is_playing: false })), false);
  assert.equal(clock.update(state('a', 225000)), true);
  clock.commit();
  assert.equal(clock.update(state('a', 230000)), false);
  assert.equal(clock.update(state('a', 10000)), false);
  assert.equal(clock.update(state('a', 226000)), false);
  assert.equal(clock.update(state('b', 225000)), true);
  clock.commit();
  assert.equal(clock.update(state('a', 225000)), true);
});

test('late seek triggers once and ended tracks do not trigger', () => {
  const clock = new dj.DecisionClock();
  assert.equal(clock.update(state('a', 238000)), true);
  assert.equal(clock.update(state('b', 240000)), false);
});

class ApiError extends Error { constructor(message, status = 502, retryAfter) { super(message); this.status = status; this.retryAfter = retryAfter; } }
function routeWith({ session = { accessToken: 'test', refreshToken: 'refresh', expiresAt: Date.now() + 3600000 }, call = async () => null, cookie = 'expected', tokenCall = async () => session } = {}) {
  return load('src/app/api/spotify/[action]/route.ts', {
    'next/headers': { cookies: async () => ({ get: () => ({ value: cookie }) }) },
    '@/lib/spotify/server': {
      ApiError, config: () => ({ clientId: 'id', redirectUri: 'https://app.test/api/spotify/callback' }),
      cookieOptions: { httpOnly: true, sameSite: 'lax', path: '/' },
      readSession: async () => session, SCOPES: 'user-library-read', seal: () => 'sealed', SESSION: 'session', STATE: 'state', spotify: call, token: tokenCall,
    },
    '@/lib/spotify/reccobeats': { lookupBpm: async () => 143 },
  });
}
const id = '0VjIjW4GlUZAMYd2vXMi3b';
const nextId = '11dFghVXANMlKmJXsNCbNl';
function request(action, body, origin = 'https://app.test') {
  return new NextRequest(`https://app.test/api/spotify/${action}`, body === undefined ? {} : { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
const context = action => ({ params: Promise.resolve({ action }) });

test('OAuth state mismatch never exchanges authorization code', async () => {
  const route = routeWith({ tokenCall: () => assert.fail('unexpected token exchange') });
  const response = await route.GET(request('callback?state=wrong&code=secret'), context('callback'));
  assert.match(response.headers.get('location'), /spotify_error/);
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
});

test('OAuth success seals token and returns to music', async () => {
  const response = await routeWith().GET(request('callback?state=expected&code=secret'), context('callback'));
  assert.equal(response.headers.get('location'), 'https://app.test/whoop/music');
  assert.match(response.headers.get('set-cookie'), /session=sealed/);
});

test('rejects unauthenticated BPM lookup and cross-origin playback', async () => {
  const response = await routeWith({ session: null }).GET(request(`bpm?id=${id}`), context('bpm'));
  assert.equal(response.status, 401);
  const forbidden = await routeWith({ call: () => assert.fail('no upstream request') }).POST(request('play', { id }, 'https://evil.test'), context('play'));
  assert.equal(forbidden.status, 403);
});

test('library pagination only exposes normalized next offset, filters local/unavailable records', async () => {
  const route = routeWith({ call: async (_, path) => {
    assert.equal(path, 'me/tracks?limit=50&offset=50');
    return { items: [{ track: track(id, 100) }, { track: null }, { track: { ...track(nextId, 100), is_local: true } }], next: 'https://api.spotify.com/v1/me/tracks?offset=100', total: 101 };
  } });
  const response = await route.GET(request('library?offset=50'), context('library'));
  const body = await response.json();
  assert.equal(body.nextOffset, 100);
  assert.equal(body.tracks.length, 1);
  assert.equal((await route.GET(request('library?offset=-1'), context('library'))).status, 400);
});

test('refresh cookie survives a subsequent provider error and preserves Retry-After', async () => {
  let refreshed = false;
  const route = routeWith({ session: { expiresAt: 0, refreshToken: 'refresh' }, tokenCall: async () => { refreshed = true; return { accessToken: 'new' }; }, call: async () => { throw new ApiError('Slow down', 429, '30'); } });
  const response = await route.GET(request('playback'), context('playback'));
  assert.equal(refreshed, true);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '30');
  assert.match(response.headers.get('set-cookie'), /session=sealed/);
});

test('queue verifies expected current song, refuses conflict, and does not mutate', async () => {
  let mutations = 0;
  const route = routeWith({ call: async (_, path, method) => {
    if (method === 'POST') mutations++;
    return path === 'me/player' ? state(id, 225000) : { queue: [track('other', 100)] };
  } });
  const response = await route.POST(request('queue', { id: nextId, currentId: id, deviceId: 'device' }), context('queue'));
  assert.equal(response.status, 409);
  assert.equal(mutations, 0);
});

test('queues once and verifies first queued track', async () => {
  let reads = 0, writes = 0;
  const route = routeWith({ call: async (_, path, method) => {
    if (path === 'me/player') return state(id, 225000);
    if (method === 'POST') { writes++; assert.match(path, /device_id=device/); return null; }
    return { queue: reads++ ? [track(nextId, 143)] : [] };
  } });
  assert.equal((await route.POST(request('queue', { id: nextId, currentId: id, deviceId: 'device' }), context('queue'))).status, 200);
  assert.equal(writes, 1);
});

test('uncertain queue mutation is not retried', async () => {
  let writes = 0;
  const route = routeWith({ call: async (_, path, method) => {
    if (path === 'me/player') return state(id, 225000);
    if (method === 'POST') { writes++; throw new Error('timeout'); }
    return { queue: [] };
  } });
  assert.equal((await route.POST(request('queue', { id: nextId, currentId: id, deviceId: 'device' }), context('queue'))).status, 502);
  assert.equal(writes, 1);
});

test('BPM provider accepts exact identity and reports missing tracks', async () => {
  const previousFetch = global.fetch;
  try {
    let count = 0;
    global.fetch = async () => Response.json(count++ ? { href: `https://open.spotify.com/track/${id}`, tempo: 171.001 } : { content: [{ id: 'provider-id', href: `https://open.spotify.com/track/${id}` }] });
    const provider = load('src/lib/spotify/reccobeats.ts', { './server': { ApiError } });
    assert.equal(await provider.lookupBpm(id), 171.001);
    global.fetch = async () => Response.json({ content: [] });
    assert.equal(await provider.lookupBpm(id), null);
    global.fetch = async () => Response.json({ content: [{ id: 'wrong', href: `https://open.spotify.com/track/${nextId}` }] });
    assert.equal(await provider.lookupBpm(id), null);
  } finally { global.fetch = previousFetch; }
});

test('cache is account-isolated, expires and removes data on disconnect', () => {
  const storage = new Map();
  global.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  const cache = load('src/lib/spotify/cache.ts');
  cache.saveCache('alice', [track(id, 143)]);
  assert.equal(cache.readCache('alice').length, 1);
  assert.equal(cache.readCache('bob').length, 0);
  cache.saveCache('bob', [{ ...track(id, 100), fetchedAt: Date.now() - cache.CACHE_TTL - 1 }]);
  assert.equal(cache.readCache('bob').length, 0);
  cache.clearCache('alice');
  assert.equal(cache.readCache('alice').length, 0);
  delete global.localStorage;
});

test('playlist listing paginates and identifies importable sources', async () => {
  const route = routeWith({ call: async (_, path) => {
    if (path === 'me') return { id: 'alice' };
    assert.equal(path, 'me/playlists?limit=50&offset=50');
    return { items: [null, { id, name: 'Mine', owner: { id: 'alice' } }, { id: nextId, name: 'Followed', owner: { id: 'bob' } }], next: 'next' };
  } });
  const response = await route.GET(request('playlists?offset=50'), context('playlists'));
  const body = await response.json();
  assert.equal(body.nextOffset, 100);
  assert.deepEqual(body.playlists.map(p => p.importable), [true, false]);
  assert.equal((await route.GET(request('playlists?offset=-1'), context('playlists'))).status, 400);
});

test('playlist import uses current endpoint and skips episodes, local and unavailable items', async () => {
  const route = routeWith({ call: async (_, path) => {
    assert.equal(path, `playlists/${id}/items?limit=50&offset=50`);
    return { items: [
      { item: { ...track(id, 120), type: 'track' } },
      { track: track(nextId, 130) },
      { item: null },
      { item: { ...track(id, 120), type: 'episode' } },
      { item: { ...track(id, 120), is_local: true } },
      { item: { ...track(id, 120), is_playable: false } },
    ], next: 'next', total: 101 };
  } });
  const body = await (await route.GET(request(`playlist-tracks?id=${id}&offset=50`), context('playlist-tracks'))).json();
  assert.deepEqual(body.tracks.map(t => t.id), [id, nextId]);
  assert.equal(body.nextOffset, 100);
  assert.equal((await route.GET(request('playlist-tracks?id=invalid'), context('playlist-tracks'))).status, 400);
});

test('OAuth cancellation and failed exchange return to music with cleared state', async () => {
  for (const query of ['state=expected&error=access_denied', 'state=expected&code=expired', 'state=éééé&code=secret']) {
    const route = routeWith({ tokenCall: async () => { throw new ApiError('Expired', 401); } });
    const response = await route.GET(request(`callback?${query}`), context('callback'));
    assert.equal(response.status, 307);
    assert.match(response.headers.get('location'), /whoop\/music\?spotify_error/);
    assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
  }
});
