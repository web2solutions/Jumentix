/**
 * canaMigration — the ONE-WAY migration of `service-management.v1` from
 * localStorage to Cana (JUM-484), and the declared storage-environment
 * states the no-fallback decision (2026-07-29) makes mandatory.
 *
 * There is no fallback to localStorage — no fallback at all. Once this
 * migration verifies, the designer reads and writes Cana exclusively; the
 * localStorage payload is left in place, UNUSED, for a defined retention
 * period as a manual recovery path only (never read by the designer), then
 * removed. Because safety cannot come from retreat, it comes from
 * construction:
 *
 * 1. **Export before migrate.** `downloadBackup(fileName, rawJson)` is
 *    invoked with the verbatim source payload BEFORE any Cana write — the
 *    recourse that replaces the fallback.
 * 2. **Verify before cutover.** Both documents are written through the port,
 *    read back, and compared against the source. Only a verified migration
 *    records its marker; anything else leaves the source untouched and the
 *    migration re-runnable.
 * 3. **Delayed source retention.** The source payload stays in localStorage
 *    for `CANA_MIGRATION_SOURCE_RETENTION_DAYS` after a verified migration.
 *    It is not a fallback — no code path reads it as a store — it exists so
 *    a verification that later proves wrong still has a manual recovery.
 * 4. **Idempotent and re-runnable.** The writes are `put`s of the same
 *    payload under the same pinned keys; an interrupted migration re-runs
 *    to the identical result, and a verified marker short-circuits re-entry.
 * 5. **Schema versioning in Cana from the first write.** The Cana database
 *    itself is versioned (`CANA_DESIGNER_CLIENT_OPTIONS.schema.version`),
 *    and a verified migration writes a provenance record under
 *    `CANA_MIGRATION_RECORD_KEY` so a future migration has a version to
 *    reason about.
 *
 * The wire format does NOT change: keys and payload shapes stay pinned by
 * Requirement 126 Contract 2 — what changes is WHERE the payload lives.
 * The baseline document (`service-management.schema-baseline.v1`) crosses
 * with the state payload when present; an absent baseline stays absent (the
 * designer already treats a missing baseline as "no baseline", and
 * fabricating one would invent a diff reference the user never saved).
 *
 * This module is DOM-free and import-safe in any runtime: the storage
 * backend and the backup download are injected, exactly like the port.
 */

/** localStorage marker recording a verified migration (and its retention). */
export const CANA_MIGRATION_MARKER_KEY = 'service-management.v1.cana-migration';

/** Cana record key holding the migration provenance/schema-version document. */
export const CANA_MIGRATION_RECORD_KEY = 'service-management.migration.v1';

/** Schema/provenance version written into Cana from the first migration. */
export const CANA_MIGRATION_RECORD_VERSION = 1;

/**
 * Days the verified source payload is retained in localStorage, unused,
 * as a manual recovery path. After this period the boot removes it — the
 * migration is terminal.
 */
export const CANA_MIGRATION_SOURCE_RETENTION_DAYS = 30;

/** Source keys, pinned by Requirement 126 Contract 2. */
export const CANA_MIGRATION_SOURCE_STATE_KEY = 'service-management.v1';
export const CANA_MIGRATION_SOURCE_BASELINE_KEY = 'service-management.schema-baseline.v1';

function errorReason(error) {
  return String((error && error.message) || error);
}

/** Resolve the ambient localStorage without assuming a DOM (guarded). */
function resolveDefaultStorage() {
  try {
    return typeof globalThis !== 'undefined' ? globalThis.localStorage : undefined;
  } catch (_) {
    return undefined;
  }
}

/**
 * Canonical JSON (recursively sorted keys) so verification compares document
 * CONTENT, not byte spelling — `{"A":1}` and its escaped spellings are the
 * same document.
 */
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function readMarker(storage) {
  let raw;
  try {
    raw = storage.getItem(CANA_MIGRATION_MARKER_KEY);
  } catch (_) {
    return undefined;
  }
  if (!raw) return undefined;
  try {
    const marker = JSON.parse(raw);
    return marker && marker.status === 'verified' ? marker : undefined;
  } catch (_) {
    return undefined;
  }
}

