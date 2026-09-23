/* eslint-disable @typescript-eslint/no-require-imports -- Isolated TypeScript provider tests. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

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

function env(t, values) {
  const before = { ...process.env };
  Object.assign(process.env, values);
  t.after(() => { process.env = before; });
}

function adapter(run) {
  return load('src/lib/messages/linq-cli.ts', { 'node:util': { promisify: () => run } });
}

test('CLI sends literal text, keeps token out of arguments, and parses nested IDs', async t => {
  env(t, { NODE_ENV: 'development', LINQ_API_KEY: 'private-token', LINQ_CLI_PATH: '/path with spaces/linq' });
  const calls = [];
  const provider = adapter(async (...args) => {
    calls.push(args);
    return { stdout: calls.length === 1 ? '@linqapp/cli/2.6.0 darwin-arm64 node-v24.11.0' : JSON.stringify({ chat: { id: 'chat-id', message: { id: 'message-id', delivery_status: 'queued' } } }) };
  });
  const body = 'Hello "friend"; $(touch /tmp/nope)\n`literal`';
  const result = await provider.sendLinqCliTextMessage('+14155552671', body);
  assert.equal(result.id, 'message-id');
  assert.equal(result.chatId, 'chat-id');
  assert.equal(result.status, 'queued');
  assert.equal(calls[1][0], '/path with spaces/linq');
  assert.deepEqual(calls[1][1], ['chats', 'create', '--to', '+14155552671', '--message', body, '--json']);
  assert.equal(calls[1][2].env.LINQ_TOKEN, 'private-token');
  assert.equal(calls[1][2].shell, undefined);
});

test('production and malformed recipients cannot spawn CLI sends', async t => {
  env(t, { NODE_ENV: 'production' });
  const provider = adapter(async () => assert.fail('must not spawn'));
  await assert.rejects(provider.sendLinqCliTextMessage('+14155552671', 'Hi'), /requires NODE_ENV=development/);
  process.env.NODE_ENV = 'development';
  await assert.rejects(provider.sendLinqCliTextMessage('--token=oops', 'Hi'), /E.164/);
});

test('old CLI versions fail before sending', async t => {
  env(t, { NODE_ENV: 'development' });
  let calls = 0;
  const provider = adapter(async () => { calls++; return { stdout: '@linqapp/cli/2.5.9' }; });
  await assert.rejects(provider.sendLinqCliTextMessage('+14155552671', 'Hi'), /2.6.0/);
  assert.equal(calls, 1);
});

test('send failures never retry or expose child-process output', async t => {
  env(t, { NODE_ENV: 'development' });
  let calls = 0;
  const provider = adapter(async () => {
    if (++calls === 1) return { stdout: '@linqapp/cli/2.6.0' };
    throw new Error('private-token and private message');
  });
  await assert.rejects(provider.sendLinqCliTextMessage('+14155552671', 'Hi'), error => {
    assert.match(error.message, /Check chat history before retrying/);
    assert.ok(!error.message.includes('private'));
    return true;
  });
  assert.equal(calls, 2);
});

test('unexpected responses do not claim successful delivery', async t => {
  env(t, { NODE_ENV: 'development' });
  for (const stdout of ['not JSON', '{}', '{"chat":{"id":"only-chat"}}']) {
    let calls = 0;
    const provider = adapter(async () => ({ stdout: ++calls === 1 ? '@linqapp/cli/2.6.0' : stdout }));
    await assert.rejects(provider.sendLinqCliTextMessage('+14155552671', 'Hi'), /unexpected response/);
  }
});

test('API remains the default and retains provider idempotency', async t => {
  env(t, { LINQ_TRANSPORT: '', LINQ_API_KEY: 'api-token' });
  const oldFetch = global.fetch;
  t.after(() => { global.fetch = oldFetch; });
  global.fetch = async (url, options) => {
    assert.match(url, /api.linqapp.com/);
    assert.equal(options.headers['Idempotency-Key'], 'sleep-id');
    assert.equal(JSON.parse(options.body).message.idempotency_key, 'sleep-id');
    return new Response('{"id":"api-message-id"}', { status: 202 });
  };
  const provider = load('src/lib/messages/linq.ts');
  const result = await provider.sendLinqTextMessage({ to: '+14155552671', body: 'Hi', idempotencyKey: 'sleep-id' });
  assert.equal(result.id, 'api-message-id');
});

test('CLI routing is explicit and invalid transport never falls back to a send', async t => {
  env(t, { LINQ_TRANSPORT: 'cli' });
  const provider = load('src/lib/messages/linq.ts', { './linq-cli': {
    sendLinqCliTextMessage: async (to, body) => ({ id: 'cli-message', raw: { to, body } }),
  } });
  const input = { to: '+14155552671', body: 'Hi', idempotencyKey: 'sleep-id' };
  assert.equal((await provider.sendLinqTextMessage(input)).id, 'cli-message');
  process.env.LINQ_TRANSPORT = 'typo';
  await assert.rejects(provider.sendLinqTextMessage(input), /must be api or cli/);
});
