import fs from 'node:fs';
import path from 'node:path';
import type { GenerationPlan } from '../sources/types';
import {
  patchI18nTitles,
  patchRouterHome,
  writeDomainModule,
  writeModulesIndex,
  type GeneratedModuleResult
} from './frontendModules';
import {
  mergeServiceOas,
  oasPathCount,
  type JsonObject
} from './frontendOas';
import {
  resolveFrontendTemplateRoot,
  sanitizePackageScope
} from './paths';

type OasDoc = JsonObject;

export type GenerateFrontendOptions = {
  plan: GenerationPlan;
  /** Workspace root (services/frontend land under `apps/`). */
  outputDir: string;
  /** npm scope from project name (`@<project>/frontend`). */
  projectName: string;
  /** Pin for `@jumentix/*` deps (defaults to package version). */
  jumentixVersion?: string;
  /** Override template root (tests). */
  templateRoot?: string;
  /** Destination folder under apps/ (default: frontend). */
  appFolder?: string;
  log?: (message?: string) => void;
};

export type GenerateFrontendResult = {
  root: string;
  packageName: string;
  modules: GeneratedModuleResult[];
  offline: boolean;
  bakedPaths: number;
  envPath: string;
};

const FRONTEND_JUMENTIX_DEPS = Object.freeze([
  '@jumentix/cana',
  '@jumentix/cana-vue',
  '@jumentix/persistence-contracts',
  '@jumentix/sdk-rest-client'
]);

