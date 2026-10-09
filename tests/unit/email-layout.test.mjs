import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { chromium } from '@playwright/test';

function load(file, dependencies, env = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { exports, process: { env }, console, require: name => dependencies[name] });
  return exports;
}
const base = load('src/lib/email-templates-base.ts', {});
const captured = [];
const email = load('src/lib/email.ts', {
  nodemailer: { default: { createTransport: () => ({ sendMail: async mail => { captured.push(mail); return { messageId: 'mock' }; } }) } },
  './email-templates-base': base, '@/lib/utils': { debugLog() {}, debugError() {}, debugWarn() {} },
}, { SMTP_HOST: 'example.invalid', SMTP_PORT: '465', SMTP_USER: 'test-only', SMTP_PASS: 'test-only', SMTP_FROM: 'test@example.invalid' }).emailService;

async function samples() {
  captured.length = 0;
  const name = 'Alexandria Morgan-Smith';
  const pool = 'Morgan Family and Friends Sunday Huddle';
  const longEmail = 'averylongparticipantaddresswithoutbreaks@example.invalid';
  await email.sendPickReminder('test@example.invalid', name, pool, 4, 'https://example.invalid/pool', 'Thursday at 7:15 PM');
  await email.sendPasswordResetLink('test@example.invalid', name, 'https://example.invalid/reset?token=' + 'a'.repeat(120));
  await email.sendAdminSubmissionSummary('test@example.invalid', name, pool, 4, 2, [{ name, email: longEmail }], [{ name: 'Pat', email: longEmail }], 2, 'Thursday at 7:15 PM', 'pool');
  await email.sendPromotionEmail('test@example.invalid', name);
  return [...captured];
}

test('shared layout and legacy messages include responsive head and Outlook fallback', async () => {
  for (const mail of await samples()) {
    assert.doesNotMatch(mail.text, /@media|email-column|font-family:Arial/);
    assert.match(mail.html, /name="viewport"/);
    assert.match(mail.html, /max-width:600px/);
    assert.match(mail.html, /\[if mso\]/);
    assert.equal((mail.html.match(/<html[\s>]/g) || []).length, 1);
  }
  const mixed = base.createParticipantTable([{ name: 'No email' }, { name: 'Email', email: 'pat@example.invalid' }]);
  assert.match(mixed, />Email<\/th>/);
  assert.equal((mixed.match(/<td /g) || []).length, 4);
});

test('reminder, reset, summary and promotion fit phone and desktop screens', async () => {
  const browser = await chromium.launch({ executablePath: process.env.EMAIL_TEST_BROWSER_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox'] });
  const output = process.env.EMAIL_PREVIEW_DIR;
  if (output) fs.mkdirSync(output, { recursive: true });
  try {
    const mails = await samples();
    for (const [index, mail] of mails.entries()) {
      if (output) fs.writeFileSync(`${output}/email-${index + 1}.html`, mail.html);
      for (const width of [320, 375, 768, 1280]) {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        await page.setContent(mail.html);
        const metrics = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, container: document.querySelector('.email-container').getBoundingClientRect().width }));
        assert.ok(metrics.scroll <= metrics.width + 1, `${mail.subject} overflows ${width}px: ${metrics.scroll}px`);
        assert.ok(metrics.container <= 560 + 1);
        if (index === 2) {
          const display = await page.locator('.email-column').first().evaluate(el => getComputedStyle(el).display);
          assert.equal(display, width <= 600 ? 'block' : 'table-cell');
        }
        if (index === 1 && width <= 600) {
          const height = await page.locator('.email-button').first().evaluate(el => el.getBoundingClientRect().height);
          assert.ok(height >= 44, 'mobile CTA has a usable touch target');
        }
        if (output && [375, 1280].includes(width)) await page.screenshot({ path: `${output}/email-${index + 1}-${width}.png`, fullPage: true });
        await page.close();
      }
    }
  } finally { await browser.close(); }
});
