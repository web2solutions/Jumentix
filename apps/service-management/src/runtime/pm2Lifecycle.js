/**
 * pm2Lifecycle — PM2 process lifecycle rules for the service manager
 * (JUM-770).
 *
 * Three rules live here, each pure enough to unit-test without a PM2 daemon:
 *
 *  1. Config-file recognition mirrors pm2's own `Common.isConfigFile`
 *     (node_modules/pm2/lib/Common.js): only .json/.yml/.yaml/.config.js/
 *     .config.cjs/.config.mjs are treated as ecosystem declarations. A file
 *     like `ecosystem.dev.cjs` is NOT a config file for pm2 — `pm2 start`
 *     falls back to launching it as a script, ignores `--only` and reports a
 *     phantom success. That is the root cause this module exists to prevent
 *     from ever coming back: ecosystem files must carry a `.config.*` name.
 *
 *  2. Start verification: after any start, the process list is re-read and
 *     the requested name must be present. PM2 answers "ok" for the phantom
 *     case above, so the daemon's answer alone is never trusted.
 *
 *  3. Self-guard: the service manager serves the UI these actions come from,
 *     so stopping/restarting/deleting itself would kill the console
 *     mid-action. Targeted self-actions are refused with an explicit error;
 *     namespace bulk actions silently skip the manager and report the skip.
 */

// Mirror of pm2's Common.knonwConfigFileExtensions (sic — the upstream map is
// misspelled). Keep in step with node_modules/pm2/lib/Common.js.
const PM2_CONFIG_FILE_EXTENSIONS = {
  '.json': 'json',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.config.js': 'js',
  '.config.cjs': 'js',
  '.config.mjs': 'mjs'
};

function isPm2ConfigFile(filename) {
  if (typeof filename !== 'string') return null;
  for (const extension of Object.keys(PM2_CONFIG_FILE_EXTENSIONS)) {
    if (filename.indexOf(extension) !== -1) {
      return PM2_CONFIG_FILE_EXTENSIONS[extension];
    }
  }
  return null;
}

// jumentix-<env>-service-management, including the api variant
// (jumentix-<env>-service-management-api) and any further suffix.
const SERVICE_MANAGER_NAME_PATTERN = /^jumentix-.+-service-management(-.+)?$/;

function isServiceManagerProcess(name) {
  return SERVICE_MANAGER_NAME_PATTERN.test(String(name || ''));
}

function selfGuardError(action, name) {
  const error = new Error(
    `Refused: "${name}" is the service manager itself. The service manager cannot ${action} `
    + 'itself — doing so would kill this console mid-action. Restart it manually from a shell '
    + '(e.g. `pm2 restart ' + String(name) + '`).'
  );
  error.code = 'SELF_ACTION_BLOCKED';
  return error;
}

function startVerifyError(name) {
  const error = new Error(
    `Start of "${name}" did not register a PM2 process — the process is absent from `
    + '`pm2 list` after the start call. Refusing to report a success that did not happen.'
  );
  error.code = 'START_VERIFY_FAILED';
  return error;
}

function matchesTarget(processEntry, request, target) {
  return Boolean(processEntry) && (
    (request?.name && processEntry.name === request.name)
    || (request?.pmId != null && processEntry.pmId === Number(request.pmId))
    || processEntry.name === String(target)
    || processEntry.pmId === Number(target)
  );
}

/**
 * @param {Object} deps
 * @param {(runtime: string) => string} deps.normalizeEnvironment
 * @param {(environment: string) => Object} deps.readEcosystem - readPm2Ecosystem
 * @param {() => Promise<Array>} deps.listProcesses - normalized pm2 list
 * @param {(method: string, ...args: unknown[]) => Promise<unknown>} deps.runMethod
 */
