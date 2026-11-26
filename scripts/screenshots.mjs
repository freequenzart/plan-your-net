import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';

const port = '4174';
const child = spawn(process.execPath, ['scripts/preview.mjs'], {
  env: { ...process.env, PORT: port },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const exited = once(child, 'exit');
let browser;
let timer;
try {
  await new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error('Screenshot preview did not start')), 20000);
    child.once('error', reject);
    child.once('exit', (code) => reject(new Error(`Screenshot preview exited: ${code}`)));
    child.stderr.on('data', (data) => process.stderr.write(data));
    child.stdout.on('data', (data) => {
      if (String(data).includes('Preview:')) resolve();
    });
  });
  clearTimeout(timer);
  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'en-US',
    reducedMotion: 'reduce',
  });
  await context.addInitScript(() => {
    localStorage.setItem('netmap.onboarding.v1', 'seen');
    localStorage.setItem(
      'netmap.preferences.v1',
      JSON.stringify({ language: 'en', theme: 'light' }),
    );
  });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}`);
  await page.locator('.map-device').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await mkdir('docs/images', { recursive: true });
  await page.screenshot({ path: 'docs/images/editor.png' });
  await page.evaluate(() => {
    const application = document.querySelector('plan-your-net-app');
    for (const device of application.state.document.devices)
      application.changePlanning(
        'device',
        device.id,
        'planning.unitPrice',
        device.type === 'server' ? 399 : 79,
      );
    application.changePlanning('device', 'router', 'planning.purchased', true);
    application.changePlanning('device', 'router', 'planning.installed', true);
    application.changePlanning('device', 'switch', 'specifications.ports', 24);
    application.changePlanning('device', 'switch', 'specifications.management', 'managed');
    void application.action('build');
  });
  await page.locator('[data-action="toggle-theme"]').click();
  await page.screenshot({ path: 'docs/images/rollout.png' });
  console.log(
    'Synthetic demo screenshots written to docs/images/. Existing browser profiles were not accessed.',
  );
} finally {
  clearTimeout(timer);
  await browser?.close();
  if (child.exitCode === null) child.kill();
  await exited;
}
