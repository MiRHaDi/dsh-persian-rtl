const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// The language row updates optimistically. A second browser with the opposite
// preference proves the Host accepted the selection, rather than sampling a
// transient local update while older settings responses are still in flight.
async function verifyPersistedLocale(page, locale) {
  const browser = page.context().browser();
  assert.ok(browser, 'This smoke requires a regular isolated browser context');
  const probe = await browser.newContext({ locale: locale === 'fa' ? 'en-US' : 'fa-IR' });
  try {
    await probe.addCookies(await page.context().cookies());
    const tab = await probe.newPage();
    const errors = [];
    tab.on('pageerror', error => errors.push(error.message));
    await tab.goto(page.url());
    await tab.locator('style[data-dsh-persian-style]').waitFor({ state: 'attached' });
    await tab.waitForFunction(expected => document.documentElement.lang === expected, locale);
    assert.equal(await tab.locator('html').getAttribute('dir'), locale === 'fa' ? 'rtl' : null);
    assert.deepEqual(errors, []);
  } finally { await probe.close(); }
}

// Run only against an isolated profile with onboarding completed and the named
// workspace already added. This checks a draft, never a model request.
async function verifyConversation(page, output, workspace) {
  await page.getByLabel('نشست‌ها', { exact: true }).getByText(workspace, { exact: true }).waitFor();
  await page.getByRole('button', { name: 'انتخاب فضای کاری', exact: true }).click();
  await page.getByText(workspace, { exact: true }).last().click();
  const editor = page.locator('[contenteditable=true]');
  await editor.waitFor();
  assert.equal(await editor.innerText(), '', 'Use an empty test draft');
  const draft = 'سلام OpenAI 123! لطفاً فایل example.ts را بررسی کن.\nconst answer = 42;';
  await editor.fill(draft);
  await page.getByRole('button', { name: 'ارسال پیام', exact: true }).waitFor();
  await page.getByRole('button', { name: 'تنظیمات', exact: true }).click();
  await page.getByRole('button', { name: 'فارسی', exact: true }).click();
  await page.getByText('English', { exact: true }).click();
  await verifyPersistedLocale(page, 'en');
  await page.waitForFunction(() => document.documentElement.lang === 'en' && !document.documentElement.hasAttribute('dir'));
  assert.equal(await page.locator('html').getAttribute('dir'), null);
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  assert.equal(await page.locator('[data-slot="conversation.hero.agentPreset"]').evaluate(slot => getComputedStyle(slot.parentElement).flexWrap), 'nowrap');
  assert.equal(await page.getByRole('button', { name: 'Send message', exact: true }).count(), 1);
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.getByText('فارسی', { exact: true }).click();
  await verifyPersistedLocale(page, 'fa');
  await page.waitForFunction(() => document.documentElement.lang === 'fa' && document.documentElement.dir === 'rtl');
  await page.getByRole('button', { name: 'بستن', exact: true }).click();
  assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
  assert.equal(await page.locator('html').getAttribute('lang'), 'fa');
  assert.equal(await page.locator('[data-slot="conversation.hero.agentPreset"]').evaluate(slot => getComputedStyle(slot.parentElement).flexWrap), 'wrap');
  assert.equal(await editor.innerText(), draft);
  fs.mkdirSync(output, { recursive: true });
  await page.screenshot({ path: path.join(output, 'persian-desktop.png'), fullPage: true });
  assert.equal(await page.locator('html').getAttribute('lang'), 'fa');
  await page.setViewportSize({ width: 360, height: 780 });
  // Wait for the responsive sidebar transition, rather than sampling mid-animation.
  await page.waitForTimeout(300);
  const layout = await page.evaluate(() => ({ viewport: innerWidth, documentWidth: document.documentElement.scrollWidth }));
  assert.equal(await page.locator('html').getAttribute('lang'), 'fa');
  assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
  assert.equal(layout.documentWidth, layout.viewport);
  assert.equal(await editor.innerText(), draft);
  const presetLabel = page.locator('[data-slot="conversation.hero.agentPreset"] button[aria-haspopup="menu"] > span');
  const preset = await presetLabel.evaluate(label => ({ text: label.textContent, available: label.clientWidth, required: label.scrollWidth }));
  assert.ok(preset.required <= preset.available, `Preset label is clipped: ${JSON.stringify(preset)}`);
  await page.screenshot({ path: path.join(output, 'persian-narrow.png'), fullPage: true });
  assert.equal(await page.locator('html').getAttribute('lang'), 'fa');
  const widths = [];
  for (const width of [320, 360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(300);
    assert.equal(await page.locator('html').getAttribute('lang'), 'fa');
    assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
    const sample = await presetLabel.evaluate(label => {
      const button = label.closest('button');
      const box = button.getBoundingClientRect();
      return { viewport: innerWidth, documentWidth: document.documentElement.scrollWidth,
        required: label.scrollWidth, available: label.clientWidth, left: box.left, right: box.right };
    });
    assert.equal(sample.documentWidth, width);
    assert.ok(sample.required <= sample.available, `Clipped at ${width}px`);
    assert.ok(sample.left >= 0 && sample.right <= width, `Offscreen at ${width}px`);
    widths.push(sample);
  }
  await page.setViewportSize({ width: 360, height: 780 });
  const presetButton = page.locator('[data-slot="conversation.hero.agentPreset"] button[aria-haspopup="menu"]');
  await presetButton.click();
  assert.equal(await presetButton.getAttribute('aria-expanded'), 'true');
  await page.keyboard.press('Escape');
  assert.equal(await presetButton.getAttribute('aria-expanded'), 'false');
  await editor.fill('');
  return { languageSwitch: 'fa → en → fa', persistedLanguageVerified: true, draftPreserved: true, sentMessages: 0, layout, preset, widths, presetMenuOpened: true };
}
module.exports = { verifyConversation };

if (require.main === module) {
  (async () => {
    const url = process.env.DSH_TEST_URL;
    const workspace = process.env.DSH_TEST_WORKSPACE;
    if (!url || !workspace || !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname)) {
      throw new Error('Set DSH_TEST_URL to an isolated local instance and DSH_TEST_WORKSPACE to an existing test workspace name');
    }
    const browser = await require('playwright').chromium.launch({ channel: 'chrome', headless: true });
    try {
      const page = await browser.newPage({ locale: 'fa-IR', viewport: { width: 1280, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(url);
      const result = await verifyConversation(page, process.env.DSH_TEST_OUTPUT || path.join(__dirname, '../docs/conversation'), workspace);
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ browser: browser.version(), ...result, pageErrors: errors.length }));
    } finally { await browser.close(); }
  })().catch(error => {
    console.error(String(error.message).replace(/([?&]token=)[^\s"']+/g, '$1[redacted]'));
    process.exitCode = 1;
  });
}
