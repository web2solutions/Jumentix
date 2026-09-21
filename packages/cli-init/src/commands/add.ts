/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { writeInitConfig, type InitConfig } from '../config';
import {
  generateBackendService,
  generateFrontend,
  injectDesignerDomains,
  buildManifestJson,
  buildProjectJson,
  sha256File,
  writeBaselineObjects,
  writeDomainModule,
  writeModulesIndex,
  patchI18nTitles,
  patchRouterHome,
  resolveBackendTemplateRoot,
  sanitizeServiceId,
  slugifyIdentifier,
  pascalCaseName
} from '../generators';
import {
  resolveSources,
  SourceResolutionError,
  type GenerationPlan,
  type PlanDomain,
  type PlanService
} from '../sources';

const PROJECT_META = '.jumentix/project.json';
const MANIFEST_META = '.jumentix/manifest.json';
const INIT_CONFIG = 'jumentix.init.json';

type ProjectDocument = {
  schemaVersion: number;
  cliVersion: string;
  template: { version: number; commit: string };
  mode: GenerationPlan['mode'];
  plan: GenerationPlan;
  createdAt: string;
  updatedAt: string;
};

type ManifestDocument = {
  schemaVersion: number;
  generatedAt: string;
  files: Record<string, { sha256: string }>;
};

export type AddFlags = {
  from?: string;
  domains?: string;
  service?: string;
  force?: boolean;
  offline?: boolean;
};

export function printAddHelp(log: (message?: string) => void = console.log): void {
  log(`
jumentix add <domain|service|frontend> [name] [options]

Extend a generated Jumentix project (Req 037 v2 / JUM-850).

Subcommands:
  add domain <name> [--from …] [--service <id>] [--force]
  add service <name> --domains a,b [--force]
  add frontend [--offline] [--force]

Requires .jumentix/project.json (created by jumentix init). Refuses when
manifest files were edited unless --force is set.
`);
}

