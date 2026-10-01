/* eslint-disable no-await-in-loop -- screenshots are captured page by page:
   one navigation + axe pass at a time keeps the WebKit session deterministic. */
/* eslint-disable no-console -- CLI capture script: stdout is its report channel. */
/**
 * Capture the website's product screenshots from the running applications.
 * Every image under public/product/ is produced here, so a refresh
 * is one command against current builds rather than a manual session.
 *
 * Prerequisites (see documentation/COMMERCIAL-EXPERIENCE.md):
 *   - Service Management running (bun apps/service-management/server.js)
 *   - backend-template on InMemory + frontend dev server (vite)
 *
 * Environment:
 *   SERVICE_MANAGEMENT_URL  default http://127.0.0.1:3200
 *   FRONTEND_URL            default http://127.0.0.1:3001
 *   FRONTEND_USERNAME / FRONTEND_PASSWORD  a seeded account (required)
 *   SCREENSHOT_OUT          default <website>/public/product
 *
 * Fixed framing: WebKit, 1440x900 CSS pixels at 2x, dark color scheme.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { webkit } = require('playwright-webkit');

const websiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(websiteRoot, 'public', 'product', 'screenshots.json');
const smUrl = process.env.SERVICE_MANAGEMENT_URL ?? 'http://127.0.0.1:3200';
const feUrl = process.env.FRONTEND_URL ?? 'http://127.0.0.1:3001';
const outDir = process.env.SCREENSHOT_OUT ?? path.join(websiteRoot, 'public', 'product');
const username = process.env.FRONTEND_USERNAME;
const password = process.env.FRONTEND_PASSWORD;

if (!username || !password) {
  console.error('Set FRONTEND_USERNAME and FRONTEND_PASSWORD to a seeded account.');
  process.exitCode = 1;
}

fs.mkdirSync(outDir, { recursive: true });
const viewport = { width: 1440, height: 900 };

async function dismissToasts(page) {
  for (const label of ['Dismiss', 'Close']) {
    const buttons = page.getByRole('button', { name: label, exact: true });
    const count = await buttons.count();
    for (let index = 0; index < count; index += 1) {
      await buttons
        .nth(index)
        .click({ timeout: 1000 })
        .catch(() => undefined);
    }
  }
  await page.evaluate(() => {
    globalThis.document
      .querySelectorAll('[role="status"], .toast, .status-toast')
      .forEach((node) => {
        node.setAttribute('hidden', '');
      });
  });
}

async function shot(page, name) {
  const file = path.join(outDir, name);
  await page.screenshot({ path: file });
  console.log(`[capture] ${path.relative(websiteRoot, file)}`);
}

async function captureServiceManagement(browser) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2, colorScheme: 'dark' });
  await page.goto(smUrl, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Load Sample Model', exact: true }).first().click();
  await page.waitForTimeout(1500);
  await dismissToasts(page);
  await page.evaluate(() => globalThis.window.scrollTo(0, 0));
  await shot(page, 'domain-designer.png');

  // Split the sample into two services so the architecture view shows a link.
  await page.getByRole('tab', { name: 'Architecture', exact: true }).click();
  const architecture = page.locator('#tab-architecture');
  await architecture.getByPlaceholder('Service name').fill('Tasks API');
  await architecture.getByRole('button', { name: 'Add Service', exact: true }).click();
  await page.waitForTimeout(500);
  await architecture
    .locator('#architecture-service-list')
    .getByText('Tasks API', { exact: false })
    .click();
  await page.waitForTimeout(300);
  await page.selectOption('#architecture-inspect-domain', { label: 'Tasks' });
  await page.click('#architecture-move-domain-btn');
  await page.waitForTimeout(500);
  await page.selectOption('#architecture-link-from', { index: 0 });
  await page.selectOption('#architecture-link-to', { index: 1 });
  await architecture.getByRole('button', { name: 'Add Link', exact: true }).click();
  await page.waitForTimeout(800);
  await dismissToasts(page);
  await shot(page, 'architecture-designer.png');

  const tabs = [
    ['OpenAPI', 'openapi-swagger.png'],
    ['Code Workspace', 'code-workspace.png']
  ];
  for (const [tab, file] of tabs) {
    await page.getByRole('tab', { name: tab, exact: true }).click();
    await page.waitForTimeout(2000);
    await dismissToasts(page);
    await shot(page, file);
  }
  await page.close();
}

async function captureFrontend(browser) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2, colorScheme: 'dark' });
  await page.goto(`${feUrl}/#/login`, { waitUntil: 'networkidle' });
  await page.fill('#oas-field-username', username);
  await page.fill('#oas-field-password', password);
  await page.locator('form').evaluate((form) => form.requestSubmit());
  await page.waitForFunction(() => globalThis.window.location.hash.includes('/dashboard'), null, {
    timeout: 30000
  });
  await page.waitForTimeout(1500);
  await shot(page, 'frontend-dashboard.png');
  await page.goto(`${feUrl}/#/m/users/users`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await shot(page, 'frontend-xcrud-users.png');
  await page.close();
}

/**
 * Stamp every manifest entry with the commit just captured, so
 * check-screenshot-freshness.mjs measures staleness from this capture.
 * Captures written elsewhere (SCREENSHOT_OUT) leave the manifest alone.
 */
function stampManifest() {
  if (path.resolve(outDir) !== path.dirname(manifestPath)) return;
  const commit = execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
    cwd: websiteRoot,
    encoding: 'utf8'
  }).trim();
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const entry of manifest.screenshots) entry.capturedAt = commit;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`[capture] screenshots.json capturedAt=${commit}`);
}

const browser = await webkit.launch();
try {
  await captureServiceManagement(browser);
  await captureFrontend(browser);
} finally {
  await browser.close();
}
stampManifest();
