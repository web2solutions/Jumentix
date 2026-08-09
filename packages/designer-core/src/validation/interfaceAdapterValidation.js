/**
 * interfaceAdapterValidation — the Communication Interface Designer tab's
 * validation rules (JUM-545), extracted as pure functions so the JUM-470
 * Bun/jest suite can exercise them with no DOM shim.
 *
 * Rules:
 *  1. Vocabulary — `type` must be a known interface type and `framework` must
 *     be one the type actually binds, read from the shared reader
 *     (`src/model/interfaceFrameworkMatrix.js`), never transcribed here. The
 *     per-type subset is what keeps a WebSocket adapter from offering the
 *     HTTP framework list (and what keeps the rejected `derby`/`sails`
 *     aliases out — JUM-461's canonical-spelling decision).
 *  2. Entrypoint — must be a TypeScript/JavaScript path under
 *     `src/interface/`, matching the boilerplate's adapter layout
 *     (e.g. `src/interface/HTTP/server.ts`).
 *  3. Controller mapping — must have the `XController.action` shape the
 *     boilerplate's controllers expose (the `<Entity>Controller` class naming
 *     and camelCase action methods of the Users reference controllers and the
 *     generated `adapters/in/http/controllers/<Entity>Controller.ts`).
 *  4. Uniqueness — no two adapters may share the same type + entrypoint pair
 *     (one listener per interface), nor the same controller mapping (one
 *     operation map per controller action). The adapter being edited is
 *     excluded from the duplicate scan via `editingIndex`.
 *
 * Every issue is severity `error`: an invalid adapter is not saved. The add
 * and edit gates (`script.js`, `src/ui/inspectors.js`) consume this list —
 * through the `upsertInterfaceAdapter` gate below — and announce it on the
 * JUM-543 status surface; the functions themselves never touch the DOM.
 *
 * @typedef {Object} ModelIssue
 * @property {string} message
 * @property {?string} entityId - always null here; kept for shape parity
 *   with `collectModelIssues`.
 * @property {'error'|'warn'|'info'} severity
 */

import {
  INTERFACE_TYPES,
  getSupportedFrameworks,
  isFrameworkSupportedByType
} from '../model/interfaceFrameworkMatrix.js';

// Segments are word characters and hyphens only — no dots inside a segment,
// so `..` traversal and hidden files never match.
export const INTERFACE_ENTRYPOINT_PATTERN = /^src\/interface\/[\w-]+(\/[\w-]+)*\.(ts|js)$/;

// `<Entity>Controller.<camelCaseAction>` — the Users reference controllers
// (`UserController.create`, `UserController.getOneById`) and the codegen
// template both follow this shape.
export const CONTROLLER_MAPPING_PATTERN = /^[A-Z][A-Za-z0-9]*Controller\.[a-z][A-Za-z0-9]*$/;

/**
 * Trims the four adapter fields into the persisted record shape
 * `{ type, framework, entrypoint, controller }` — the shape the export
 * bundle (JUM-547) carries; unknown/garbage input degrades to empty strings.
 *
 * @param {?Object} raw
 * @returns {{ type: string, framework: string, entrypoint: string, controller: string }}
 */
export function normalizeInterfaceAdapterInput(raw) {
  const candidate = raw || {};
  return {
    type: String(candidate.type || '').trim(),
    framework: String(candidate.framework || '').trim(),
    entrypoint: String(candidate.entrypoint || '').trim(),
    controller: String(candidate.controller || '').trim()
  };
}

/**
 * Collect every issue for a candidate interface adapter.
 *
 * @param {Object} candidate - `{ type, framework, entrypoint, controller }`.
 * @param {Array} [existingAdapters] - the registered adapters the candidate
 *   is checked against for duplicates.
 * @param {number} [editingIndex] - index of the adapter being edited
 *   (excluded from the duplicate scan); -1 when adding.
 * @returns {ModelIssue[]}
 */
export function collectInterfaceAdapterIssues(candidate, existingAdapters = [], editingIndex = -1) {
  const issues = [];
  const pushError = (message) => issues.push({ message, entityId: null, severity: 'error' });
  const adapter = candidate || {};
  const type = String(adapter.type || '');
  const framework = String(adapter.framework || '');
  const entrypoint = String(adapter.entrypoint || '');
  const controller = String(adapter.controller || '');

  if (!INTERFACE_TYPES.includes(type)) {
    pushError(`Interface type "${type}" is not supported — choose one of: ${INTERFACE_TYPES.join(', ')}.`);
  }
  if (!framework) {
    pushError('Framework/runtime is required.');
  } else if (INTERFACE_TYPES.includes(type) && !isFrameworkSupportedByType(type, framework)) {
    pushError(
      `Framework "${framework}" is not supported for interface type "${type}" — choose one of: ${getSupportedFrameworks(type).join(', ')}.`
    );
  }
  if (!entrypoint) {
    pushError('Entrypoint is required.');
  } else if (!INTERFACE_ENTRYPOINT_PATTERN.test(entrypoint)) {
    pushError(
      `Entrypoint "${entrypoint}" must be a TypeScript/JavaScript path under src/interface/ (e.g. src/interface/HTTP/server.ts).`
    );
  }
  if (!controller) {
    pushError('Controller mapping is required.');
  } else if (!CONTROLLER_MAPPING_PATTERN.test(controller)) {
    pushError(
      `Controller mapping "${controller}" must have the shape XController.action (e.g. UsersController.create).`
    );
  }

  const siblings = (Array.isArray(existingAdapters) ? existingAdapters : [])
    .filter((existing, index) => index !== editingIndex);
  if (type && entrypoint
    && siblings.some((existing) => existing && existing.type === type && existing.entrypoint === entrypoint)) {
    pushError(`Duplicate adapter: interface type "${type}" is already registered at entrypoint "${entrypoint}".`);
  }
  if (controller && siblings.some((existing) => existing && existing.controller === controller)) {
    pushError(`Duplicate controller mapping "${controller}" — another adapter already maps it.`);
  }

  return issues;
}

/**
 * The add/edit gate shared by the tab's add handler (`script.js`) and the
 * edit-in-place save (`src/ui/inspectors.js`): validates the candidate and,
 * only when clean, returns the next adapter list — with the candidate
 * appended (add) or replacing the entry at `editingIndex` (edit in place).
 * On issues the list is left untouched (`adapters: null`).
 *
 * @param {Array} adapters - the currently registered adapters.
 * @param {Object} candidate - normalized `{ type, framework, entrypoint, controller }`.
 * @param {number} [editingIndex] - index to replace; -1 to append.
 * @returns {{ issues: ModelIssue[], adapters: ?Array }}
 */
export function upsertInterfaceAdapter(adapters, candidate, editingIndex = -1) {
  const list = Array.isArray(adapters) ? [...adapters] : [];
  if (editingIndex >= list.length) {
    return {
      issues: [{ message: `Adapter index ${editingIndex} does not exist.`, entityId: null, severity: 'error' }],
      adapters: null
    };
  }
  const issues = collectInterfaceAdapterIssues(candidate, list, editingIndex);
  if (issues.length > 0) return { issues, adapters: null };
  if (editingIndex >= 0) {
    list[editingIndex] = candidate;
  } else {
    list.push(candidate);
  }
  return { issues: [], adapters: list };
}
