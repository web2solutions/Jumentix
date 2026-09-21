import fs from 'node:fs';
import path from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import type { GenerationPlan, PlanService } from '../sources/types';
import { injectDesignerDomains } from './domains';
import { renderEnvDev } from './env';
import { buildServicePackageJson } from './packageJson';
import {
  resolveBackendTemplateRoot,
  sanitizePackageScope,
  sanitizeServiceId
} from './paths';
import { computeUnusedPaths, shouldKeepRelativePath } from './slice';

export type GenerateBackendOptions = {
  plan: GenerationPlan;
  /** Workspace root (e.g. temp/out dir). Services land under `apps/<service>`. */
  outputDir: string;
  /** npm scope from project name (`@<project>/<service>`). */
  projectName: string;
  /** Pin for `@jumentix/*` deps (defaults to package version). */
  jumentixVersion?: string;
  /** Override template root (tests). */
  templateRoot?: string;
  /** Restrict generation to these service ids (default: all). */
  serviceIds?: string[];
  log?: (message?: string) => void;
};

export type GeneratedServiceResult = {
  serviceId: string;
  packageName: string;
  root: string;
  droppedPaths: string[];
  injectedModules: string[];
};

export type GenerateBackendResult = {
  services: GeneratedServiceResult[];
  appsDir: string;
};

