/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS loader isolates real TypeScript route modules. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { createHmac } = require('node:crypto');
const { NextRequest } = require('next/server');

// Load the real route code with isolated provider/storage dependencies. No
// credentials, network requests, Convex writes, or message sends in these tests.
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

const webhookHelper = load('src/lib/whoop/webhook.ts');
const secret = 'test-client-secret-do-not-use-in-production';
process.env.WHOOP_CLIENT_SECRET = secret;
process.env.WHOOP_WEBHOOK_SECRET = '';
const event = { user_id: 7, id: 'sleep-uuid', type: 'sleep.updated', trace_id: 'trace-1' };
function signedRequest(body = JSON.stringify(event), age = 0, corrupt = false) {
  const timestamp = String(Date.now() - age);
  const signature = createHmac('sha256', secret).update(timestamp + body).digest('base64');
  return new NextRequest('https://example.com/api/whoop/setup/webhook', {
    method: 'POST', body,
    headers: { 'x-whoop-signature-timestamp': timestamp, 'x-whoop-signature': corrupt ? 'bad' : signature },
  });
}
function webhookRoute(record) {
  return load('src/app/api/whoop/setup/webhook/route.ts', {
    '@/lib/whoop/webhook': webhookHelper,
    '@/lib/whoop/setup': { recordWebhookTest: record },
  });
}

test('real signature accepted even with blank legacy override; receipt belongs to signed user', async () => {
  const calls = [];
  const route = webhookRoute(async (...args) => { calls.push(args); return true; });
  const response = await route.POST(signedRequest());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).recorded, true);
  assert.equal(calls[0][0], 7);
  assert.equal(calls[0][1].eventType, 'sleep.updated');
});
test('invalid signature cannot write a passing receipt', async () => {
  const route = webhookRoute(() => assert.fail('must not write'));
  assert.equal((await route.POST(signedRequest(undefined, 0, true))).status, 401);
});
test('old signed request cannot pass a new test', async () => {
  const route = webhookRoute(() => assert.fail('must not write'));
  assert.equal((await route.POST(signedRequest(undefined, 6 * 60_000))).status, 401);
});
test('malformed and v1 events fail validation', async () => {
  const route = webhookRoute(() => assert.fail('must not write'));
  assert.equal((await route.POST(signedRequest('{'))).status, 400);
  assert.equal((await route.POST(signedRequest(JSON.stringify({ ...event, id: 123 })))).status, 400);
});
test('storage failures return retryable HTTP status', async () => {
  const route = webhookRoute(async () => { throw new Error('offline'); });
  assert.equal((await route.POST(signedRequest())).status, 503);
});

class WhoopApiError extends Error { constructor(status) { super('provider failure'); this.status = status; } }
function apiRoute({ session = { accessToken: 'hidden', userId: 7, scope: 'read:profile read:sleep' }, fail, sleeps = [], payload = { records: sleeps } } = {}) {
  return load('src/app/api/whoop/setup/route.ts', {
    '@/lib/whoop/config': { getConfigStatus: () => ({ isReady: true }) },
    '@/lib/whoop/session': { getWhoopSession: async () => session, isSessionExpiring: s => !!s.expired, setWhoopSessionCookie: () => {} },
    '@/lib/whoop/client': { WhoopApiError, getWhoopProfile: async () => ({ user_id: 7, first_name: 'Test' }), fetchWhoop: async () => { if (fail) throw new WhoopApiError(fail); return payload; } },
    '@/lib/whoop/setup': { setupStorageMissing: () => [], readWebhookTest: async () => null, startWebhookTest: async () => ({}) },
  });
}
function apiRequest(origin = 'https://example.com') {
  return new NextRequest('https://example.com/api/whoop/setup', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'api' }) });
}
test('API test rejects anonymous, expired and cross-origin requests', async () => {
  assert.equal((await apiRoute({ session: null }).POST(apiRequest())).status, 401);
  assert.equal((await apiRoute({ session: { expired: true } }).POST(apiRequest())).status, 401);
  assert.equal((await apiRoute().POST(apiRequest('https://attacker.example'))).status, 403);
});
test('provider API failure is not reported as a passing test', async () => {
  const response = await apiRoute({ fail: 403 }).POST(apiRequest());
  assert.equal(response.status, 403);
  assert.equal((await response.json()).providerStatus, 403);
});
test('empty sleep collection does not verify sleep data or leak tokens', async () => {
  const response = await apiRoute().POST(apiRequest());
  const result = await response.json();
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'empty_sleep_collection');
  assert.equal(result.sleepCount, 0);
  assert.equal(result.latest, null);
  assert.ok(!JSON.stringify(result).includes('hidden'));
});
test('missing or malformed records are not reported as an empty collection', async () => {
  for (const payload of [null, {}, { records: null }, { records: {} }]) {
    const response = await apiRoute({ payload }).POST(apiRequest());
    assert.equal(response.status, 502);
    const result = await response.json();
    assert.equal(result.reason, 'invalid_sleep_response');
    assert.equal(result.sleepCount, undefined);
  }
});
test('sleep records verify the check and identify the latest main sleep', async () => {
  const response = await apiRoute({ sleeps: [
    { id: 'nap', nap: true },
    { id: 'main', nap: false, end: '2026-09-15T10:00:00Z', score_state: 'SCORED', score: { sleep_performance_percentage: 85 } },
  ] }).POST(apiRequest());
  const result = await response.json();
  assert.equal(result.ok, true);
  assert.equal(result.sleepCount, 2);
  assert.equal(result.latest.id, 'main');
  assert.equal(result.latest.performance, 85);
});

const setupFunctions = load('convex/whoopSetup.ts', {
  './_generated/server': { mutation: config => config, query: config => config },
});
process.env.WHOOP_SETUP_SECRET = 'x'.repeat(64);
function context(record) {
  let saved = record;
  return {
    db: {
      query: () => ({ withIndex: (_name, fn) => {
        let userId;
        fn({ eq: (_field, value) => { userId = value; } });
        return { unique: async () => saved?.whoopUserId === userId ? saved : null };
      } }),
      patch: async (_id, updates) => { saved = { ...saved, ...updates }; },
    },
    current: () => saved,
  };
}
const receiveArgs = { secret: process.env.WHOOP_SETUP_SECRET, whoopUserId: 7, signedAt: Date.now(), eventType: 'sleep.updated', sleepId: 'sleep', traceId: 'trace' };
test('Convex functions reject unauthenticated direct access', async () => {
  for (const operation of ['start', 'status', 'receive']) {
    await assert.rejects(setupFunctions[operation].handler({}, { ...receiveArgs, secret: 'wrong' }), /unauthorized/);
  }
});
test('only active tests for the matching user accept new events', async () => {
  const record = { _id: '1', whoopUserId: 7, startedAt: Date.now() - 1000, expiresAt: Date.now() + 60_000 };
  for (const changed of [{ whoopUserId: 8 }, { expiresAt: Date.now() - 1 }, { startedAt: Date.now() + 1000 }]) {
    assert.equal(await setupFunctions.receive.handler(context({ ...record, ...changed }), receiveArgs), false);
  }
  const ctx = context(record);
  assert.equal(await setupFunctions.receive.handler(ctx, receiveArgs), true);
  assert.equal(ctx.current().eventType, 'sleep.updated');
  await setupFunctions.receive.handler(ctx, { ...receiveArgs, eventType: 'recovery.updated' });
  assert.equal(ctx.current().eventType, 'sleep.updated');
});
