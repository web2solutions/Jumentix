/* eslint-disable no-console */
import path from 'node:path';
import { writeInitConfig, type InitConfig } from '../config';
import { mapLegacyServiceTypeToMode, type InitFlags } from '../args';
import { run as runLegacyBootstrap } from '../legacy/bootstrap';

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

Until generation ships (JUM-845…849), init maps to the legacy monorepo clone
when --service-type / legacy flags are used, or when --mode=monolith without
--from. Factory generation replaces the clone path in later Issues.
`);
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
    if (!(flags.dir || flags.projectName)) {
      throw new Error('Non-interactive init requires a target directory ([dir] or --project-name).');
    }
  }

  // Factory generation lands in JUM-845…849. Until then, monolith without --from
  // still uses the legacy clone path so the CLI remains usable.
  if ((flags.mode === 'monolith' || !flags.mode) && !flags.from) {
    const projectName = flags.dir || flags.projectName || 'jumentix-app';
    log('Factory template packaging is not shipped yet (JUM-845).');
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
    `Factory generation for mode="${flags.mode || '(none)'}" with --from is not implemented yet `
    + '(JUM-845…849). Use --mode=monolith or legacy --service-type for now.'
  );
}
