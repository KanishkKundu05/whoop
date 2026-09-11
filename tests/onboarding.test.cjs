/* eslint-disable @typescript-eslint/no-require-imports -- Exercise TypeScript routes with isolated providers. */
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

const navigation = load('src/lib/auth/navigation.ts');
test('OAuth returns to WHOOP choices by default and rejects external return URLs', () => {
  for (const value of [null, undefined, '', 'https://evil.test', '//evil.test', '/\\evil.test', '/\n/evil.test']) {
    assert.equal(navigation.safeNextPath(value), '/whoop');
  }
  assert.equal(navigation.safeNextPath('/setup?step=recipient'), '/setup?step=recipient');
});

test('successful WHOOP OAuth returns to the feature chooser and persists the session', async () => {
  let saved = false;
  const route = load('src/app/api/auth/whoop/callback/route.ts', {
    '@/lib/auth/navigation': navigation,
    '@/lib/whoop/client': { getWhoopProfile: async () => ({ user_id: 7 }) },
    '@/lib/whoop/oauth': {
      exchangeAuthorizationCode: async () => ({ access_token: 'test' }),
      tokenResponseToSession: () => ({ userId: 7 }),
    },
    '@/lib/whoop/session': {
      WHOOP_OAUTH_STATE_COOKIE: 'state', WHOOP_OAUTH_NEXT_COOKIE: 'next',
      clearWhoopCookies() {}, setWhoopSessionCookie() { saved = true; },
    },
  });
  const response = await route.GET(new NextRequest('https://example.com/api/auth/whoop/callback?state=valid&code=code', {
    headers: { cookie: 'state=valid' },
  }));
  assert.equal(response.headers.get('location'), 'https://example.com/whoop');
  assert.equal(saved, true);
});

test('cancelled OAuth returns a recoverable error without exchanging credentials', async () => {
  const route = load('src/app/api/auth/whoop/callback/route.ts', {
    '@/lib/auth/navigation': navigation,
    '@/lib/whoop/client': {},
    '@/lib/whoop/oauth': { exchangeAuthorizationCode: () => assert.fail('must not exchange') },
    '@/lib/whoop/session': {
      WHOOP_OAUTH_STATE_COOKIE: 'state', WHOOP_OAUTH_NEXT_COOKIE: 'next', clearWhoopCookies() {},
    },
  });
  const response = await route.GET(new NextRequest('https://example.com/api/auth/whoop/callback?error=access_denied'));
  assert.equal(response.headers.get('location'), 'https://example.com/whoop?auth_error=access_denied');
});

const template = load('src/lib/messages/template.ts');
test('phone validation normalizes supported formatting and rejects incomplete or unsafe inputs', () => {
  assert.equal(template.normalizeE164Phone(' +1 (415) 555-2671 '), '+14155552671');
  assert.equal(template.normalizeE164Phone('+91 98765 43210'), '+919876543210');
  for (const phone of ['', '4155552671', '+0123456789', '+1', '+1234567890123456', '+14155552671 ext 2']) {
    assert.throws(() => template.normalizeE164Phone(phone));
  }
});

const session = { userId: 7, accessToken: 'test-access', refreshToken: 'test-refresh', expiresAt: Date.now() + 3600_000 };
function setupRoute(overrides = {}) {
  const saved = [];
  const cookies = [];
  const route = load('src/app/api/messages/daily/setup/route.ts', {
    '@/lib/messages/daily-subscriptions': {
      getDailySmsConfigStatus: () => ({ isReady: true, missing: [] }),
      getDailySmsSubscriptionStatus: async () => null,
      saveDailySmsSubscription: async input => saved.push(input),
      setDailySmsSubscriptionEnabled: async () => true,
      ...overrides.storage,
    },
    '@/lib/messages/daily-whoop': { normalizeE164Phone: template.normalizeE164Phone, phoneLast4: value => value.slice(-4) },
    '@/lib/whoop/client': { getWhoopProfile: async () => ({ user_id: 7 }) },
    '@/lib/whoop/oauth': {
      refreshWhoopTokens: async () => ({ access_token: 'rotated' }),
      tokenResponseToSession: () => ({ ...session, accessToken: 'rotated' }),
      ...overrides.oauth,
    },
    '@/lib/whoop/session': {
      getWhoopSession: async () => session,
      isSessionExpiring: () => false,
      setWhoopSessionCookie: (response, value) => cookies.push(value),
      clearWhoopCookies: () => cookies.push(null),
      ...overrides.session,
    },
  });
  return { ...route, saved, cookies };
}
function mutation(method, phone = '+1 (415) 555-2671', origin = 'https://example.com') {
  return new NextRequest('https://example.com/api/messages/daily/setup', {
    method, headers: { origin, 'Content-Type': 'application/json' },
    ...(method === 'POST' ? { body: JSON.stringify({ recipientPhone: phone }) } : {}),
  });
}