function writeMarker(storage, marker) {
  try {
    storage.setItem(CANA_MIGRATION_MARKER_KEY, JSON.stringify(marker));
    return true;
  } catch (_) {
    // A marker that cannot be written only means the migration re-runs next
    // boot — idempotent by construction, so this is safe to swallow.
    return false;
  }
}

/**
 * Write the migration provenance/schema-version record into Cana, beside the
 * two pinned documents. Best-effort and deliberately NOT through the port:
 * the port carries exactly the two Requirement 126 Contract 2 documents,
 * while this record is migration bookkeeping. A failure here never fails the
 * migration — the verified payload is the substance, the record is metadata.
 */
async function writeMigrationRecord(store, record) {
  try {
    if (typeof store.ensureOpen !== 'function') return false;
    const open = await store.ensureOpen();
    if (!open.ok || !store.client || typeof store.client.transaction !== 'function') return false;
    const tx = await store.client.transaction(
      'readwrite',
      [store.storeName],
      (scope) => scope.table(store.storeName).put(JSON.stringify(record), CANA_MIGRATION_RECORD_KEY)
    );
    return Boolean(tx && tx.outcome === 'committed');
  } catch (_) {
    return false;
  }
}

/**
 * Run the one-way migration.
 *
 * @param {Object} [options]
 * @param {Storage} [options.storage] - the legacy backend; defaults to the
 *   ambient `localStorage`, resolved defensively.
 * @param {import('@jumentix/designer-core/store/IDesignerStore.js').IDesignerStore} options.store - the
 *   Cana store (the port) the payload migrates INTO.
 * @param {Function} [options.downloadBackup] - `(fileName, rawJson) => void`,
 *   invoked with the verbatim source payload BEFORE any Cana write.
 * @param {string} [options.stateKey] - source state key override (tests).
 * @param {string} [options.baselineKey] - source baseline key override (tests).
 * @param {Function} [options.now] - clock injection (tests), `() => Date`.
 * @returns {Promise<Object>} `{ status: 'migrated'|'already-migrated'|'no-source'|'failed', ... }`
 */
