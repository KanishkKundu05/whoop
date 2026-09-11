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