function readCliVersion(packageRoot: string): string {
  try {
    const raw = fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8');
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version && parsed.version !== '0.0.0' ? parsed.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function copyTemplateSlice(
  templateRoot: string,
  destRoot: string,
  slice: { http: PlanService['interfaces']['http']; realtime: PlanService['interfaces']['realtime']; db: PlanService['db'] }
): string[] {
  const dropped: string[] = [];
  const unused = new Set(computeUnusedPaths(slice));

  const walk = (srcDir: string, rel = ''): void => {
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    for (const entry of entries) {
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      const normalized = relPath.replace(/\\/g, '/');
      if (!shouldKeepRelativePath(normalized, slice)) {
        dropped.push(normalized);
      } else {
        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(destRoot, ...normalized.split('/'));
        if (entry.isDirectory()) {
          if (unused.has(normalized)) {
            dropped.push(normalized);
          } else {
            fs.mkdirSync(destPath, { recursive: true });
            walk(srcPath, normalized);
          }
        } else {
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          fs.copyFileSync(srcPath, destPath);
        }
      }
    }
  };

  fs.mkdirSync(destRoot, { recursive: true });
  walk(templateRoot);
  return [...new Set(dropped)].sort();
}

function writeFilteredOas(serviceRoot: string, service: PlanService, plan: GenerationPlan): void {
  const oas = plan.contracts.oasPerService[service.id];
  if (!oas) return;
  const specDir = path.join(serviceRoot, 'spec');
  fs.mkdirSync(specDir, { recursive: true });
  const yaml = stringifyYaml(oas);
  fs.writeFileSync(path.join(specDir, '1.0.0.yml'), yaml, 'utf8');
}

function writePackageJson(
  serviceRoot: string,
  service: PlanService,
  projectName: string,
  jumentixVersion: string
): string {
  const pkg = buildServicePackageJson({
    projectName,
    serviceId: service.id,
    jumentixVersion,
    http: service.interfaces.http,
    realtime: service.interfaces.realtime,
    db: service.db
  });
  fs.writeFileSync(
    path.join(serviceRoot, 'package.json'),
    `${JSON.stringify(pkg, null, 2)}\n`,
    'utf8'
  );
  return String(pkg.name);
}

function writeEnvDev(serviceRoot: string, service: PlanService): void {
  const templateEnvPath = path.join(serviceRoot, 'src', 'config', '.env.dev');
  let template = '';
  if (fs.existsSync(templateEnvPath)) {
    template = fs.readFileSync(templateEnvPath, 'utf8');
  }
  const rendered = renderEnvDev({
    http: service.interfaces.http,
    realtime: service.interfaces.realtime,
    db: service.db
  }, template);
  fs.mkdirSync(path.dirname(templateEnvPath), { recursive: true });
  fs.writeFileSync(templateEnvPath, rendered, 'utf8');
}

function writeMinimalTsconfig(serviceRoot: string): void {
  const tsconfigPath = path.join(serviceRoot, 'tsconfig.json');
  if (fs.existsSync(tsconfigPath)) return;
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'commonjs',
      moduleResolution: 'node',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      outDir: 'dist',
      rootDir: 'src',
      baseUrl: '.',
      paths: {
        '@src/*': ['src/*']
      }
    },
    include: ['src/**/*.ts']
  };
  fs.writeFileSync(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`, 'utf8');
}

/**
 * Generate one backend service under `outputDir/apps/<serviceId>`.
 */
export async function generateBackendService(options: {
  plan: GenerationPlan;
  service: PlanService;
  outputDir: string;
  projectName: string;
  jumentixVersion: string;
  templateRoot: string;
  log?: (message?: string) => void;
}): Promise<GeneratedServiceResult> {
  const {
    plan,
    service,
    outputDir,
    projectName,
    jumentixVersion,
    templateRoot,
    log = () => undefined
  } = options;

  const serviceFolder = sanitizeServiceId(service.id);
  const serviceRoot = path.join(outputDir, 'apps', serviceFolder);
  if (fs.existsSync(serviceRoot)) {
    fs.rmSync(serviceRoot, { recursive: true, force: true });
  }
  fs.mkdirSync(serviceRoot, { recursive: true });

  const slice = {
    http: service.interfaces.http,
    realtime: service.interfaces.realtime,
    db: service.db
  };

  log(`Generating backend service "${service.id}" → apps/${serviceFolder}`);
  const droppedPaths = copyTemplateSlice(templateRoot, serviceRoot, slice);
  const packageName = writePackageJson(serviceRoot, service, projectName, jumentixVersion);
  writeEnvDev(serviceRoot, service);
  writeFilteredOas(serviceRoot, service, plan);
  writeMinimalTsconfig(serviceRoot);

  // Core (and every service that boots RestAPI) keeps Users + auth from the seed.
  const injected = await injectDesignerDomains({ serviceRoot, plan, service });

  return {
    serviceId: service.id,
    packageName,
    root: serviceRoot,
    droppedPaths,
    injectedModules: injected.moduleNames
  };
}

/**
 * Generate all (or selected) backend services from a GenerationPlan.
 * Root workspace assembly (package.json / lockfile / manifests) is owned by
 * JUM-849 — this only writes `apps/<service>` stubs.
 */
export async function generateBackend(
  options: GenerateBackendOptions
): Promise<GenerateBackendResult> {
  const {
    plan,
    outputDir,
    projectName,
    serviceIds,
    log = () => undefined
  } = options;

  const packageRoot = path.resolve(__dirname, '..', '..');
  const templateRoot = options.templateRoot || resolveBackendTemplateRoot(packageRoot);
  const jumentixVersion = options.jumentixVersion || readCliVersion(packageRoot);
  const scope = sanitizePackageScope(projectName);

  const selected = serviceIds?.length
    ? plan.services.filter((service) => serviceIds.includes(service.id))
    : plan.services;

  if (selected.length === 0) {
    throw new Error('Backend generation failed: no services selected from GenerationPlan.');
  }

  // Frontend-only plans skip backend generation.
  if (plan.mode === 'frontend') {
    log('Skipping backend generation for mode=frontend.');
    return { services: [], appsDir: path.join(outputDir, 'apps') };
  }

  const appsDir = path.join(outputDir, 'apps');
  fs.mkdirSync(appsDir, { recursive: true });

  const services: GeneratedServiceResult[] = [];
  for (const service of selected) {
    // eslint-disable-next-line no-await-in-loop
    const result = await generateBackendService({
      plan,
      service,
      outputDir,
      projectName: scope,
      jumentixVersion,
      templateRoot,
      log
    });
    services.push(result);
  }

  return { services, appsDir };
}
