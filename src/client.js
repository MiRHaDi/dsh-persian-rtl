import { dictionaries } from './fa.js';

export const name = 'persian-rtl';
export const inject = ['locale'];

/** Register a removable language pack without overriding the user's preference. */
export function apply(ctx) {
  if (typeof ctx.locale.addLanguage !== 'function') {
    throw new Error('dsh-persian-rtl requires the external language-pack API (tested with DSH 0.1.6-alpha.2).');
  }
  for (const [namespace, dictionary] of Object.entries(dictionaries)) {
    ctx.effect(() => ctx.locale.register(namespace, 'fa', dictionary), `persian-rtl: ${namespace}`);
  }
  ctx.effect(() => ctx.locale.addLanguage({ id: 'fa', label: 'فارسی', fallback: 'en' }), 'persian-rtl: language');
  ctx.effect(() => installDirection(ctx.locale, document), 'persian-rtl: document direction');
}

/** Own direction only while Persian is selected; preserve other plugins' later changes. */
export function installDirection(locale, doc) {
  const root = doc.documentElement;
  const style = doc.createElement('style');
  style.setAttribute('data-dsh-persian-style', '');
  style.textContent = `
html[data-dsh-persian-rtl] :is(pre, code, kbd, samp, .xterm, .monaco-editor, .cm-editor) {
  direction: ltr;
  unicode-bidi: isolate;
  text-align: start;
}
html[data-dsh-persian-rtl] :is(p, textarea) { unicode-bidi: plaintext; }
/* Slot identity is public; avoid the host's generated CSS-module class names.
   Let the workspace and preset controls wrap before their labels are crushed. */
html[data-dsh-persian-rtl] :has(> [data-slot="conversation.hero.agentPreset"]) {
  flex-wrap: wrap;
  row-gap: 4px;
}
`;
  doc.head.append(style);
  let owned = false;
  let previousDir;
  let previousMarker;
  const restore = () => {
    if (!owned) return;
    if (root.getAttribute('dir') === 'rtl') {
      if (previousDir === null) root.removeAttribute('dir');
      else root.setAttribute('dir', previousDir);
    }
    if (root.getAttribute('data-dsh-persian-rtl') === '') {
      if (previousMarker === null) root.removeAttribute('data-dsh-persian-rtl');
      else root.setAttribute('data-dsh-persian-rtl', previousMarker);
    }
    owned = false;
  };
  const sync = () => {
    if (locale.getSnapshot().active.toLowerCase() !== 'fa') { restore(); return; }
    if (owned) return;
    previousDir = root.getAttribute('dir');
    previousMarker = root.getAttribute('data-dsh-persian-rtl');
    root.setAttribute('dir', 'rtl');
    root.setAttribute('data-dsh-persian-rtl', '');
    owned = true;
  };
  const unsubscribe = locale.subscribe(sync);
  sync();
  return () => { unsubscribe(); restore(); style.remove(); };
}
