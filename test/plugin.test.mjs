import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { Window } from 'happy-dom';
import { dictionaries } from '../src/fa.js';
import { installDirection } from '../src/client.js';

const require = createRequire(import.meta.url);
const upstream = JSON.parse(readFileSync(new URL('./upstream-en.json', import.meta.url)));
const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();

test('all entries preserve upstream keys and placeholder multiplicity', () => {
  for (const [ns, dict] of Object.entries(upstream)) {
    assert.deepEqual(Object.keys(dictionaries[ns]).sort(), Object.keys(dict).sort());
    for (const [key, value] of Object.entries(dict)) {
      assert.ok(dictionaries[ns][key].trim(), `${ns}.${key}`);
      assert.deepEqual(placeholders(dictionaries[ns][key]), placeholders(value), `${ns}.${key}`);
      assert.doesNotMatch(dictionaries[ns][key], /[\u202a-\u202e\u2066-\u2069]/u);
    }
  }
});

function fixture(browserLanguage = 'en', dir = null) {
  const window = new Window();
  if (dir !== null) window.document.documentElement.setAttribute('dir', dir);
  const sandbox = { window, document: window.document, navigator: { languages: [browserLanguage], language: browserLanguage }, console };
  const factories = new Map();
  window.__ModuleLoader__ = { load: entry => factories.set(entry.id, entry.factory) };
  vm.runInNewContext(readFileSync(require.resolve('@deepseek-ai/dsh-client-locale/client'), 'utf8'), sandbox);
  // These UI dependencies are not used by LocaleRuntime. Fail if the registry
  // unexpectedly starts calling a render dependency, rather than mocking it.
  const noUi = new Proxy({}, { get: (_, key) => { throw new Error(`Unexpected UI dependency: ${String(key)}`); } });
  const { LocaleRuntime } = factories.get('@deepseek-ai/dsh-client-locale')(() => noUi);
  const owned = [];
  const ctx = { emit() {}, effect(fn) { const dispose = fn(); owned.push(dispose); } };
  ctx.locale = new LocaleRuntime(ctx);
  for (const [ns, dict] of Object.entries(upstream)) ctx.locale.register(ns, 'en', dict);
  vm.runInNewContext(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), sandbox);
  const plugin = factories.get('dsh-persian-rtl')();
  const dispose = () => { for (const fn of owned.splice(0).reverse()) fn(); };
  return { ctx, window, plugin, dispose };
}

test('published LocaleRuntime: select, interpolation, English fallback, unload and reload', () => {
  const f = fixture();
  f.plugin.apply(f.ctx);
  assert.equal(f.ctx.locale.getSnapshot().active, 'en');
  f.ctx.locale.register('untranslated', 'en', { welcome: 'Welcome {name}' });
  f.ctx.locale.setLocale('fa');
  assert.equal(f.ctx.locale.bind('chat')('stats.counts', { turns: 2, steps: 5 }), '2 نوبت، 5 گام');
  assert.equal(f.ctx.locale.bind('untranslated')('welcome', { name: 'Ali' }), 'Welcome Ali');
  assert.equal(f.window.document.documentElement.dir, 'rtl');
  f.dispose();
  assert.equal(f.ctx.locale.getSnapshot().active, 'en');
  assert.equal(f.window.document.documentElement.hasAttribute('dir'), false);
  assert.equal(f.window.document.querySelectorAll('style[data-dsh-persian-style]').length, 0);
  assert.equal(f.ctx.locale.getSnapshot().locales.some(l => l.id === 'fa'), false);
  f.plugin.apply(f.ctx);
  f.ctx.locale.setLocale('fa');
  assert.equal(f.ctx.locale.bind('common')('save'), 'ذخیره');
  f.dispose();
});

test('fa-IR browser negotiation activates Persian when its pack arrives', () => {
  const f = fixture('fa-IR');
  f.plugin.apply(f.ctx);
  assert.equal(f.ctx.locale.getSnapshot().active, 'fa');
  assert.equal(f.window.document.documentElement.dir, 'rtl');
  f.dispose();
});

test('switches restore existing direction, preserve text and do not accumulate styles', () => {
  const f = fixture('en', 'ltr');
  f.window.document.body.innerHTML = '<p>سلام، DeepSeek 123</p><pre>const x = 42;</pre>';
  const before = f.window.document.body.innerHTML;
  f.plugin.apply(f.ctx);
  for (let i = 0; i < 10; i++) {
    f.ctx.locale.setLocale('fa');
    assert.equal(f.window.document.documentElement.dir, 'rtl');
    f.ctx.locale.setLocale('en');
    assert.equal(f.window.document.documentElement.dir, 'ltr');
  }
  assert.equal(f.window.document.body.innerHTML, before);
  assert.equal(f.window.document.querySelectorAll('style[data-dsh-persian-style]').length, 1);
  f.dispose();
});

test('cleanup does not overwrite a later direction owner', () => {
  const f = fixture();
  f.plugin.apply(f.ctx);
  f.ctx.locale.setLocale('fa');
  f.window.document.documentElement.setAttribute('dir', 'auto');
  f.dispose();
  assert.equal(f.window.document.documentElement.getAttribute('dir'), 'auto');
});

test('document effect releases subscription and is safe to dispose twice', () => {
  const window = new Window();
  const listeners = new Set();
  const stop = installDirection({ getSnapshot: () => ({ active: 'fa' }), subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); } }, window.document);
  assert.equal(listeners.size, 1);
  stop(); stop();
  assert.equal(listeners.size, 0);
  assert.equal(window.document.documentElement.hasAttribute('dir'), false);
});
