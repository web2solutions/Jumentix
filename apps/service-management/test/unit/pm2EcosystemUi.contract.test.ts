/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
/*
 * JUM-480 — Designer-side contract for the PM2 ecosystem preview and the
 * multi-environment editing surface.
 *
 * The acceptance criterion "no package-manager string hardcoded in the
 * designer" is enforced here structurally: the designer sources must not
 * contain a PM2 invocation bound to a package manager (`pnpm run`, `bun run`,
 * `npm run`) nor the `pm2:start:*` script names — the preview derives every
 * command from the real ecosystem files through GET /api/runtime/pm2-ecosystem.
 */
import fs from 'fs';
import path from 'path';

const readDesignerSource = (relative: string): string => fs.readFileSync(path.resolve(process.cwd(), 'apps/service-management', relative), 'utf-8');

describe('service management PM2 preview UI contract (JUM-480)', () => {
  const designerSources = ['script.js', 'index.html', 'src/ui/inspectors.js'];

  it('hardcodes no package-manager PM2 invocation anywhere in the designer', () => {
    expect.hasAssertions();
    designerSources.forEach((relative) => {
      const source = readDesignerSource(relative);
      expect(source).not.toContain('pnpm run');
      expect(source).not.toContain('bun run pm2');
      expect(source).not.toContain('npm run pm2');
      expect(source).not.toContain('pm2:start:');
    });
  });

  it('fetches the real ecosystem through the runtime API instead of a literal map', () => {
    expect.hasAssertions();
    const script = readDesignerSource('script.js');
    expect(script).toContain('/api/runtime/pm2-ecosystem');
    const inspectors = readDesignerSource('src/ui/inspectors.js');
    // The old hardcoded profile map is gone; the preview derives commands.
    expect(inspectors).not.toContain('runtimeProfiles');
    expect(inspectors).toContain('getPm2EcosystemPreview');
    expect(inspectors).toContain('--only');
  });

  it('exposes a dedicated PM2 metrics dashboard backed by WebSocket stream + HTTP one-shot', () => {
    expect.hasAssertions();
    const html = readDesignerSource('index.html');
    const script = readDesignerSource('script.js');
    const monitoringApp = readDesignerSource('src/ui/monitoringApp.js');
    const server = readDesignerSource('server.js');
    const wsHub = readDesignerSource('src/runtime/pm2WsHub.js');
    expect(html).toContain('id="tab-monitoring-btn"');
    expect(html).toContain('id="pm2-metrics-process-list"');
    expect(html).toContain('class="monitoring-health-strip"');
    expect(html).toContain('id="pm2-ws-status"');
    expect(html).toContain('id="host-cpu-gauge"');
    expect(html).toContain('id="pm2-metrics-missing-list"');
    expect(html).toContain('id="pm2-monitoring-command"');
    expect(html).toContain('id="pm2-ns-restart-btn"');
    const d3ImportMap = '"d3": "./vendor/d3/index.js"';
    expect(html).toContain(d3ImportMap);
    expect(html).not.toContain('cdn.jsdelivr');
    expect(html).not.toContain('unpkg.com');
    expect(html).not.toContain('cdnjs.cloudflare');
    expect(script).toContain('createMonitoringController');
    expect(script).not.toContain('/api/runtime/pm2-metrics');
    expect(monitoringApp).toContain('/api/runtime/pm2-ws');
    const quote = String.fromCharCode(39);
    expect(monitoringApp).toContain(`type: ${quote}subscribe${quote}`);
    expect(monitoringApp).toContain(`type: ${quote}action${quote}`);
    expect(monitoringApp).toContain('diskReadBytes');
    expect(server).toContain('/api/runtime/pm2-metrics');
    expect(server).toContain('createPm2WsHub');
    expect(server).toContain('attachProcessDiskIo');
    expect(wsHub).toContain('/api/runtime/pm2-ws');
    expect(wsHub).toContain('createPm2WsHub');
    const charts = readDesignerSource('src/ui/monitoringCharts.js');
    expect(charts).toContain(`from ${quote}d3${quote}`);
    expect(charts).not.toContain('chart.js');
    expect(server).toContain(`|| ${quote}pm2${quote}`);
    expect(server).toContain('pm2.list');
    expect(server).toContain(`source: ${quote}pm2${quote}`);
  });

  it('offers a preview environment per ecosystem the repository defines', () => {
    expect.hasAssertions();
    const html = readDesignerSource('index.html');
    const selectMatch = html.match(/<select id="pm2-preview-environment-select">([\s\S]*?)<\/select>/);
    expect(selectMatch).not.toBeNull();
    const options = Array.from(selectMatch![1].matchAll(/value="([^"]+)"/g), (m) => m[1]);
    expect(options).toStrictEqual(['dev', 'staging', 'production']);
  });

  it('names the exact env file the next save writes (per-file targeting)', () => {
    expect.hasAssertions();
    const html = readDesignerSource('index.html');
    expect(html).toContain('id="runtime-env-target-file"');
    const script = readDesignerSource('script.js');
    expect(script).toContain('Editing target:');
  });

  it('keeps the server ecosystem mapping aligned with the repository files', () => {
    expect.hasAssertions();
    const server = readDesignerSource('server.js');
    expect(server).toContain('dev: \'ecosystem.dev.cjs\'');
    expect(server).toContain('staging: \'ecosystem.staging.cjs\'');
    expect(server).toContain('production: \'ecosystem.production.cjs\'');
    expect(server).toContain('ci: \'ecosystem.ci.cjs\'');
    ['dev', 'staging', 'production'].forEach((environment) => {
      const ecosystemPath = path.resolve(process.cwd(), 'pm2', `ecosystem.${environment}.cjs`);
      expect(fs.existsSync(ecosystemPath)).toBe(true);
    });
  });
});
