/* eslint-disable @typescript-eslint/no-require-imports -- Render TypeScript pages without live providers. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(file, mocks = {}) {
  const filename = resolve(file);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = module.paths;
  mod.require = name => name in mocks ? mocks[name] : require(name);
  mod._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return mod.exports;
}

const link = { default: ({ children, ...props }) => React.createElement('a', props, children) };
const template = load('src/lib/messages/template.ts');
const configuration = load('src/components/delivery-configuration.tsx', { 'next/link': link });
const onboarding = load('src/components/morning-text-onboarding.tsx', {
  'next/link': link,
  'next/navigation': { useSearchParams: () => new URLSearchParams() },
  '@/components/onboarding-shell': { primaryAction: '', secondaryAction: '' },
  '@/components/delivery-configuration': configuration,
  '@/lib/messages/template': template,
});

test('morning page renders recipient, template, and configuration before status or sign-in', async () => {
  const page = load('src/app/morning/page.tsx', {
    '@/components/onboarding-shell': { OnboardingShell: ({ children }) => React.createElement('main', null, children) },
    '@/components/morning-text-onboarding': onboarding,
    '@/lib/messages/template': template,
  });
  const html = renderToStaticMarkup(await page.default({ searchParams: Promise.resolve({}) }));
  assert.match(html, /type="tel"/);
  assert.match(html, /name="recipientPhone"/);
  assert.match(html, /Message template/);
  assert.match(html, /7:12 AM/);
  assert.match(html, /App owner · Delivery configuration/);
  assert.match(html, /LINQ_TRANSPORT=cli/);
  assert.match(html, /\/api\/whoop\/webhook/);
});

test('completion URL cannot claim activation before stored status is available', () => {
  const html = renderToStaticMarkup(React.createElement(onboarding.MorningTextOnboarding, {
    requestedStep: 'complete', preview: 'Sample report',
  }));
  assert.match(html, /type="tel"/);
  assert.doesNotMatch(html, /Morning texts are enabled\./);
});

test('legacy setup preserves and encodes the requested step in its morning redirect', async () => {
  // redirect normally throws; capture the argument instead of relying on its return.
  let target;
  const capture = load('src/app/setup/page.tsx', { 'next/navigation': { redirect: path => { target = path; } } });
  await capture.default({ searchParams: Promise.resolve({ step: 'recipient' }) });
  assert.equal(target, '/morning?step=recipient');
  await capture.default({ searchParams: Promise.resolve({ step: 'review&unsafe=1' }) });
  assert.equal(target, '/morning?step=review%26unsafe%3D1');
  await capture.default({ searchParams: Promise.resolve({}) });
  assert.equal(target, '/morning');
});
