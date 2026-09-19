/* eslint-disable jest/prefer-expect-assertions, jest/no-conditional-in-test, jest/max-expects */
/*
 * JUM-546 — deploy target lifecycle (edit, duplicate, field validation), run
 * in a REAL browser (Playwright WebKit, the engine this repository already
 * pins) against the REAL server. No DOM shims, no fakes (Requirement 115):
 * every gesture below is the click a user makes on the Deploy Management tab.
 *
 * Pins:
 *  - The add gate validates the full candidate — the JUM-546 field rules
 *    (name required/unique, runtime/version pattern, region per target type)
 *    next to the JUM-481 matrix rules — and a rejection is announced on the
 *    JUM-543 status region with the reason, leaving the list untouched.
 *  - Duplicate stores an INDEPENDENT deep copy renamed by the ` (copy)` rule;
 *    editing the copy does not touch the source.
 *  - Edit-in-place loads the entry into the form, saves a validated
 *    replacement, and an edit may keep its own name.
 *  - The region rule is target-type-aware through the real UI: required on a
 *    cloud target (vm), optional on the self-hosted dedicated server.
 *  - The target-type-aware hint and PM2-profile select follow the selected
 *    deploy target (function providers: no PM2 profile applies).
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { webkit } from 'playwright-webkit';
import type { Browser, Page } from 'playwright-webkit';
import {
  createTempConfigDir,
  cleanupTempConfigDir,
  envFileContent,
  startServer,
  clickInPanels,
  openDesignerPanels,
  stopServer,
  waitForServer
} from '../../helpers/serverHarness';
import type { StartedServer } from '../../helpers/serverHarness';

const repoRoot = path.resolve(__dirname, '../../../../..');

/** Boot a page on the Deploy Management tab and wait for the form. */
async function bootDeployTab(context: Awaited<ReturnType<Browser['newContext']>>, baseUrl: string) {
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'load' });
  // JUM-548: first run is intentionally empty — load the sample model so the
  // designer sits in a realistic populated state before switching tabs.
  await clickInPanels(page, '#load-sample-btn');
  await openDesignerPanels(page, '#domain-list');
  await page.waitForSelector('#domain-list li', { timeout: 20000 });
  await page.click('#tab-deploy-management-btn');
  await page.waitForSelector('#add-deploy-target-btn', { timeout: 20000 });
  return page;
}

/** Fill the deploy target form (selects pinned to the matrix spellings). */
async function fillDeployForm(page: Page, values: {
  name: string;
  deployTarget?: string;
  region?: string;
  runtime?: string;
}) {
  await page.fill('#deploy-name-input', values.name);
  if (values.deployTarget) await page.selectOption('#deploy-type-select', values.deployTarget);
  await page.fill('#deploy-region-input', values.region ?? '');
  await page.fill('#deploy-runtime-input', values.runtime ?? '');
}

/** The deploy target list's rendered text. */
async function deployListText(page: Page) {
  return page.$eval('#deploy-target-list', (el) => el.textContent || '');
}

/** The status region's rendered text (the JUM-543 surface). */
async function statusRegionText(page: Page) {
  return page.$eval('#status-region', (el) => el.textContent || '');
}

/** Click the lifecycle button of the list row that contains `rowText`. */
async function clickRowButton(page: Page, rowText: string, buttonText: string) {
  await page.waitForFunction(
    ({ expectedRow, expectedButton }) => {
      const rows = Array.from(document.querySelectorAll('#deploy-target-list li'));
      return rows.some((row) => (row.textContent || '').includes(String(expectedRow))
        && Array.from(row.querySelectorAll('button'))
          .some((button) => (button.textContent || '').trim() === String(expectedButton)));
    },
    { expectedRow: rowText, expectedButton: buttonText },
    { timeout: 10000 }
  );
  await page.evaluate(({ expectedRow, expectedButton }) => {
    const row = Array.from(document.querySelectorAll('#deploy-target-list li'))
      .find((candidate) => (candidate.textContent || '').includes(String(expectedRow)));
    const button = Array.from(row?.querySelectorAll('button') || [])
      .find((candidate) => (candidate.textContent || '').trim() === String(expectedButton));
    button?.click();
  }, { expectedRow: rowText, expectedButton: buttonText });
}

