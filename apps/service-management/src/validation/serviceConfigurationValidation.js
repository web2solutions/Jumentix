/**
 * serviceConfigurationValidation — the Service Configuration tab's
 * validation rules (JUM-544), extracted as a pure function so the JUM-470
 * Bun/jest suite can exercise them with no DOM shim.
 *
 * Rules:
 *  1. Vocabulary — `serviceKind`, `runMode` and `cloudProvider` must be
 *     values the storage schema (Requirement 126) and the UI selects know.
 *  2. Ports — every port the selected service kind actually binds must be an
 *     integer in 1–65535, and no two active ports may collide. Inactive
 *     ports (e.g. gRPC on a `rest-api` service) are ignored.
 *  3. Run-mode × cloud-provider — the combination must exist in the
 *     Requirement 059 deploy matrix, read from the shared reader
 *     (`src/model/deployCapabilityMatrix.js`), never transcribed here.
 *
 * Every issue is severity `error`: an invalid profile cannot be saved. The
 * save gate (`script.js`) and the status renderer (`src/ui/inspectors.js`)
 * consume this list; the function itself never touches the DOM.
 *
 * @typedef {Object} ModelIssue
 * @property {string} message
 * @property {?string} entityId - always null here; kept for shape parity
 *   with `collectModelIssues`.
 * @property {'error'|'warn'|'info'} severity
 */

import {
  CLOUD_PROVIDERS,
  RUN_MODES,
  SERVICE_KINDS,
  getActivePortNames,
  getSupportedProviders,
  isRunModeSupportedByProvider
} from '../model/deployCapabilityMatrix.js';

const PORT_LABELS = {
  rest: 'REST',
  websocket: 'WebSocket',
  grpc: 'gRPC'
};

/**
 * @param {*} value - raw port input (number or string).
 * @returns {boolean} true when the value is an integer in 1–65535.
 */
function isValidPort(value) {
  if (value === null || value === undefined || value === '') return false;
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 1 && numeric <= 65535;
}

/**
 * Collect every Service Configuration issue for a candidate profile.
 *
 * @param {Object} config - `{ serviceKind, runMode, cloudProvider, ports }`;
 *   `staticAssetsPath` is unconstrained and not validated.
 * @returns {ModelIssue[]}
 */
export function collectServiceConfigurationIssues(config) {
  const issues = [];
  const pushError = (message) => issues.push({ message, entityId: null, severity: 'error' });
  const candidate = config || {};
  const serviceKind = String(candidate.serviceKind || '');
  const runMode = String(candidate.runMode || '');
  const cloudProvider = String(candidate.cloudProvider || '');
  const ports = candidate.ports || {};

  if (!SERVICE_KINDS.includes(serviceKind)) {
    pushError(`Service kind "${serviceKind}" is not supported — choose one of: ${SERVICE_KINDS.join(', ')}.`);
  }
  if (!RUN_MODES.includes(runMode)) {
    pushError(`Run mode "${runMode}" is not supported — choose one of: ${RUN_MODES.join(', ')}.`);
  }
  if (!CLOUD_PROVIDERS.includes(cloudProvider)) {
    pushError(`Cloud provider "${cloudProvider}" is not supported — choose one of: ${CLOUD_PROVIDERS.join(', ')}.`);
  }

  const activePortNames = getActivePortNames(serviceKind);
  const activePorts = activePortNames.map((name) => ({ name, value: ports[name] }));
  activePorts.forEach(({ name, value }) => {
    if (!isValidPort(value)) {
      pushError(`${PORT_LABELS[name]} port must be an integer between 1 and 65535 (got "${value ?? ''}").`);
    }
  });
  const portOwners = new Map();
  activePorts.forEach(({ name, value }) => {
    if (!isValidPort(value)) return;
    const numeric = Number(value);
    if (portOwners.has(numeric)) {
      pushError(
        `${PORT_LABELS[portOwners.get(numeric)]} and ${PORT_LABELS[name]} ports both use ${numeric} — each protocol needs a distinct port.`
      );
      return;
    }
    portOwners.set(numeric, name);
  });

  if (RUN_MODES.includes(runMode) && CLOUD_PROVIDERS.includes(cloudProvider)
    && !isRunModeSupportedByProvider(runMode, cloudProvider)) {
    pushError(
      `Run mode "${runMode}" cannot run on provider "${cloudProvider}" — the Requirement 059 deploy matrix supports it on: ${getSupportedProviders(runMode).join(', ')}.`
    );
  }

  return issues;
}