export async function migrateLocalStorageToCana({
  storage,
  store,
  downloadBackup,
  stateKey = CANA_MIGRATION_SOURCE_STATE_KEY,
  baselineKey = CANA_MIGRATION_SOURCE_BASELINE_KEY,
  now = () => new Date()
} = {}) {
  const backend = storage !== undefined ? storage : resolveDefaultStorage();
  if (!backend) return { status: 'no-source', reason: 'localStorage is not accessible in this context.' };

  const marker = readMarker(backend);
  if (marker) {
    // Verified earlier: the designer never reads the source again. The only
    // remaining duty is retiring the retained copy once its period ends.
    const retainedUntil = Date.parse(marker.sourceRetainedUntil || '');
    if (Number.isFinite(retainedUntil) && now().getTime() > retainedUntil) {
      try {
        backend.removeItem(stateKey);
        backend.removeItem(baselineKey);
      } catch (_) {
        // Removal is housekeeping; a throwing backend must not break boot.
      }
      return { status: 'already-migrated', sourceRetained: false, migratedAt: marker.migratedAt };
    }
    return { status: 'already-migrated', sourceRetained: true, migratedAt: marker.migratedAt };
  }

  let rawState;
  try {
    rawState = backend.getItem(stateKey);
  } catch (error) {
    return { status: 'no-source', reason: `localStorage could not be read: ${errorReason(error)}` };
  }
  if (rawState === null || rawState === undefined) return { status: 'no-source' };

  let payload;
  try {
    payload = JSON.parse(rawState);
  } catch (error) {
    // A corrupt source cannot be migrated and is never deleted: the user can
    // still recover it manually. Surfaced as a declared failure, not silence.
    return {
      status: 'failed',
      reason: `corrupt-source: the stored payload under "${stateKey}" is not readable JSON (${errorReason(error)}); `
        + 'it was left untouched for manual recovery.'
    };
  }

  // Export before migrate — the backup is produced BEFORE the first Cana write.
  const migratedAt = now().toISOString();
  const backupFileName = `service-management-v1-backup-${migratedAt.replace(/[:.]/g, '-')}.json`;
  if (typeof downloadBackup === 'function') downloadBackup(backupFileName, rawState);

  const saveResult = await store.save(payload);
  if (saveResult.status !== 'persisted') {
    return {
      status: 'failed',
      reason: `save-failed: the payload could not be written to Cana (${saveResult.reason || saveResult.status}); `
        + 'the localStorage source was left untouched and the migration will retry on the next launch.'
    };
  }

  // Baseline carriage: migrate the schema-diff baseline when one exists; an
  // absent baseline stays absent (never fabricated).
  let baselineMigrated = false;
  let baselineNote;
  let baselinePayload;
  let rawBaseline;
  try {
    rawBaseline = backend.getItem(baselineKey);
  } catch (_) {
    rawBaseline = null;
  }
  if (rawBaseline !== null && rawBaseline !== undefined) {
    try {
      baselinePayload = JSON.parse(rawBaseline);
    } catch (error) {
      baselineNote = `baseline-lost: the stored baseline is not readable JSON (${errorReason(error)}); `
        + 'the state payload migrated without it.';
    }
    if (baselinePayload !== undefined) {
      const baselineSave = await store.saveBaseline(baselinePayload);
      if (baselineSave.status !== 'persisted') {
        return {
          status: 'failed',
          reason: `save-failed: the baseline could not be written to Cana (${baselineSave.reason || baselineSave.status}); `
            + 'the localStorage source was left untouched and the migration will retry on the next launch.'
        };
      }
      baselineMigrated = true;
    }
  }

  // Verify before cutover: read both documents back and compare content.
  const readBack = await store.load();
  if (readBack.status !== 'ok' || canonicalJson(readBack.payload) !== canonicalJson(payload)) {
    return {
      status: 'failed',
      reason: `verification-mismatch: the payload read back from Cana does not match the source `
        + `(load status ${readBack.status}${readBack.reason ? `, ${readBack.reason}` : ''}); `
        + 'the localStorage source was left untouched and the migration will retry on the next launch.'
    };
  }
  if (baselineMigrated) {
    const baselineReadBack = await store.loadBaseline();
    if (baselineReadBack.status !== 'ok'
      || canonicalJson(baselineReadBack.payload) !== canonicalJson(baselinePayload)) {
      return {
        status: 'failed',
        reason: 'verification-mismatch: the baseline read back from Cana does not match the source; '
          + 'the localStorage source was left untouched and the migration will retry on the next launch.'
      };
    }
  }

  const sourceRetainedUntil = new Date(
    now().getTime() + CANA_MIGRATION_SOURCE_RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  // Schema versioning in Cana from the first write: provenance beside the
  // payload, so a future migration has a version to reason about.
  const migrationRecordPersisted = await writeMigrationRecord(store, {
    version: CANA_MIGRATION_RECORD_VERSION,
    source: 'localstorage',
    stateKey,
    baselineKey,
    baselineMigrated,
    migratedAt,
    verified: true,
    sourceRetainedUntil
  });

  const markerPersisted = writeMarker(backend, {
    version: CANA_MIGRATION_RECORD_VERSION,
    status: 'verified',
    migratedAt,
    sourceRetainedUntil
  });

  const result = {
    status: 'migrated',
    verified: true,
    backupFileName,
    baselineMigrated,
    sourceRetained: true,
    sourceRetainedUntil,
    migrationRecordPersisted,
    markerPersisted
  };
  if (baselineNote) result.baselineNote = baselineNote;
  return result;
}

/**
 * Map startup storage health onto the DECLARED environment states the
 * no-fallback decision requires — each previously silent degradation is now
 * detected, named and communicated (never alert(); the caller renders the
 * message through the JUM-543 non-blocking status surfaces).
 *
 * @param {Object} options
 * @param {boolean} options.indexedDbPresent - whether the runtime exposes a
 *   usable `indexedDB` global at all (unsupported browser when false).
 * @param {'available'|'unavailable'|'lost'} options.probeStatus - `probe()`.
 * @param {string} [options.probeReason] - the port's diagnostic reason.
 * @returns {{kind: string, severity: 'error'|'info', message: ?string}}
 */
export function describeDesignerStorageEnvironment({ indexedDbPresent, probeStatus, probeReason } = {}) {
  if (indexedDbPresent === false) {
    return {
      kind: 'unsupported-environment',
      severity: 'error',
      message: 'This browser provides no usable IndexedDB storage. The Service Management designer '
        + 'depends on it for persistence, so this environment is unsupported: you can explore the '
        + 'designer, but nothing you build here can be saved.'
    };
  }
  if (probeStatus === 'unavailable') {
    return {
      kind: 'non-persisting-session',
      severity: 'error',
      message: 'Persistent storage is unavailable in this browsing context (private/incognito mode, '
        + 'blocked storage, or storage not yet wired into this host). The designer cannot save your '
        + 'work: anything you build in this session will be lost when it ends.'
        + (probeReason ? ` Cause: ${probeReason}` : '')
    };
  }
  if (probeStatus === 'lost') {
    return {
      kind: 'data-lost',
      severity: 'error',
      message: 'Previously saved designer data is no longer readable (storage eviction or corruption) '
        + 'and there is no fallback store. A fresh template was loaded instead; your only recourse is '
        + 'a backup/export made earlier.'
        + (probeReason ? ` Cause: ${probeReason}` : '')
    };
  }
  if (probeStatus === 'available' && probeReason) {
    return {
      kind: 'degraded-durability',
      severity: 'info',
      message: `Storage is working but durability is degraded: ${probeReason}`
    };
  }
  return { kind: 'ok', severity: 'info', message: null };
}

/**
 * Read whether the verified pre-migration source payload is still retained in
 * localStorage (unused, inside its retention window). This is the manual
 * recovery path the load-time loss announcement names when it exists
 * (JUM-626): a corrupted Cana record is unrecoverable from Cana itself, but
 * the retained copy is still in the browser for the user to copy out.
 *
 * @param {Object} [options]
 * @param {Storage} [options.storage] - the legacy backend; defaults to the
 *   ambient `localStorage`, resolved defensively.
 * @param {Function} [options.now] - clock injection (tests), `() => Date`.
 * @returns {{retained: boolean, retainedUntil?: string}}
 */
export function readRetainedMigrationSource({ storage, now = () => new Date() } = {}) {
  const backend = storage !== undefined ? storage : resolveDefaultStorage();
  if (!backend) return { retained: false };
  const marker = readMarker(backend);
  if (!marker) return { retained: false };
  const retainedUntil = Date.parse(marker.sourceRetainedUntil || '');
  if (!Number.isFinite(retainedUntil) || now().getTime() > retainedUntil) {
    return { retained: false };
  }
  let present = false;
  try {
    present = backend.getItem(CANA_MIGRATION_SOURCE_STATE_KEY) !== null;
  } catch (_) {
    present = false;
  }
  return present
    ? { retained: true, retainedUntil: marker.sourceRetainedUntil }
    : { retained: false };
}

/**
 * The DECLARED `data-lost` state for corruption discovered at LOAD time
 * (JUM-626) — the probe-time `data-lost` above covers eviction; this one
 * covers a stored payload the port reports `'lost'` on read, which the probe
 * cannot see. The boot recovers (seed template + recovered save, making the
 * record readable again) and announces the loss through the JUM-543 status
 * region instead of healing silently: the message names the loss and names
 * the recourse — the retained pre-migration localStorage copy when one is
 * still inside its retention window, an earlier export/backup otherwise.
 * Never alert(); the caller renders through the status surfaces.
 *
 * @param {Object} [options]
 * @param {string} [options.reason] - the port's diagnostic reason.
 * @param {{retained: boolean, retainedUntil?: string}} [options.retainedSource] -
 *   the `readRetainedMigrationSource` verdict.
 * @returns {{kind: string, severity: 'error', message: string}}
 */
export function describeLoadTimeDataLoss({ reason, retainedSource } = {}) {
  const recourse = retainedSource && retainedSource.retained
    ? ` The pre-migration copy of your design is still retained, unused, in this browser's local `
      + `storage under "${CANA_MIGRATION_SOURCE_STATE_KEY}" until ${retainedSource.retainedUntil} — `
      + 'copy it out before then and restore it with Import JSON; an earlier export or migration '
      + 'backup works too.'
    : ' Your recourse is a backup/export made earlier — restore it with Import JSON.';
  return {
    kind: 'data-lost',
    severity: 'error',
    message: 'Your previously saved design could not be loaded: the stored data is corrupted and '
      + 'there is no fallback store, so a fresh template was loaded instead and the saved model '
      + 'was lost.'
      + recourse
      + (reason ? ` Cause: ${reason}` : '')
  };
}