test('unauthenticated setup returns actionable JSON and cannot save', async () => {
  const route = setupRoute({ session: { getWhoopSession: async () => null } });
  assert.equal((await route.GET()).status, 401);
  assert.equal((await route.POST(mutation('POST'))).status, 401);
  assert.equal(route.saved.length, 0);
});

test('cross-origin mutations and invalid recipients never reach storage', async () => {
  const route = setupRoute();
  assert.equal((await route.POST(mutation('POST', '+14155552671', 'https://evil.test'))).status, 403);
  assert.equal((await route.DELETE(mutation('DELETE', '', 'https://evil.test'))).status, 403);
  assert.equal((await route.POST(mutation('POST', 'bad'))).status, 400);
  assert.equal(route.saved.length, 0);
});

test('saving a valid recipient returns only masked confirmation and does not send a text', async () => {
  const route = setupRoute();
  const response = await route.POST(mutation('POST'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { ok: true, subscription: { active: true, recipientPhoneLast4: '2671' } });
  assert.equal(route.saved[0].recipientPhone, '+14155552671');
});

test('incomplete delivery configuration and missing offline access block activation', async () => {
  const route = setupRoute({ storage: { getDailySmsConfigStatus: () => ({ isReady: false, missing: ['LINQ_API_KEY'] }) } });
  assert.equal((await route.POST(mutation('POST'))).status, 503);
  assert.equal(route.saved.length, 0);
  const offline = setupRoute({ session: { getWhoopSession: async () => ({ ...session, refreshToken: undefined }) } });
  assert.equal((await offline.POST(mutation('POST'))).status, 409);
  assert.equal(offline.saved.length, 0);
});

test('storage failure does not claim activation and preserves rotated credentials for retry', async () => {
  const route = setupRoute({
    session: { isSessionExpiring: () => true },
    storage: { saveDailySmsSubscription: async () => { throw new Error('private storage details'); } },
  });
  const response = await route.POST(mutation('POST'));
  assert.equal(response.status, 503);
  const data = await response.json();
  assert.equal(data.ok, false);
  assert.ok(!data.error.includes('private storage details'));
  assert.equal(route.cookies[0].accessToken, 'rotated');
});

test('refresh failure returns a reconnect action and clears the expired session', async () => {
  const route = setupRoute({ session: { isSessionExpiring: () => true }, oauth: { refreshWhoopTokens: async () => { throw new Error('provider failure'); } } });
  const response = await route.GET();
  assert.equal(response.status, 401);
  assert.equal((await response.json()).connected, false);
  assert.deepEqual(route.cookies, [null]);
});

test('saved activation is restored from storage and can be disabled', async () => {
  const subscription = { active: true, recipientPhoneLast4: '2671' };
  let disabled = false;
  const route = setupRoute({ storage: {
    getDailySmsSubscriptionStatus: async () => subscription,
    setDailySmsSubscriptionEnabled: async (id, active) => { assert.equal(id, 7); disabled = !active; return true; },
  } });
  assert.deepEqual((await (await route.GET()).json()).subscription, subscription);
  assert.equal((await route.DELETE(mutation('DELETE'))).status, 200);
  assert.equal(disabled, true);
});

test('preview and delivered report share the configured greeting and formatter', () => {
  const oldGreeting = process.env.DAILY_MESSAGE_GREETING;
  process.env.DAILY_MESSAGE_GREETING = 'Morning Alex';
  try {
    const { buildDailySleepDigest } = load('src/lib/messages/daily-whoop.ts', { '@/lib/messages/template': template });
    const digest = buildDailySleepDigest({
      id: 'sleep', start: '2026-09-10T23:14:00Z', end: '2026-09-11T07:12:00Z', timezone_offset: '+00:00',
      score: { stage_summary: { total_light_sleep_time_milli: 200 * 60_000, total_slow_wave_sleep_time_milli: 100 * 60_000, total_rem_sleep_time_milli: 154 * 60_000 } },
    });
    assert.equal(digest.message, template.formatDailyMessage({ greeting: 'Morning Alex', sleepStart: '11:14 PM', wakeTime: '7:12 AM', sleepDuration: '7h 34m' }));
  } finally {
    if (oldGreeting === undefined) delete process.env.DAILY_MESSAGE_GREETING;
    else process.env.DAILY_MESSAGE_GREETING = oldGreeting;
  }
});