function readCliVersion(packageRoot: string): string {
  try {
    const raw = fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8');
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version && parsed.version !== '0.0.0' ? parsed.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function loadProjectDocument(rootDir: string): ProjectDocument {
  const projectPath = path.join(rootDir, ...PROJECT_META.split('/'));
  if (!fs.existsSync(projectPath)) {
    throw new Error(
      `Missing ${PROJECT_META}. Run this command inside a project created by `
      + '`jumentix init` (or pass the project directory as cwd).'
    );
  }
  return JSON.parse(fs.readFileSync(projectPath, 'utf8')) as ProjectDocument;
}

function loadManifestDocument(rootDir: string): ManifestDocument | null {
  const manifestPath = path.join(rootDir, ...MANIFEST_META.split('/'));
  if (!fs.existsSync(manifestPath)) return null;
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as ManifestDocument;
}

function loadInitAnswers(rootDir: string): InitConfig {
  const initPath = path.join(rootDir, INIT_CONFIG);
  if (!fs.existsSync(initPath)) return {};
  return JSON.parse(fs.readFileSync(initPath, 'utf8')) as InitConfig;
}

function findManifestDrift(rootDir: string, manifest: ManifestDocument): string[] {
  const drifted: string[] = [];
  for (const [rel, meta] of Object.entries(manifest.files || {})) {
    const absolute = path.join(rootDir, ...rel.split('/'));
    if (!fs.existsSync(absolute)) {
      drifted.push(rel);
    } else if (sha256File(absolute) !== meta.sha256) {
      drifted.push(rel);
    }
  }
  return drifted.sort();
}

function assertNoDrift(
  rootDir: string,
  force: boolean,
  log: (message?: string) => void
): number | null {
  const manifest = loadManifestDocument(rootDir);
  if (!manifest || force) return null;
  const drifted = findManifestDrift(rootDir, manifest);
  if (drifted.length === 0) return null;
  const preview = drifted.slice(0, 8).join('\n  - ');
  const extra = drifted.length > 8
    ? `\n  - …and ${drifted.length - 8} more`
    : '';
  log(
    [
      `Refusing to add: ${drifted.length} generated file(s) differ from ${MANIFEST_META}`,
      '(pass --force to overwrite):',
      `  - ${preview}${extra}`
    ].join('\n')
  );
  return 1;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function persistProjectState(
  rootDir: string,
  project: ProjectDocument,
  plan: GenerationPlan,
  answers: InitConfig
): void {
  const now = new Date().toISOString();
  const packageRoot = path.resolve(__dirname, '..', '..');
  writeJson(
    path.join(rootDir, ...PROJECT_META.split('/')),
    buildProjectJson({
      cliVersion: project.cliVersion || readCliVersion(packageRoot),
      templateCommit: project.template?.commit || '',
      templateSchemaVersion: project.template?.version,
      plan,
      createdAt: project.createdAt || now,
      updatedAt: now
    })
  );

  writeInitConfig(rootDir, {
    ...answers,
    mode: plan.mode,
    frontend: Boolean(plan.frontend || plan.mode === 'hybrid' || plan.mode === 'frontend'),
    offline: Boolean(plan.frontend?.offline || answers.offline),
    projectName: answers.projectName || path.basename(rootDir)
  });

  const manifest = buildManifestJson(rootDir);
  writeJson(path.join(rootDir, ...MANIFEST_META.split('/')), manifest);
  writeBaselineObjects(rootDir, manifest.files);
}

function coreService(plan: GenerationPlan): PlanService {
  return plan.services.find((service) => service.kind === 'core') || plan.services[0];
}

function findService(plan: GenerationPlan, serviceId: string | undefined): PlanService {
  if (!serviceId) {
    const core = coreService(plan);
    if (!core) {
      throw new Error('Generation plan has no services to receive the domain.');
    }
    return core;
  }
  const match = plan.services.find((service) => service.id === serviceId);
  if (!match) {
    throw new Error(`Unknown service id "${serviceId}". Known: ${plan.services.map((s) => s.id).join(', ')}`);
  }
  return match;
}

function domainMatches(domain: PlanDomain, name: string): boolean {
  const needle = name.trim().toLowerCase();
  return domain.id.toLowerCase() === needle
    || String(domain.name || '').toLowerCase() === needle
    || slugifyIdentifier(domain.name || domain.id) === slugifyIdentifier(name);
}

function createStubDomain(name: string): PlanDomain {
  const entityName = pascalCaseName(name);
  const id = `domain-${slugifyIdentifier(name, 'domain')}`;
  return {
    id,
    name: entityName,
    entities: [
      {
        name: entityName,
        schema: {
          type: 'object',
          'x-primary-key': 'id',
          'x-domain': entityName,
          'x-entity': entityName,
          required: ['id', 'name'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' }
          }
        },
        primaryKey: 'id',
        relations: [],
        operations: []
      }
    ]
  };
}

async function resolveDomainFromSource(
  name: string,
  from: string,
  plan: GenerationPlan
): Promise<{ domain: PlanDomain; oasSlice?: Record<string, unknown> }> {
  const sourcePlan = await resolveSources({
    from,
    mode: plan.mode,
    http: coreService(plan)?.interfaces.http,
    realtime: coreService(plan)?.interfaces.realtime,
    db: coreService(plan)?.db
  });
  const domain = sourcePlan.domains.find((entry) => domainMatches(entry, name));
  if (!domain) {
    throw new Error(
      `Domain "${name}" not found in --from=${from}. `
      + `Available: ${sourcePlan.domains.map((entry) => entry.name || entry.id).join(', ') || '(none)'}`
    );
  }
  const owner = sourcePlan.services.find((service) => (
    service.domains.includes(domain.id) || service.domains.includes(String(domain.name || ''))
  )) || sourcePlan.services.find((service) => service.kind === 'core');
  const oasSlice = owner ? sourcePlan.contracts.oasPerService[owner.id] : undefined;
  return { domain, oasSlice };
}

function writeServiceOas(rootDir: string, service: PlanService, plan: GenerationPlan): void {
  const oas = plan.contracts.oasPerService[service.id];
  if (!oas) return;
  const serviceRoot = path.join(rootDir, 'apps', sanitizeServiceId(service.id));
  const specDir = path.join(serviceRoot, 'spec');
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, '1.0.0.yml'), stringifyYaml(oas), 'utf8');
}

async function refreshFrontendModules(
  rootDir: string,
  plan: GenerationPlan,
  log: (message?: string) => void
): Promise<void> {
  const frontendRoot = path.join(rootDir, 'apps', 'frontend');
  if (!fs.existsSync(frontendRoot)) return;

  const oasPath = path.join(frontendRoot, 'src', 'contracts', 'openapi.json');
  let oas: Record<string, unknown> = { paths: {}, components: { schemas: {} } };
  if (fs.existsSync(oasPath)) {
    oas = JSON.parse(fs.readFileSync(oasPath, 'utf8')) as Record<string, unknown>;
  }

  const modules = plan.domains.map((domain) => writeDomainModule(frontendRoot, domain, oas));
  writeModulesIndex(frontendRoot, modules);
  patchI18nTitles(frontendRoot, modules);
  patchRouterHome(frontendRoot, modules[0]?.moduleId);
  log(`Frontend modules refreshed (${modules.map((mod) => mod.moduleId).join(', ') || 'none'}).`);
}

async function addDomain(options: {
  rootDir: string;
  name: string;
  flags: AddFlags;
  project: ProjectDocument;
  answers: InitConfig;
  log: (message?: string) => void;
}): Promise<number> {
  const {
    rootDir,
    name,
    flags,
    project,
    answers,
    log
  } = options;
  const plan: GenerationPlan = structuredClone(project.plan);

  if (plan.domains.some((domain) => domainMatches(domain, name))) {
    throw new Error(`Domain "${name}" already exists in ${PROJECT_META}.`);
  }

  let domain: PlanDomain;
  let oasSlice: Record<string, unknown> | undefined;
  if (flags.from) {
    const resolved = await resolveDomainFromSource(name, flags.from, plan);
    domain = resolved.domain;
    oasSlice = resolved.oasSlice;
  } else {
    domain = createStubDomain(name);
  }

  const target = findService(plan, flags.service);
  plan.domains.push(domain);
  if (!target.domains.includes(domain.id)) {
    target.domains.push(domain.id);
  }
  if (oasSlice) {
    plan.contracts.oasPerService[target.id] = {
      ...(plan.contracts.oasPerService[target.id] || {}),
      ...oasSlice,
      paths: {
        ...((plan.contracts.oasPerService[target.id]?.paths as Record<string, unknown>) || {}),
        ...((oasSlice.paths as Record<string, unknown>) || {})
      }
    };
  }

  const serviceRoot = path.join(rootDir, 'apps', sanitizeServiceId(target.id));
  if (!fs.existsSync(serviceRoot)) {
    throw new Error(`Service app missing at apps/${sanitizeServiceId(target.id)}. Re-run init or add service first.`);
  }

  const injected = await injectDesignerDomains({ serviceRoot, plan, service: target });
  writeServiceOas(rootDir, target, plan);
  log(
    `Injected domain "${domain.name || domain.id}" into apps/${sanitizeServiceId(target.id)} `
    + `(modules=${injected.moduleNames.join(', ') || 'none'}).`
  );

  if (plan.frontend) {
    const modules = new Set(plan.frontend.modules || []);
    modules.add(domain.name || domain.id);
    plan.frontend = { ...plan.frontend, modules: [...modules] };
  }
  await refreshFrontendModules(rootDir, plan, log);
  persistProjectState(rootDir, project, plan, answers);
  return 0;
}

async function addService(options: {
  rootDir: string;
  name: string;
  flags: AddFlags;
  project: ProjectDocument;
  answers: InitConfig;
  log: (message?: string) => void;
}): Promise<number> {
  const {
    rootDir,
    name,
    flags,
    project,
    answers,
    log
  } = options;
  const plan: GenerationPlan = structuredClone(project.plan);

  if (plan.mode !== 'services' && plan.mode !== 'hybrid') {
    throw new Error(
      `add service requires mode=services (or hybrid). Current mode=${plan.mode}.`
    );
  }

  const domainTokens = String(flags.domains || '')
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
  if (domainTokens.length === 0) {
    throw new Error('add service requires --domains=a,b (comma-separated domain ids or names).');
  }

  const serviceId = sanitizeServiceId(name);
  if (plan.services.some((service) => service.id === serviceId)) {
    throw new Error(`Service "${serviceId}" already exists in the plan.`);
  }

  const moved: PlanDomain[] = [];
  for (const token of domainTokens) {
    const domain = plan.domains.find((entry) => domainMatches(entry, token));
    if (!domain) {
      throw new Error(
        `Unknown domain "${token}". Known: ${plan.domains.map((entry) => entry.name || entry.id).join(', ')}`
      );
    }
    moved.push(domain);
  }

  const template = coreService(plan);
  const newService: PlanService = {
    id: serviceId,
    kind: 'domain',
    url: `http://localhost:${3000 + plan.services.length}/api/1.0.0`,
    domains: moved.map((domain) => domain.id),
    interfaces: {
      http: template?.interfaces.http || 'express',
      realtime: template?.interfaces.realtime || 'none'
    },
    db: template?.db || 'sqlite'
  };

  for (const service of plan.services) {
    service.domains = service.domains.filter(
      (id) => !moved.some((domain) => domain.id === id || domain.name === id)
    );
  }
  plan.services.push(newService);

  // Move OAS slice ownership: copy core OAS as a starting point when missing.
  if (!plan.contracts.oasPerService[serviceId] && template) {
    plan.contracts.oasPerService[serviceId] = structuredClone(
      plan.contracts.oasPerService[template.id] || { openapi: '3.1.0', paths: {} }
    );
  }

  const packageRoot = path.resolve(__dirname, '..', '..');
  const templateRoot = resolveBackendTemplateRoot(packageRoot);
  const projectName = answers.projectName || path.basename(rootDir);
  const generated = await generateBackendService({
    plan,
    service: newService,
    outputDir: rootDir,
    projectName,
    jumentixVersion: readCliVersion(packageRoot),
    templateRoot,
    log
  });
  log(`Generated service ${generated.packageName} at ${generated.root}.`);

  // Re-inject domains on services that retained ownership changes (core).
  for (const service of plan.services) {
    if (service.id !== serviceId) {
      const serviceRoot = path.join(rootDir, 'apps', sanitizeServiceId(service.id));
      if (fs.existsSync(serviceRoot)) {
        // eslint-disable-next-line no-await-in-loop
        await injectDesignerDomains({ serviceRoot, plan, service });
        writeServiceOas(rootDir, service, plan);
      }
    }
  }

  persistProjectState(rootDir, project, plan, answers);
  return 0;
}

async function addFrontend(options: {
  rootDir: string;
  flags: AddFlags;
  project: ProjectDocument;
  answers: InitConfig;
  log: (message?: string) => void;
}): Promise<number> {
  const {
    rootDir,
    flags,
    project,
    answers,
    log
  } = options;
  const plan: GenerationPlan = structuredClone(project.plan);
  const frontendRoot = path.join(rootDir, 'apps', 'frontend');

  if (fs.existsSync(frontendRoot)) {
    throw new Error('Frontend already exists at apps/frontend.');
  }

  if (plan.mode === 'frontend') {
    throw new Error('Project mode is already frontend.');
  }

  const offline = Boolean(flags.offline || answers.offline);
  plan.frontend = {
    modules: plan.domains.map((domain) => domain.name || domain.id),
    offline
  };
  if (plan.mode === 'monolith' || plan.mode === 'services') {
    plan.mode = 'hybrid';
  }

  const projectName = answers.projectName || path.basename(rootDir);
  const result = await generateFrontend({
    plan,
    outputDir: rootDir,
    projectName,
    log
  });
  log(
    `Frontend generated at ${result.root} `
    + `(modules=${result.modules.map((mod) => mod.moduleId).join(', ') || 'none'}, `
    + `offline=${result.offline ? 'yes' : 'no'}).`
  );

  persistProjectState(rootDir, project, plan, {
    ...answers,
    frontend: true,
    offline,
    mode: plan.mode
  });
  return 0;
}

export async function runAdd(options: {
  subcommand: string;
  positional: string[];
  help: boolean;
  flags?: AddFlags;
  workingDirectory?: string;
  log?: (message?: string) => void;
}): Promise<number> {
  const {
    subcommand,
    positional,
    help,
    flags = {},
    workingDirectory = process.cwd(),
    log = console.log
  } = options;

  if (help || !subcommand) {
    printAddHelp(log);
    return help ? 0 : 1;
  }

  const rootDir = path.resolve(workingDirectory);
  let project: ProjectDocument;
  try {
    project = loadProjectDocument(rootDir);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`\nError: ${message}`);
    return 1;
  }

  const driftCode = assertNoDrift(rootDir, Boolean(flags.force), log);
  if (driftCode !== null) return driftCode;

  const answers = loadInitAnswers(rootDir);
  const name = positional[1] || '';

  try {
    if (subcommand === 'domain') {
      if (!name) {
        log('Error: add domain requires a <name> argument.');
        return 1;
      }
      return await addDomain({
        rootDir,
        name,
        flags,
        project,
        answers,
        log
      });
    }
    if (subcommand === 'service') {
      if (!name) {
        log('Error: add service requires a <name> argument.');
        return 1;
      }
      return await addService({
        rootDir,
        name,
        flags,
        project,
        answers,
        log
      });
    }
    if (subcommand === 'frontend') {
      return await addFrontend({
        rootDir,
        flags,
        project,
        answers,
        log
      });
    }
    log(`Unknown add subcommand "${subcommand}". Expected domain|service|frontend.`);
    printAddHelp(log);
    return 1;
  } catch (error) {
    if (error instanceof SourceResolutionError) {
      log(`\nError: ${error.message}`);
      return error.exitCode;
    }
    const message = error instanceof Error ? error.message : String(error);
    log(`\nError: ${message}`);
    return 1;
  }
}
