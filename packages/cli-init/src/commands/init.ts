/* eslint-disable no-console */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeInitConfig, type InitConfig } from '../config';
import { mapLegacyServiceTypeToMode, type InitFlags } from '../args';
import { generateBackend } from '../generators';
import { run as runLegacyBootstrap } from '../legacy/bootstrap';
import {
  printPlanSummary,
  resolveSources,
  SourceResolutionError
} from '../sources';

export function printInitHelp(log: (message?: string) => void = console.log): void {
  log(`
jumentix init [dir] [options]

Create a lean Jumentix workspace (Req 037 v2).

Options:
  --mode=<monolith|services|hybrid|frontend>
  --from=<designer-export.json|oas.yml|https://catalog/...>
  --preset=<users>
  --http=<express|fastify|restify>
  --realtime=<none|websocket|grpc>
  --db=<sqlite|postgres|mysql|mongo|inmemory>
  --frontend --offline --git --install
  --config=<jumentix.init.json>
  --non-interactive
  --help

Source resolution (JUM-846) normalizes --from / --preset into a GenerationPlan.
Backend generation (JUM-847) writes apps/<service> slices under the target
directory (workspace assembly lands in C7). Legacy --service-type still clones
the monorepo.
`);
}

function wantsSourceResolution(flags: InitFlags): boolean {
  if (flags.from) return true;
  if (flags.preset) return true;
  // Non-monolith factory modes resolve sources (default preset: users).
  if (flags.mode && flags.mode !== 'monolith') return true;
  return false;
}

export async function runInit(options: {
  flags: InitFlags;
  log?: (message?: string) => void;
  execute?: typeof import('../legacy/bootstrap').runCommand;
  workingDirectory?: string;
}): Promise<number> {
  const {
    flags,
    log = console.log,
    execute,
    workingDirectory = process.cwd()
  } = options;

  if (flags.help) {
    printInitHelp(log);
    return 0;
  }

  if (flags.legacyInvocation || flags.serviceType) {
    log('Deprecated: jumentix-init --service-type maps to `init --mode monolith` (Req 037 v2).');
    const mapped = mapLegacyServiceTypeToMode(flags.serviceType || 'rest');
    log(`Mapped to mode=${mapped.mode} http=${mapped.http}.`);
    const legacyArgv = [
      ...(flags.nonInteractive ? ['--non-interactive'] : []),
      ...(flags.serviceType ? [`--service-type=${flags.serviceType}`] : []),
      ...(flags.projectName || flags.dir
        ? [`--project-name=${flags.projectName || flags.dir}`]
        : []),
      ...(flags.gitBranch ? [`--git-branch=${flags.gitBranch}`] : []),
      ...(typeof flags.installDeps === 'boolean'
        ? [`--install-deps=${flags.installDeps ? 'true' : 'false'}`]
        : []),
      ...(flags.repository ? [`--repo=${flags.repository}`] : [])
    ];
    await runLegacyBootstrap({
      argv: legacyArgv,
      log,
      execute,
      workingDirectory
    });
    const target = flags.projectName || flags.dir;
    if (target) {
      const config: InitConfig = {
        mode: mapped.mode,
        http: mapped.http,
        projectName: target,
        nonInteractive: flags.nonInteractive,
        install: flags.installDeps !== false
      };
      writeInitConfig(path.resolve(workingDirectory, target), config);
    }
    return 0;
  }

  if (flags.nonInteractive) {
    if (!flags.mode && !flags.preset && !flags.from) {
      throw new Error(
        'Non-interactive init requires --mode and/or --preset/--from (or legacy --service-type).'
      );
    }
    if (!(flags.dir || flags.projectName) && !wantsSourceResolution(flags)) {
      throw new Error('Non-interactive init requires a target directory ([dir] or --project-name).');
    }
  }

  if (wantsSourceResolution(flags)) {
    try {
      const plan = await resolveSources({
        from: flags.from,
        preset: flags.preset || (flags.from ? undefined : 'users'),
        mode: flags.mode,
        http: flags.http,
        realtime: flags.realtime,
        db: flags.db,
        frontend: flags.frontend,
        offline: flags.offline
      });
      printPlanSummary(plan, log);

      const projectName = flags.dir || flags.projectName || 'jumentix-app';
      const outputDir = path.isAbsolute(projectName)
        ? projectName
        : path.resolve(workingDirectory, projectName);

      // When no target dir was given, generate into a temp stub so the plan is
      // still exercised (C7 owns full workspace assembly).
      const targetDir = (flags.dir || flags.projectName)
        ? outputDir
        : fs.mkdtempSync(path.join(os.tmpdir(), 'jumentix-init-'));

      if (plan.mode !== 'frontend') {
        const generated = await generateBackend({
          plan,
          outputDir: targetDir,
          projectName: path.basename(targetDir),
          log
        });
        log(
          `Backend generation wrote ${generated.services.length} service(s) under `
          + `${path.join(targetDir, 'apps')}.`
        );
        for (const service of generated.services) {
          log(`  - ${service.packageName} (${service.root})`);
        }
      } else {
        log('Skipping backend generation for mode=frontend.');
      }

      log(
        'Note: .jumentix/project.json and root workspace assembly land in later Issues (C7).'
      );
      return 0;
    } catch (error) {
      if (error instanceof SourceResolutionError) {
        log(`\nError: ${error.message}`);
        return error.exitCode;
      }
      throw error;
    }
  }

  // Monolith without --from/--preset: legacy clone until generation ships.
  if (flags.mode === 'monolith' || !flags.mode) {
    const projectName = flags.dir || flags.projectName || 'jumentix-app';
    log('Falling back to legacy monorepo clone for monolith scaffolding.');
    await runLegacyBootstrap({
      argv: [
        '--non-interactive',
        '--service-type=rest',
        `--project-name=${projectName}`,
        `--install-deps=${flags.install || flags.installDeps ? 'true' : 'false'}`,
        ...(flags.gitBranch ? [`--git-branch=${flags.gitBranch}`] : []),
        ...(flags.repository ? [`--repo=${flags.repository}`] : [])
      ],
      log,
      execute,
      workingDirectory
    });
    writeInitConfig(path.resolve(workingDirectory, projectName), {
      mode: (flags.mode as InitConfig['mode']) || 'monolith',
      http: (flags.http as InitConfig['http']) || 'express',
      preset: flags.preset === 'users' ? 'users' : undefined,
      projectName,
      nonInteractive: flags.nonInteractive,
      install: Boolean(flags.install || flags.installDeps)
    });
    return 0;
  }

  throw new Error(
    `Factory generation for mode="${flags.mode || '(none)'}" is not implemented yet `
    + '(JUM-847+). Pass --from or --preset to resolve a GenerationPlan.'
  );
}
