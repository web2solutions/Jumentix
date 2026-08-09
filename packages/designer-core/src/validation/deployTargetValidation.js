/**
 * deployTargetValidation — the Deploy Management tab's validation rules
 * (JUM-481), extracted as a pure function so the JUM-470 Bun/jest suite can
 * exercise them with no DOM shim.
 *
 * Rules:
 *  1. Vocabulary — `serviceType`, `deployTarget`, `runtimeProtocol`,
 *     `databaseDriver`, `keyValueDriver` and `pm2Profile` must be values the
 *     Requirement 059 metadata contract (and the storage schema, Requirement
 *     126 Contract 2) knows.
 *  2. Service-type × deploy-target — the combination must exist as a row in
 *     the Requirement 059 Deploy Target Matrix, read from the shared reader
 *     (`src/model/deployCapabilityMatrix.js`), never transcribed here.
 *  3. Runtime protocol — the protocol must be one the service type actually
 *     exposes (a `restapi` service has no WebSocket/gRPC listener).
 *  4. PM2 profile — required on PM2-managed targets (Dedicated Server, VM
 *     rows of the matrix) and forbidden on function targets: a functions
 *     deploy target with a PM2 profile is a design the matrix cannot build.
 *
 * Field-level lifecycle validation (name required/unique, runtime/version
 * pattern, region per target type) lives in
 * `deployTargetLifecycleValidation.js` (JUM-546); this module owns what a
 * deploy target may contain.
 *
 * Every issue is severity `error`: an invalid target is not added. The add
 * gate (`script.js`) consumes this list; the function itself never touches
 * the DOM.
 *
 * @typedef {Object} ModelIssue
 * @property {string} message
 * @property {?string} entityId - always null here; kept for shape parity
 *   with `collectModelIssues`.
 * @property {'error'|'warn'|'info'} severity
 */

import {
  DATABASE_DRIVERS,
  DEPLOY_TARGETS,
  KEY_VALUE_DRIVERS,
  PM2_PROFILES,
  RUNTIME_PROTOCOLS,
  SERVICE_TYPES,
  getSupportedProtocols,
  getSupportedServiceTypes,
  isPm2ManagedDeployTarget,
  isProtocolSupportedByServiceType,
  isServiceTypeSupportedByDeployTarget
} from '../model/deployCapabilityMatrix.js';

/**
 * Collect every Deploy Management issue for a candidate deploy target.
 *
 * @param {Object} target - `{ serviceType, deployTarget, runtimeProtocol,
 *   databaseDriver, keyValueDriver, pm2Profile }` (`name`/`region`/`runtime`
 *   are unconstrained here).
 * @returns {ModelIssue[]}
 */
export function collectDeployTargetIssues(target) {
  const issues = [];
  const pushError = (message) => issues.push({ message, entityId: null, severity: 'error' });
  const candidate = target || {};
  const serviceType = String(candidate.serviceType || '');
  const deployTarget = String(candidate.deployTarget || '');
  const runtimeProtocol = String(candidate.runtimeProtocol || '');
  const databaseDriver = String(candidate.databaseDriver || '');
  const keyValueDriver = String(candidate.keyValueDriver || '');
  const pm2Profile = String(candidate.pm2Profile || '');

  if (!SERVICE_TYPES.includes(serviceType)) {
    pushError(`Service type "${serviceType}" is not supported — choose one of: ${SERVICE_TYPES.join(', ')}.`);
  }
  if (!DEPLOY_TARGETS.includes(deployTarget)) {
    pushError(`Deploy target "${deployTarget}" is not supported — choose one of: ${DEPLOY_TARGETS.join(', ')}.`);
  }
  if (!RUNTIME_PROTOCOLS.includes(runtimeProtocol)) {
    pushError(`Runtime protocol "${runtimeProtocol}" is not supported — choose one of: ${RUNTIME_PROTOCOLS.join(', ')}.`);
  }
  if (!DATABASE_DRIVERS.includes(databaseDriver)) {
    pushError(`Database driver "${databaseDriver}" is not a supported JUMENTIX_DATABASE_DRIVER value — choose one of: ${DATABASE_DRIVERS.join(', ')}.`);
  }
  if (!KEY_VALUE_DRIVERS.includes(keyValueDriver)) {
    pushError(`Key-value driver "${keyValueDriver}" is not a supported JUMENTIX_KEYVALUESTORAGE_DRIVER value — choose one of: ${KEY_VALUE_DRIVERS.join(', ')}.`);
  }

  if (SERVICE_TYPES.includes(serviceType) && DEPLOY_TARGETS.includes(deployTarget)
    && !isServiceTypeSupportedByDeployTarget(serviceType, deployTarget)) {
    pushError(
      `Deploy target "${deployTarget}" cannot run service type "${serviceType}" — the Requirement 059 deploy matrix supports it on: ${DEPLOY_TARGETS.filter((option) => isServiceTypeSupportedByDeployTarget(serviceType, option)).join(', ')}.`
    );
  }

  if (SERVICE_TYPES.includes(serviceType) && RUNTIME_PROTOCOLS.includes(runtimeProtocol)
    && !isProtocolSupportedByServiceType(serviceType, runtimeProtocol)) {
    pushError(
      `Service type "${serviceType}" does not expose protocol "${runtimeProtocol}" — the Requirement 059 deploy matrix gives it: ${getSupportedProtocols(serviceType).join(', ')}.`
    );
  }

  if (DEPLOY_TARGETS.includes(deployTarget)) {
    if (isPm2ManagedDeployTarget(deployTarget) && !PM2_PROFILES.includes(pm2Profile)) {
      pushError(
        `Deploy target "${deployTarget}" is PM2-managed and requires a PM2 profile — choose one of: ${PM2_PROFILES.join(', ')}.`
      );
    }
    if (!isPm2ManagedDeployTarget(deployTarget) && pm2Profile !== '') {
      pushError(
        `Deploy target "${deployTarget}" is provider-managed (serverless), not PM2-managed — a PM2 profile does not apply; leave it empty.`
      );
    }
  }

  return issues;
}