function createPm2ActionRunner(deps) {
  const normalizeEnvironment = deps.normalizeEnvironment;
  const readEcosystem = deps.readEcosystem;
  const listProcesses = deps.listProcesses;
  const runMethod = deps.runMethod;

  async function verifyStarted(name) {
    const live = await listProcesses();
    if (!live.some((entry) => entry.name === name)) {
      throw startVerifyError(name);
    }
  }

  return async function runPm2Action(request) {
    const action = String(request?.action || '');
    const scope = String(request?.scope || 'process');
    const environment = normalizeEnvironment(request?.environment || 'dev');
    // Self-guard first (JUM-770): stop/restart/delete aimed at the service
    // manager itself is refused with an explicit reason — even `delete`,
    // which is otherwise unsupported, must fail with the self-guard message
    // rather than a generic "unsupported" when the target is the manager.
    if (['stop', 'restart', 'delete'].includes(action)
      && scope === 'process'
      && isServiceManagerProcess(request?.name)) {
      throw selfGuardError(action, String(request.name));
    }
    if (!['start', 'stop', 'restart'].includes(action)) {
      const error = new Error(`Unsupported PM2 action: ${action}`);
      error.code = 'UNSUPPORTED_PM2_ACTION';
      throw error;
    }
    if (scope === 'process') {
      const target = request?.name || request?.pmId;
      if (target === undefined || target === null || target === '') {
        const error = new Error('Process action requires name or pmId.');
        error.code = 'INVALID_PM2_TARGET';
        throw error;
      }
      const live = await listProcesses();
      const existing = live.find((entry) => matchesTarget(entry, request, target));
      const targetName = String(request?.name || existing?.name || target);
      if (action !== 'start' && (isServiceManagerProcess(targetName)
        || isServiceManagerProcess(existing?.name))) {
        throw selfGuardError(action, isServiceManagerProcess(targetName) ? targetName : existing.name);
      }
      if (action === 'start') {
        if (existing) {
          // Already registered (e.g. stopped): start by name, not ecosystem --only.
          await runMethod('start', String(existing.name || existing.pmId));
          await verifyStarted(String(existing.name || existing.pmId));
          return undefined;
        }
        const ecosystem = readEcosystem(environment);
        const onlyName = String(request?.name || target);
        if (ecosystem.exists && request?.name) {
          await runMethod('start', ecosystem.path, { only: onlyName });
          await verifyStarted(onlyName);
          return undefined;
        }
        if (!ecosystem.exists) {
          await runMethod('start', String(target));
          await verifyStarted(targetName);
          return undefined;
        }
        const error = new Error(
          `Process "${onlyName}" is not in the PM2 list and cannot be started from the ecosystem without a name.`
        );
        error.code = 'INVALID_PM2_TARGET';
        throw error;
      }
      await runMethod(action, target);
      return undefined;
    }
    if (scope === 'namespace') {
      const namespace = String(request?.namespace || 'default');
      const list = (await listProcesses())
        .filter((processEntry) => processEntry.namespace === namespace);
      // The service manager is never part of a stop/restart batch: killing it
      // would kill this console before the batch even finished. It is skipped
      // and reported, never silently dropped.
      const guarded = action === 'start'
        ? { runnable: list, skipped: [] }
        : {
          runnable: list.filter((processEntry) => !isServiceManagerProcess(processEntry.name)),
          skipped: list.filter((processEntry) => isServiceManagerProcess(processEntry.name))
            .map((processEntry) => processEntry.name)
        };
      for (const processEntry of guarded.runnable) {
        const target = processEntry.name || processEntry.pmId;
        // Namespace start operates on processes already listed — start by name.
        await runMethod(action === 'start' ? 'start' : action, String(target));
      }
      return {
        affected: guarded.runnable.length,
        skipped: guarded.skipped
      };
    }
    if (scope === 'ecosystem-missing') {
      const name = String(request?.name || '');
      if (!name) {
        const error = new Error('ecosystem-missing start requires name.');
        error.code = 'INVALID_PM2_TARGET';
        throw error;
      }
      const ecosystem = readEcosystem(environment);
      if (!ecosystem.exists) {
        const error = new Error(`Ecosystem file missing for ${environment}.`);
        error.code = 'ECOSYSTEM_MISSING';
        throw error;
      }
      await runMethod('start', ecosystem.path, { only: name });
      await verifyStarted(name);
      return undefined;
    }
    const error = new Error(`Unsupported PM2 action scope: ${scope}`);
    error.code = 'UNSUPPORTED_PM2_SCOPE';
    throw error;
  };
}

module.exports = {
  PM2_CONFIG_FILE_EXTENSIONS,
  SERVICE_MANAGER_NAME_PATTERN,
  isPm2ConfigFile,
  isServiceManagerProcess,
  createPm2ActionRunner
};
