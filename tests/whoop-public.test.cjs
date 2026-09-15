/* eslint-disable @typescript-eslint/no-require-imports -- Isolate real server modules from external services. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { NextRequest } = require('next/server');
function load(file, mocks = {}) {
  const filename = resolve(file);
  const mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = name => name === 'server-only' ? {} : name in mocks ? mocks[name] : require(name);
  mod._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
const secret = 'test-only-server-secret-32-characters-long';
process.env.WHOOP_SERVER_SECRET = secret;
const convex = load('convex/whoop.ts', {
  './_generated/server': { query: x => x, mutation: x => x },
  './whoopValidators': load('convex/whoopValidators.ts'),
  './serverAuth': load('convex/serverAuth.ts'),
});
test('every WHOOP data function rejects unauthenticated direct access before touching storage', async () => {
  for (const operation of Object.values(convex)) {
    for (const supplied of ['', 'wrong']) await assert.rejects(operation.handler({}, { secret: supplied, whoopUserId: 7 }), /Unauthorized/);
  }
});
test('dashboard sync rejects records belonging to a different account', async () => {
  await assert.rejects(convex.storeDashboardFetch.handler({}, {
    secret, fetch: { whoopUserId: 7 }, cycles: [], recoveries: [], sleeps: [{ whoopUserId: 8 }], workouts: [],
  }), /Account mismatch/);
});
test('stored dashboard never falls back to the most recently synced user', async () => {
  const result = await convex.publicDashboard.handler({}, { secret, rangeDays: 7, start: '2026-01-01' });
  assert.equal(result.user, null); assert.deepEqual(result.sleeps, []);
});
test('account deletion scopes every table to the authenticated user', async () => {
  const visited = []; const deleted = [];
  const result = await convex.deleteAccountBatch.handler({ db: {
    query: table => ({ withIndex: (_index, filter) => {
      filter({ eq: (field, id) => { assert.equal(field, 'whoopUserId'); assert.equal(id, 7); visited.push(table); } });
      return { take: async limit => { assert.equal(limit, 100); return [{ _id: `${table}-7` }]; } };
    } }), delete: async id => deleted.push(id),
  } }, { secret, whoopUserId: 7 });
  assert.equal(result, false); assert.equal(visited.length, 9); assert.equal(deleted.length, 9);
});
function accountRoute(session, calls) {
  return load('src/app/api/whoop/account/route.ts', {
    '@/lib/convex/server': { fetchMutation: async (_ref, args) => { calls.push(args); return false; } },
    '@/lib/whoop/client': { revokeWhoopAccess: async () => {}, WhoopApiError: Error },
    '@/lib/whoop/session': { getWhoopSession: async () => session, clearWhoopCookies() {} },
  });
}
function deleteRequest(origin = 'https://example.com') { return new NextRequest('https://example.com/api/whoop/account?whoopUserId=99', { method: 'DELETE', headers: { origin }, body: JSON.stringify({ whoopUserId: 99 }) }); }
test('deletion rejects anonymous and cross-origin requests and ignores supplied account IDs', async () => {
  const calls = []; process.env.CONVEX_URL = 'https://test.convex.cloud';
  assert.equal((await accountRoute(null, calls).DELETE(deleteRequest())).status, 401);
  assert.equal((await accountRoute({ userId: 7 }, calls).DELETE(deleteRequest('https://evil.test'))).status, 403);
  assert.deepEqual(calls, []);
  assert.equal((await accountRoute({ userId: 7 }, calls).DELETE(deleteRequest())).status, 200);
  assert.deepEqual(calls, [{ whoopUserId: 7 }]);
});
async function connectionHtml(session, sleeps = [], fail = false) {
  const component = load('src/components/whoop-connection.tsx', {
    'next/navigation': { redirect: url => { throw new Error(`redirect:${url}`); } },
    '@/components/onboarding-shell': { OnboardingShell: ({ children }) => React.createElement('main', null, children), primaryAction: '', secondaryAction: '' },
    '@/components/whoop-account-controls': { WhoopAccountControls: () => null },
    '@/lib/whoop/session': { getWhoopSession: async () => session, isSessionExpiring: () => false },
    '@/lib/whoop/config': { getConfigStatus: () => ({ isReady: true }) },
    '@/lib/whoop/client': {
      getWhoopProfile: async token => { assert.equal(token, 'user-7-token'); return { user_id: 7, first_name: 'Member', email: 'member@example.com' }; },
      fetchWhoop: async token => { assert.equal(token, 'user-7-token'); if (fail) throw new Error('provider detail must stay private'); return { records: sleeps }; },
    },
    '@/lib/auth/navigation': load('src/lib/auth/navigation.ts'),
  });
  return renderToStaticMarkup(await component.WhoopConnection({}));
}
test('public onboarding has an OAuth action without developer configuration', async () => {
  const html = await connectionHtml(null);
  assert.match(html, /Connect WHOOP/); assert.match(html, /next=\/setup\/connection/);
  assert.doesNotMatch(html, /WHOOP_SETUP_SECRET|Convex|webhook|Run API test/);
});
test('connected users automatically see their email and sleep; empty and error results stay distinct', async () => {
  const session = { accessToken: 'user-7-token' };
  const html = await connectionHtml(session, [{ nap: false, end: '2026-09-15T10:00:00Z', score: { sleep_performance_percentage: 88 } }]);
  assert.match(html, /member@example.com/); assert.match(html, /88%/); assert.match(html, /Latest sleep/);
  assert.doesNotMatch(html, /user-7-token|Run API test/);
  assert.match(await connectionHtml(session), /hasn’t returned any sleep/);
  const errorHtml = await connectionHtml(session, [], true);
  assert.match(errorHtml, /couldn’t load/); assert.doesNotMatch(errorHtml, /hasn’t returned any sleep|provider detail/);
});
