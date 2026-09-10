/* eslint-disable jest/prefer-expect-assertions */
import fs from 'fs';
import path from 'path';

/**
 * JUM-734 — the entry points that start Service Management must vendor first.
 *
 * The SPA resolves `@jumentix/cana` and `@jumentix/designer-core/` through the
 * import map in `index.html`, pointing at `apps/service-management/vendor/`.
 * That directory is gitignored and generated. Before this wiring, a fresh clone
 * ran `dev:service-management`, the server started, the shell rendered, and
 * every panel stayed inert behind repeated `/vendor/...` 404s — a failure that
 * looks like a broken designer rather than a missing build step.
 *
 * The test pins the wiring rather than the command text: any entry point that
 * starts the Service Management process must run the vendor step first.
 */
describe('service management vendor wiring', () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8')
  ) as { scripts: Record<string, string> };

  const VENDOR_SCRIPT = 'service-management:vendor';

  it('declares one script that generates both vendored bundles', () => {
    expect.hasAssertions();

    const vendor = manifest.scripts[VENDOR_SCRIPT];

    expect(vendor).toBeDefined();
    expect(vendor).toContain('sync-service-management-cana-bundle.js');
    expect(vendor).toContain('sync-service-management-designer-core.js');
    expect(vendor).toContain('sync-service-management-d3.js');
  });

  it('names generator scripts that exist on disk', () => {
    expect.hasAssertions();

    const referenced = manifest.scripts[VENDOR_SCRIPT]
      .split('&&')
      .map((part) => part.trim().replace(/^bun\s+/, ''))
      .filter((part) => part.endsWith('.js'));

    expect(referenced).toHaveLength(3);
    referenced.forEach((script) => {
      expect(fs.existsSync(path.resolve(process.cwd(), script))).toBe(true);
    });
  });

  const startsDesigner = Object.entries(manifest.scripts).filter(([name, command]) => {
    const isVendorScript = name === VENDOR_SCRIPT;
    const launchesProcess = /pm2 start/.test(command);
    const targetsDesigner = /jumentix-dev-service-management|apps\/service-management\/server\.js/
      .test(command);
    return !isVendorScript && launchesProcess && targetsDesigner;
  });

  const withoutVendorStep = startsDesigner
    .filter(([, command]) => !command.includes(`bun run ${VENDOR_SCRIPT}`))
    .map(([name]) => name);

  it('finds the entry points that start the designer', () => {
    expect.hasAssertions();

    expect(startsDesigner.length).toBeGreaterThan(0);
  });

  it('runs the vendor step from every one of them', () => {
    expect.hasAssertions();

    expect(withoutVendorStep).toStrictEqual([]);
  });
});
