/**
 * deployTargetLifecycleValidation — the Deploy Management lifecycle rules
 * (JUM-546), extracted as pure functions so the JUM-470 Bun/jest suite can
 * exercise them with no DOM shim.
 *
 * The split against `deployTargetValidation.js` (JUM-481) is the one both
 * modules declare in their headers: JUM-481 owns WHAT a target may contain
 * (the Requirement 059 vocabularies and matrix consistency); this module owns
 * HOW targets are managed — the field-level rules that gate add and
 * edit-in-place, the duplicate naming semantics, and the target-type-aware
 * field hints:
 *
 *  1. Name — required and unique across the registered targets
 *     (case-insensitive, as the rest of the designer compares names).
 *  2. Runtime/version — required and matching a name-plus-version pattern
 *     (for example `nodejs22.x`, `python3.12`).
 *  3. Region — required on cloud deploy targets; optional on the self-hosted
 *     Dedicated Server (SSH) row, where the field may carry host information
 *     instead. The self-hosted set is read from the shared matrix reader
 *     (`src/model/deployCapabilityMatrix.js`), never transcribed here.
 *  4. Duplicate — a duplicated target is a deep copy renamed by the
 *     ` (copy)` / ` (copy N)` rule until the name is unique; it is
 *     independently editable, never a shared reference.
 *
 * Every issue is severity `error`: an invalid candidate is not added and an
 * invalid edit is not saved. The add/edit gate (`script.js`) consumes this
 * list next to `collectDeployTargetIssues` and reports the messages on the
 * JUM-543 status surface; the functions themselves never touch the DOM.
 *
 * @typedef {Object} ModelIssue
 * @property {string} message
 * @property {?string} entityId - always null here; kept for shape parity
 *   with `collectModelIssues`.
 * @property {'error'|'warn'|'info'} severity
 */

import {
  DEPLOY_TARGETS,
  isPm2ManagedDeployTarget,
  isSelfHostedDeployTarget
} from '../model/deployCapabilityMatrix.js';

/**
 * The runtime/version shape: a runtime name followed by a version, with
 * optional dotted segments and the provider wildcard (`nodejs22.x`,
 * `node20`, `python3.12`, `bun1.3.13`). Free-text values like `latest` —
 * or a bare version with no runtime name — tell the operator nothing about
 * what the target runs and are rejected.
 *
 * The name body excludes `.` on purpose: dots appear only as version-segment
 * separators, which keeps every dotted position attributable to exactly one
 * branch of the pattern — overlapping repetitions here are a polynomial
 * backtracking (ReDoS) surface.
 */
export const RUNTIME_VERSION_PATTERN = /^[A-Za-z][A-Za-z0-9+_-]*\d(\.[A-Za-z0-9+_-]+)*$/;

const RUNTIME_EXAMPLE = 'nodejs22.x';

/**
 * Collect the field-level lifecycle issues for a candidate deploy target —
 * the rules JUM-546 gates add and edit-in-place on, complementary to the
 * matrix-content rules of `collectDeployTargetIssues`.
 *
 * @param {Object} candidate - the normalised target shape (`{ name, region,
 *   runtime, deployTarget, ... }`).
 * @param {Array} [existingDeployments] - the registered targets the name must
 *   be unique against.
 * @param {Object} [options]
 * @param {?number} [options.excludeIndex] - index into `existingDeployments`
 *   of the entry being edited, so an edit that keeps its own name is not
 *   flagged as a duplicate of itself.
 * @returns {ModelIssue[]}
 */
export function collectDeployTargetFieldIssues(candidate, existingDeployments = [], options = {}) {
  const issues = [];
  const pushError = (message) => issues.push({ message, entityId: null, severity: 'error' });
  const target = candidate || {};
  const existing = Array.isArray(existingDeployments) ? existingDeployments : [];
  const excludeIndex = Number.isInteger(options?.excludeIndex) ? options.excludeIndex : null;

  const name = String(target.name || '').trim();
  const region = String(target.region || '').trim();
  const runtime = String(target.runtime || '').trim();
  const deployTarget = String(target.deployTarget || '').trim();

  if (!name) {
    pushError('Deploy target name is required.');
  } else {
    const duplicate = existing.some((entry, index) => index !== excludeIndex
      && String(entry?.name || '').trim().toLowerCase() === name.toLowerCase());
    if (duplicate) {
      pushError(`A deploy target named "${name}" already exists — target names must be unique.`);
    }
  }

  if (!runtime) {
    pushError(`Runtime/version is required — use a name plus version, like "${RUNTIME_EXAMPLE}".`);
  } else if (!RUNTIME_VERSION_PATTERN.test(runtime)) {
    pushError(`Runtime/version "${runtime}" is not a valid runtime/version — use a name plus version, like "${RUNTIME_EXAMPLE}".`);
  }

  // Region is required on cloud targets; the self-hosted Dedicated Server
  // (SSH) row has no provider region — the field may carry host information
  // instead (see deployTargetFieldHint). An unknown/empty target stays on the
  // required path: the JUM-481 vocabulary rule names that problem, and a
  // cloud-looking entry without a region must not slip through.
  if (!region && !isSelfHostedDeployTarget(deployTarget)) {
    pushError(deployTarget
      ? `Region is required for cloud deploy target "${deployTarget}" — enter the provider region, like "us-east-1".`
      : 'Region is required for cloud deploy targets — enter the provider region, like "us-east-1".');
  }

  return issues;
}

/**
 * The duplicate renaming rule: ` (copy)` on the first duplicate of a name,
 * then ` (copy 2)`, ` (copy 3)`, … until the name is unique against the
 * registered targets (case-insensitive). Deterministic, so the operator can
 * predict the name of a repeated duplication.
 *
 * @param {string} baseName - the source target's name.
 * @param {Array} [existingNames] - names already registered.
 * @returns {string} the first free ` (copy)`-suffixed name.
 */
export function duplicateDeployTargetName(baseName, existingNames = []) {
  const taken = new Set((Array.isArray(existingNames) ? existingNames : [])
    .map((value) => String(value || '').trim().toLowerCase()));
  const base = String(baseName || '').trim() || 'target';
  let candidate = `${base} (copy)`;
  let counter = 2;
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${base} (copy ${counter})`;
    counter += 1;
  }
  return candidate;
}

/**
 * The target-type-aware field hint shown under the Deploy Management form
 * (JUM-546 scope 3): PM2-managed targets (VM/dedicated rows) need host
 * information in the region field and a PM2 profile; provider-managed
 * function targets need a runtime/version and carry no PM2 profile.
 *
 * @param {string} deployTarget
 * @returns {string} the hint text for the selected deploy target.
 */
export function deployTargetFieldHint(deployTarget) {
  const target = String(deployTarget || '').trim();
  if (isPm2ManagedDeployTarget(target)) {
    return `PM2-managed target (${target}): record the host in the region field — an SSH host or instance address — and choose a PM2 profile.`;
  }
  if (DEPLOY_TARGETS.includes(target)) {
    return `Provider-managed function target (${target}): the runtime/version selects the provider runtime (like "${RUNTIME_EXAMPLE}") and the region is the provider region — no PM2 profile applies.`;
  }
  if (!target) {
    return 'Choose a deploy target from the Requirement 059 matrix to see its field requirements.';
  }
  return `Deploy target "${target}" is not a Requirement 059 matrix row — the entry stays flagged until corrected.`;
}