describe('serviceManagement deploy target lifecycle (JUM-546)', () => {
  let tempDir: string;
  let server: StartedServer | undefined;
  let browser: Browser | undefined;
  let baseUrl: string;

  beforeAll(async () => {
    // The SPA resolves `@jumentix/cana` to the vendored bundle; regenerate it
    // so the suite never boots against a stale or absent artifact.
    execFileSync('bun', ['apps/service-management/scripts/sync-service-management-cana-bundle.js'], {
      cwd: repoRoot,
      stdio: 'inherit'
    });
    tempDir = createTempConfigDir({ '.env.dev': envFileContent('express') });
    server = await startServer(tempDir);
    await waitForServer(server.port);
    baseUrl = `http://127.0.0.1:${String(server.port)}/`;
    browser = await webkit.launch({ headless: true });
  }, 120000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
    stopServer(server);
    cleanupTempConfigDir(tempDir);
  });

  it('adds a validated target and rejects an invalid runtime with the reason on the status surface', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    const page = await bootDeployTab(context, baseUrl);

    await fillDeployForm(page, {
      name: 'alpha-vm', deployTarget: 'vm', region: 'us-east-1', runtime: 'nodejs22.x'
    });
    await page.click('#add-deploy-target-btn');
    await page.waitForFunction(
      () => (document.getElementById('deploy-target-list')?.textContent || '').includes('alpha-vm'),
      undefined,
      { timeout: 10000 }
    );
    await expect(deployListText(page)).resolves.toContain('alpha-vm');

    // Free-text runtime: rejected with the pattern reason; list untouched.
    await fillDeployForm(page, {
      name: 'bad-runtime', deployTarget: 'vm', region: 'us-east-1', runtime: 'latest'
    });
    await page.click('#add-deploy-target-btn');
    await page.waitForFunction(
      () => (document.getElementById('status-region')?.textContent || '').includes('not a valid runtime/version'),
      undefined,
      { timeout: 10000 }
    );
    await expect(statusRegionText(page)).resolves.toContain('Runtime/version "latest" is not a valid runtime/version');
    await expect(deployListText(page)).resolves.not.toContain('bad-runtime');

    await context.close();
  }, 120000);

  it('rejects a duplicate name and a missing region on cloud targets', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    const page = await bootDeployTab(context, baseUrl);

    await fillDeployForm(page, {
      name: 'alpha-vm', deployTarget: 'vm', region: 'us-east-1', runtime: 'nodejs22.x'
    });
    await page.click('#add-deploy-target-btn');
    await page.waitForFunction(
      () => (document.getElementById('deploy-target-list')?.textContent || '').includes('alpha-vm'),
      undefined,
      { timeout: 10000 }
    );

    // Same name again (different case): uniqueness, case-insensitive.
    await fillDeployForm(page, {
      name: 'Alpha-VM', deployTarget: 'ec2', region: 'eu-west-1', runtime: 'nodejs22.x'
    });
    await page.click('#add-deploy-target-btn');
    await page.waitForFunction(
      () => (document.getElementById('status-region')?.textContent || '').includes('already exists'),
      undefined,
      { timeout: 10000 }
    );
    await expect(statusRegionText(page)).resolves.toContain('A deploy target named "Alpha-VM" already exists');
    await expect(deployListText(page)).resolves.not.toContain('eu-west-1');

    // Cloud target without a region: the per-type region rule names the target.
    await fillDeployForm(page, {
      name: 'regionless-vm', deployTarget: 'vm', region: '', runtime: 'nodejs22.x'
    });
    await page.click('#add-deploy-target-btn');
    await page.waitForFunction(
      () => (document.getElementById('status-region')?.textContent || '').includes('Region is required'),
      undefined,
      { timeout: 10000 }
    );
    await expect(statusRegionText(page)).resolves.toContain('Region is required for cloud deploy target "vm"');
    await expect(deployListText(page)).resolves.not.toContain('regionless-vm');

    await context.close();
  }, 120000);

  it('duplicates as an independent " (copy)" and edits the copy in place without touching the source', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    const page = await bootDeployTab(context, baseUrl);

    await fillDeployForm(page, {
      name: 'alpha-vm', deployTarget: 'vm', region: 'us-east-1', runtime: 'nodejs22.x'
    });
    await page.click('#add-deploy-target-btn');
    await page.waitForFunction(
      () => (document.getElementById('deploy-target-list')?.textContent || '').includes('alpha-vm'),
      undefined,
      { timeout: 10000 }
    );

    // Duplicate: the copy appears under the " (copy)" renaming rule.
    await clickRowButton(page, 'alpha-vm', 'Duplicate');
    await page.waitForFunction(
      () => (document.getElementById('deploy-target-list')?.textContent || '').includes('alpha-vm (copy)'),
      undefined,
      { timeout: 10000 }
    );
    await expect(deployListText(page)).resolves.toContain('alpha-vm (copy)');

    // Edit the copy in place: rename + move region; the source stays intact.
    await clickRowButton(page, 'alpha-vm (copy)', 'Edit');
    await page.waitForFunction(
      () => (document.getElementById('deploy-name-input') as HTMLInputElement | null)?.value === 'alpha-vm (copy)',
      undefined,
      { timeout: 10000 }
    );
    await expect(page.$eval('#add-deploy-target-btn', (el) => el.textContent)).resolves.toBe('Save Target');
    await page.fill('#deploy-name-input', 'alpha-vm-eu');
    await page.fill('#deploy-region-input', 'eu-west-1');
    await page.click('#add-deploy-target-btn');
    await page.waitForFunction(
      () => (document.getElementById('deploy-target-list')?.textContent || '').includes('alpha-vm-eu'),
      undefined,
      { timeout: 10000 }
    );
    const list = await deployListText(page);
    expect(list).toContain('alpha-vm-eu');
    expect(list).toContain('eu-west-1');
    expect(list).toContain('alpha-vm | vm');
    expect(list).toContain('us-east-1');
    expect(list).not.toContain('alpha-vm (copy)');
    // The form returned to add mode after the save.
    await expect(page.$eval('#add-deploy-target-btn', (el) => el.textContent)).resolves.toBe('Add Target');

    // Duplicating twice counts up: " (copy)", then " (copy 2)".
    await clickRowButton(page, 'alpha-vm | vm', 'Duplicate');
    await page.waitForFunction(
      () => (document.getElementById('deploy-target-list')?.textContent || '').includes('alpha-vm (copy)'),
      undefined,
      { timeout: 10000 }
    );
    await clickRowButton(page, 'alpha-vm | vm', 'Duplicate');
    await page.waitForFunction(
      () => (document.getElementById('deploy-target-list')?.textContent || '').includes('alpha-vm (copy 2)'),
      undefined,
      { timeout: 10000 }
    );
    await expect(deployListText(page)).resolves.toContain('alpha-vm (copy 2)');

    await context.close();
  }, 120000);

  it('lets an edit keep its own name and keeps region optional on the self-hosted target', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    const page = await bootDeployTab(context, baseUrl);

    // Self-hosted dedicated server: no provider region required.
    await fillDeployForm(page, {
      name: 'home-lab', deployTarget: 'dedicated-server', region: '', runtime: 'nodejs22.x'
    });
    await page.click('#add-deploy-target-btn');
    await page.waitForFunction(
      () => (document.getElementById('deploy-target-list')?.textContent || '').includes('home-lab'),
      undefined,
      { timeout: 10000 }
    );
    await expect(deployListText(page)).resolves.toContain('home-lab');

    // Edit keeping the same name (only the runtime changes): not a duplicate
    // of itself.
    await clickRowButton(page, 'home-lab', 'Edit');
    await page.waitForFunction(
      () => (document.getElementById('deploy-name-input') as HTMLInputElement | null)?.value === 'home-lab',
      undefined,
      { timeout: 10000 }
    );
    await page.fill('#deploy-runtime-input', 'nodejs24.x');
    await page.click('#add-deploy-target-btn');
    await page.waitForFunction(
      () => (document.getElementById('deploy-target-list')?.textContent || '').includes('nodejs24.x'),
      undefined,
      { timeout: 10000 }
    );
    const list = await deployListText(page);
    expect(list).toContain('home-lab');
    expect(list).toContain('nodejs24.x');
    expect(list.match(/home-lab/g)).toHaveLength(1);

    await context.close();
  }, 120000);

  it('follows the selected deploy target with the field hint and the PM2-profile select', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    const page = await bootDeployTab(context, baseUrl);

    // PM2-managed default row: hint asks for host information, PM2 enabled.
    await expect(page.$eval('#deploy-field-hint', (el) => el.textContent || '')).resolves.toContain('host');
    await expect(page.$eval('#deploy-pm2-profile-select', (el) => (el as HTMLSelectElement).disabled)).resolves.toBe(false);

    // Function provider: hint asks for the runtime/version, PM2 disabled and
    // cleared — a PM2 profile does not apply.
    await page.selectOption('#deploy-type-select', 'lambda');
    await page.waitForFunction(
      () => (document.getElementById('deploy-field-hint')?.textContent || '').includes('runtime/version'),
      undefined,
      { timeout: 10000 }
    );
    await expect(page.$eval('#deploy-field-hint', (el) => el.textContent || '')).resolves.toContain('no PM2 profile applies');
    await expect(page.$eval('#deploy-pm2-profile-select', (el) => (el as HTMLSelectElement).disabled)).resolves.toBe(true);
    await expect(page.$eval('#deploy-pm2-profile-select', (el) => (el as HTMLSelectElement).value)).resolves.toBe('');

    await context.close();
  }, 120000);
});