function readCliVersion(packageRoot: string): string {
  try {
    const raw = fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8');
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version && parsed.version !== '0.0.0' ? parsed.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function copyFrontendTemplate(templateRoot: string, destRoot: string): void {
  const walk = (srcDir: string, rel = ''): void => {
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    for (const entry of entries) {
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      const normalized = relPath.replace(/\\/g, '/');
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destRoot, ...normalized.split('/'));
      if (entry.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        walk(srcPath, normalized);
      } else {
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(srcPath, destPath);
      }
    }
  };
  fs.mkdirSync(destRoot, { recursive: true });
  walk(templateRoot);
}

function writeFrontendPackageJson(
  frontendRoot: string,
  projectName: string,
  jumentixVersion: string
): string {
  const pkgPath = path.join(frontendRoot, 'package.json');
  let pkg: Record<string, unknown> = {};
  if (fs.existsSync(pkgPath)) {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as Record<string, unknown>;
  }
  const scope = sanitizePackageScope(projectName);
  const packageName = `@${scope}/frontend`;
  pkg.name = packageName;
  pkg.version = '0.0.0';
  pkg.private = true;

  const dependencies = (pkg.dependencies && typeof pkg.dependencies === 'object'
    ? { ...(pkg.dependencies as Record<string, string>) }
    : {}) as Record<string, string>;
  for (const name of FRONTEND_JUMENTIX_DEPS) {
    if (dependencies[name] !== undefined) {
      dependencies[name] = jumentixVersion;
    }
  }
  pkg.dependencies = dependencies;
  pkg.jumentix = {
    generated: true,
    kind: 'frontend'
  };
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  return packageName;
}

/**
 * Bake merged OAS into `src/contracts/openapi.json`.
 * When the plan's filtered OAS has no paths (common for the Users preset
 * fixture before `x-service` annotations), keep the seed contract already
 * copied from the template.
 */
export function bakeMergedOas(
  frontendRoot: string,
  plan: GenerationPlan
): { bakedPaths: number; keptTemplate: boolean } {
  const outputPath = path.join(frontendRoot, 'src', 'contracts', 'openapi.json');
  const merged = mergeServiceOas(plan.contracts.oasPerService) as OasDoc;
  const pathCount = oasPathCount(merged);

  if (pathCount === 0) {
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
      return { bakedPaths: 0, keptTemplate: false };
    }
    const existing = JSON.parse(fs.readFileSync(outputPath, 'utf8')) as OasDoc;
    return { bakedPaths: oasPathCount(existing), keptTemplate: true };
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  return { bakedPaths: pathCount, keptTemplate: false };
}

function readBundledOas(frontendRoot: string): OasDoc {
  const outputPath = path.join(frontendRoot, 'src', 'contracts', 'openapi.json');
  if (!fs.existsSync(outputPath)) return { paths: {}, components: { schemas: {} } };
  return JSON.parse(fs.readFileSync(outputPath, 'utf8')) as OasDoc;
}

function coreServiceUrl(plan: GenerationPlan): string {
  const core = plan.services.find((service) => service.kind === 'core') || plan.services[0];
  return core?.url || 'http://localhost:3000/api/1.0.0';
}

function proxyTargetFromApiUrl(apiUrl: string): string {
  try {
    const parsed = new URL(apiUrl);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return 'http://localhost:3010';
  }
}

/**
 * Write `.env` with Core/service URLs and the offline flag.
 */
export function writeFrontendEnv(
  frontendRoot: string,
  plan: GenerationPlan,
  offline: boolean
): string {
  const coreUrl = coreServiceUrl(plan);
  const proxyTarget = proxyTargetFromApiUrl(coreUrl);
  const targets: Record<string, string> = {};
  for (const service of plan.services) {
    const url = service.url || coreUrl;
    targets[service.id] = proxyTargetFromApiUrl(url);
  }

  const lines = [
    '# Generated by @jumentix/cli-init (JUM-848)',
    `VITE_API_BASE_URL=${coreUrl}`,
    `VITE_API_PROXY_TARGET=${proxyTarget}`,
    `VITE_API_PROXY_TARGETS=${JSON.stringify(targets)}`,
    'VITE_DEV_PORT=3001',
    `VITE_CORE_URL=${coreUrl}`,
    `VITE_OFFLINE=${offline ? '1' : '0'}`,
    `VITE_PWA=${offline ? '1' : '0'}`
  ];

  for (const service of plan.services) {
    const key = `VITE_SERVICE_${sanitizePackageScope(service.id).replace(/-/g, '_').toUpperCase()}_URL`;
    lines.push(`${key}=${service.url || coreUrl}`);
  }
  lines.push('');

  const envPath = path.join(frontendRoot, '.env');
  fs.writeFileSync(envPath, `${lines.join('\n')}\n`, 'utf8');
  return envPath;
}

/**
 * When `--offline` is off, disable the Cana boot path in main.ts and drop
 * offline Cypress specs so the seed stays online-only.
 */
export function applyOfflineFlag(frontendRoot: string, offline: boolean): void {
  if (offline) return;

  const mainPath = path.join(frontendRoot, 'src', 'main.ts');
  if (fs.existsSync(mainPath)) {
    let source = fs.readFileSync(mainPath, 'utf8');
    source = source.replace(
      /import \{ bootCana, exposeCanaTestHooks \} from '@\/data\/db';\n/,
      ''
    );
    source = source.replace(/import \{ registerSW \} from '@\/data\/pwa';\n/, '');
    source = source.replace(/import \{ bindOnlineReplay \} from '@\/data\/sync';\n/, '');
    source = source.replace(
      /const boot = await bootCana\(\);\nexposeCanaTestHooks\(\);\nif \(boot === 'ok'\) \{\n {2}bindOnlineReplay\(\);\n {2}registerSW\(\);\n\}\napp\.provide\('canaBoot', boot\);\n/,
      'const boot = \'unavailable\' as const;\napp.provide(\'canaBoot\', boot);\n'
    );
    fs.writeFileSync(mainPath, source, 'utf8');
  }

  const cypressE2e = path.join(frontendRoot, 'cypress', 'e2e');
  if (fs.existsSync(cypressE2e)) {
    for (const entry of fs.readdirSync(cypressE2e)) {
      if (entry.startsWith('offline-') && entry.endsWith('.cy.ts')) {
        fs.rmSync(path.join(cypressE2e, entry), { force: true });
      }
    }
  }
}

/**
 * Generate `apps/frontend` from the packaged seed + GenerationPlan.
 */
export async function generateFrontend(
  options: GenerateFrontendOptions
): Promise<GenerateFrontendResult> {
  const {
    plan,
    outputDir,
    projectName,
    appFolder = 'frontend',
    log = () => undefined
  } = options;

  if (!plan.frontend && plan.mode !== 'hybrid' && plan.mode !== 'frontend') {
    throw new Error(
      'Frontend generation failed: GenerationPlan has no frontend section '
      + '(pass --frontend or --mode=hybrid|frontend).'
    );
  }

  const packageRoot = path.resolve(__dirname, '..', '..');
  const templateRoot = options.templateRoot || resolveFrontendTemplateRoot(packageRoot);
  const jumentixVersion = options.jumentixVersion || readCliVersion(packageRoot);
  const scope = sanitizePackageScope(projectName);
  const offline = Boolean(plan.frontend?.offline);

  const frontendRoot = path.join(outputDir, 'apps', appFolder);
  if (fs.existsSync(frontendRoot)) {
    fs.rmSync(frontendRoot, { recursive: true, force: true });
  }

  log(`Generating frontend → apps/${appFolder} (offline=${offline ? 'yes' : 'no'})`);
  copyFrontendTemplate(templateRoot, frontendRoot);
  const packageName = writeFrontendPackageJson(frontendRoot, scope, jumentixVersion);
  const { bakedPaths } = bakeMergedOas(frontendRoot, plan);
  const oas = readBundledOas(frontendRoot);

  const modules: GeneratedModuleResult[] = [];
  for (const domain of plan.domains) {
    modules.push(writeDomainModule(frontendRoot, domain, oas));
  }
  writeModulesIndex(frontendRoot, modules);
  patchI18nTitles(frontendRoot, modules);
  patchRouterHome(frontendRoot, modules[0]?.moduleId);

  const envPath = writeFrontendEnv(frontendRoot, plan, offline);
  applyOfflineFlag(frontendRoot, offline);

  log(
    `Frontend generation wrote ${modules.length} module(s), `
    + `${bakedPaths} OAS path(s) baked.`
  );

  return {
    root: frontendRoot,
    packageName,
    modules,
    offline,
    bakedPaths,
    envPath
  };
}
