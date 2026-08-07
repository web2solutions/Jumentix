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
    designerSources.forEach((relative) => {
      const source = readDesignerSource(relative);
      expect(source).not.toContain('pnpm run');
      expect(source).not.toContain('bun run pm2');
      expect(source).not.toContain('npm run pm2');
      expect(source).not.toContain('pm2:start:');
    });
  });

  it('fetches the real ecosystem through the runtime API instead of a literal map', () => {
    const script = readDesignerSource('script.js');
    expect(script).toContain('/api/runtime/pm2-ecosystem');
    const inspectors = readDesignerSource('src/ui/inspectors.js');
    // The old hardcoded profile map is gone; the preview derives commands.
    expect(inspectors).not.toContain('runtimeProfiles');
    expect(inspectors).toContain('getPm2EcosystemPreview');
    expect(inspectors).toContain('--only');
  });

  it('offers a preview environment per ecosystem the repository defines', () => {
    const html = readDesignerSource('index.html');
    const selectMatch = html.match(/<select id="pm2-preview-environment-select">([\s\S]*?)<\/select>/);
    expect(selectMatch).not.toBeNull();
    const options = Array.from(selectMatch![1].matchAll(/value="([^"]+)"/g), (m) => m[1]);
    expect(options).toStrictEqual(['dev', 'staging', 'production']);
  });

  it('names the exact env file the next save writes (per-file targeting)', () => {
    const html = readDesignerSource('index.html');
    expect(html).toContain('id="runtime-env-target-file"');
    const script = readDesignerSource('script.js');
    expect(script).toContain('Editing target:');
  });

  it('keeps the server ecosystem mapping aligned with the repository files', () => {
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
