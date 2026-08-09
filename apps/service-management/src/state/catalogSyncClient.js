/**
 * catalogSyncClient — multi-user shared-catalog synchronization for the
 * Service Management designer (JUM-491), extending the JUM-485 multi-tab
 * channel from tabs to users.
 *
 * ## What this client is
 *
 * designerSync.js synchronises one document across THIS browser's tabs. This
 * client synchronises the SHARED domains inside that document across USERS,
 * against the backend Catalogs module (`apps/backend-template/src/modules/
 * Catalogs`): a team shares one catalog of domain designs, scoped to their
 * organization by the TENANT-RBAC contract. It is a sibling consumer of the
 * same Cana committed-event stream designerSync subscribes to, and every
 * remote change it applies crosses the same one path — `applyRemoteDocument`
 * from designerSync.js — so remote applies behave identically whether they
 * come from another tab or from another user: the model slice is replaced,
 * history is not recorded (remote changes are not undoable), the redo branch
 * is truncated, and the selection is reconciled, never imported.
 *
 * ## The optimistic-concurrency model, client side
 *
 * The unit of concurrency is the catalog RECORD — one shared domain design —
 * exactly as the backend declares it. Each shared domain carries an additive
 * sync marker at `domain.context.catalog` (JUM-492's additive-carry pattern,
 * Requirement 126 Contract 3): `{ id, version, contentHash }`. `contentHash`
 * is the canonical JSON of the domain WITHOUT the marker, captured at the
 * last successful push or pull; a domain whose current hash differs is dirty
 * and is pushed with the marker's version as the expected version. A stale
 * write comes back 409; the client then fetches the current server record
 * and raises a CONFLICT entry — the local edit is never discarded (the
 * issue's reviewable rejection path) — and the user (or a caller policy)
 * resolves it explicitly:
 *
 * - `take-server`: the server's design replaces the local domain and the
 *   marker rebases to the server version;
 * - `take-local`: the local design is re-pushed against the server's CURRENT
 *   version, making the local edit a deliberate new write, not a blind
 *   overwrite.
 *
 * ## Convergence after partition — the Cana resync rule, honestly applied
 *
 * Cana's own rule (JUM-413) is that a gap too old for the retained window is
 * a reload-from-database signal, never a replay. This client applies the same
 * rule across the network: catch-up is ALWAYS a document read-back
 * (`listCatalogs` with `includeDeleted=true`, diffed by `(id, version)`
 * against the link map), never an event replay. A transport failure is a
 * DECLARED state — surfaced through `notify` (JUM-543), status `degraded`,
 * retried on the next poll — never a silent degradation and never a fallback
 * to another store, because there is none.
 *
 * ## Deletion semantics
 *
 * Server-side deletion is a tombstone: the record survives with `deletedAt`
 * set and its version bumped, so a delete on one client propagates to every
 * other client's next read-back (the linked local domain is removed, or a
 * conflict is raised when the local copy has unsynced edits), and it is
 * recoverable — a restored record (version bumped, tombstone cleared) is
 * re-added on the read-back. A LOCAL deletion of a shared domain is pushed
 * as a delete while the client is online via the session link map; an
 * offline local deletion cannot be pushed, and the read-back then treats the
 * surviving server record as the truth and re-adds the domain — the same
 * "committed document wins" answer designerSync gives for tabs (the marker
 * is durable in the Cana document; the deletion-intent queue is not, and
 * that boundary is deliberate for this slice).
 *
 * This module is DOM-free and import-safe in any runtime: the transport, the
 * scheduler and the client identity are all injected or resolved defensively
 * from `globalThis`, exactly like designerSync and the store port.
 */

import { applyRemoteDocument } from './designerSync.js';
import { normalizeDomainInput } from '@jumentix/designer-core/state/designerState.js';
import { CANA_STATE_KEY } from '../store/CanaDesignerStore.js';
import { DOMAIN_PACKAGE_KIND, DOMAIN_PACKAGE_VERSION } from '@jumentix/designer-core/packages/packageVersioning.js';

/** Default poll interval for catalog read-back. */
export const CATALOG_SYNC_POLL_INTERVAL_MS = 15000;

/** Default trailing-edge debounce for outbound pushes after local commits. */
export const CATALOG_SYNC_PUSH_DEBOUNCE_MS = 300;

/** Conflict resolution strategies accepted by `resolveConflict`. */
export const CATALOG_CONFLICT_STRATEGIES = ['take-server', 'take-local'];

/** Canonical JSON (recursively sorted keys) — the content-hash primitive. */
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** The domain without its sync marker — the unit the hash and pushes cover. */
function stripCatalogMarker(domain) {
  if (!domain || typeof domain !== 'object') return domain;
  const { context, ...rest } = domain;
  if (!context || typeof context !== 'object') return rest;
  const { catalog, ...contextRest } = context;
  return { ...rest, context: contextRest };
}

/**
 * The shareable domain in its NORMALIZED form. The hash and the pushed
 * payload are computed over this form so they survive the designer's own
 * load/apply normalization — an unstable hash would read every applied
 * domain as dirty and echo it straight back to the server.
 */
function normalizeShareableDomain(domain) {
  return normalizeDomainInput(stripCatalogMarker(domain), 0);
}

/** The content hash of a domain's shareable content. */
function contentHashOf(domain) {
  return canonicalJson(normalizeShareableDomain(domain));
}

/** The catalog sync marker of a domain, or null when it is not shared. */
function catalogMarkerOf(domain) {
  const marker = domain?.context?.catalog;
  if (!marker || typeof marker !== 'object' || !marker.id) return null;
  return {
    id: marker.id,
    version: Number.isFinite(marker.version) ? marker.version : 0,
    contentHash: String(marker.contentHash || '')
  };
}

/** The versioned document pushed to the catalog (JUM-547/JUM-492 shape). */
function buildCatalogDesignPayload(domain) {
  return {
    kind: DOMAIN_PACKAGE_KIND,
    version: DOMAIN_PACKAGE_VERSION,
    domain: normalizeShareableDomain(domain)
  };
}

/** Extract the domain from a catalog record's design document. */
function domainFromCatalogDesign(design) {
  if (design && typeof design === 'object' && design.domain && typeof design.domain === 'object') {
    return design.domain;
  }
  return design;
}

/** Default client identity: unique per session, no DOM required. */
function defaultOriginId() {
  try {
    if (typeof globalThis !== 'undefined' && typeof globalThis.crypto?.randomUUID === 'function') {
      return `catalog-sync-${globalThis.crypto.randomUUID()}`;
    }
  } catch (_) {
    // Fall through to the Math.random spelling.
  }
  return `catalog-sync-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Create the shared-catalog sync client.
 *
 * @param {Object} options
 * @param {Object} options.designerState - `createDesignerState`'s return value.
 * @param {import('../store/CanaDesignerStore.js').CanaDesignerStore} options.store -
 * the Cana store; its client provides the ordered local-commit stream.
 * @param {Object} options.transport - the catalog API port (`listCatalogs`,
 * `getCatalog`, `createCatalog`, `updateCatalog`, `deleteCatalog`,
 * `restoreCatalog`) — see `createCatalogHttpTransport`.
 * @param {Function} [options.render] - re-render after a remote apply.
 * @param {Function} [options.notify] - `(message, severity) => void`, the
 * JUM-543 status surface.
 * @param {string} [options.originId] - this client's identity (diagnostics).
 * @param {string} [options.stateKey] - state document key override (tests).
 * @param {number} [options.pollIntervalMs] - read-back interval.
 * @param {number} [options.pushDebounceMs] - outbound debounce after commits.
 * @param {Function} [options.schedule] - `(fn, ms) => handle` (tests).
 * @param {Function} [options.cancelSchedule] - `(handle) => void` (tests).
 */
export function createCatalogSyncClient({
  designerState,
  store,
  transport,
  render = () => {},
  notify = () => {},
  originId,
  stateKey = CANA_STATE_KEY,
  pollIntervalMs = CATALOG_SYNC_POLL_INTERVAL_MS,
  pushDebounceMs = CATALOG_SYNC_PUSH_DEBOUNCE_MS,
  schedule = (fn, ms) => setTimeout(fn, ms),
  cancelSchedule = (handle) => clearTimeout(handle)
} = {}) {
  const clientOriginId = originId || defaultOriginId();
  const conflicts = new Map();
  let started = false;
  let syncing = false;
  let degraded = false;
  let unsubscribe = null;
  let pollHandle = null;
  let pushHandle = null;
  let lastSyncAt = null;

  function sharedDomains() {
    return designerState.state.domains.filter((domain) => catalogMarkerOf(domain) !== null);
  }

  function isDirty(domain) {
    const marker = catalogMarkerOf(domain);
    if (!marker) return false;
    return contentHashOf(domain) !== marker.contentHash;
  }

  function setMarker(domain, marker) {
    // eslint-disable-next-line no-param-reassign
    domain.context = { ...(domain.context || {}), catalog: marker };
  }

  function clearMarker(domain) {
    // eslint-disable-next-line no-param-reassign
    domain.context = { ...(domain.context || {}) };
    // eslint-disable-next-line no-param-reassign
    delete domain.context.catalog;
  }

  function raiseConflict(entry) {
    conflicts.set(entry.catalogId, { ...entry, at: new Date().toISOString() });
    notify(
      `The shared domain "${entry.domainName}" conflicts with the shared catalog `
        + `(server version ${entry.serverVersion}). Your local edit is kept; `
        + 'review the conflict and choose to take the server version or push yours.',
      'error'
    );
  }

  /** Persist the current state and re-render after a mutation. */
  async function persistAndRender() {
    render();
    await designerState.saveState();
  }

  /**
   * Push one dirty shared domain. A 409 raises a reviewable conflict and the
   * local edit survives untouched; any other failure is declared and the
   * domain stays dirty for the next push.
   */
  async function pushDomain(domain) {
    const marker = catalogMarkerOf(domain);
    try {
      const updated = await transport.updateCatalog(marker.id, {
        version: marker.version,
        design: buildCatalogDesignPayload(domain),
        provenance: domain.context?.provenance
      });
      setMarker(domain, {
        id: marker.id,
        version: updated.version,
        contentHash: contentHashOf(domain)
      });
      conflicts.delete(marker.id);
      return { pushed: true };
    } catch (error) {
      if (error && error.status === 409) {
        let serverVersion = null;
        try {
          const current = await transport.getCatalog(marker.id);
          serverVersion = current.version;
        } catch (readError) {
          return { pushed: false, reason: 'conflict-unreadable' };
        }
        raiseConflict({
          catalogId: marker.id,
          domainId: domain.id,
          domainName: domain.name,
          reason: 'stale-write',
          serverVersion,
          baseVersion: marker.version
        });
        return { pushed: false, reason: 'conflict' };
      }
      throw error;
    }
  }

  /** Push every dirty shared domain; returns the per-domain outcomes. */
  async function pushLocalChanges() {
    const outcomes = [];
    for (const domain of sharedDomains()) {
      if (!isDirty(domain)) continue;
      if (conflicts.has(catalogMarkerOf(domain).id)) continue;
      // eslint-disable-next-line no-await-in-loop
      outcomes.push(await pushDomain(domain));
    }
    if (outcomes.some((outcome) => outcome.pushed)) {
      await persistAndRender();
    }
    return outcomes;
  }

  /**
   * Apply one server record to the local domains slice. Returns the mutation
   * kind ('added' | 'updated' | 'removed' | null) — conflicts and no-ops do
   * not mutate.
   */
  function applyServerRecord(record) {
    const local = designerState.state.domains.find(
      (domain) => catalogMarkerOf(domain)?.id === record.id
    );
    const tombstoned = Boolean(record.deletedAt);
    if (tombstoned) {
      if (!local) return null;
      if (isDirty(local)) {
        const marker = catalogMarkerOf(local);
        raiseConflict({
          catalogId: record.id,
          domainId: local.id,
          domainName: local.name,
          reason: 'deleted-remotely',
          serverVersion: record.version,
          baseVersion: marker.version
        });
        return null;
      }
      designerState.state.domains = designerState.state.domains.filter(
        (domain) => domain.id !== local.id
      );
      return 'removed';
    }

    const remoteDomain = domainFromCatalogDesign(record.design);
    if (!local) {
      const admitted = {
        ...remoteDomain,
        context: {
          ...(remoteDomain.context || {}),
          catalog: {
            id: record.id,
            version: record.version,
            contentHash: contentHashOf(remoteDomain)
          }
        }
      };
      designerState.state.domains = [...designerState.state.domains, admitted];
      return 'added';
    }

    const marker = catalogMarkerOf(local);
    if (record.version <= marker.version) return null;
    if (isDirty(local)) {
      raiseConflict({
        catalogId: record.id,
        domainId: local.id,
        domainName: local.name,
        reason: 'concurrent-edit',
        serverVersion: record.version,
        baseVersion: marker.version
      });
      return null;
    }
    const index = designerState.state.domains.findIndex((domain) => domain.id === local.id);
    const applied = {
      ...remoteDomain,
      id: local.id,
      context: {
        ...(remoteDomain.context || {}),
        catalog: {
          id: record.id,
          version: record.version,
          contentHash: contentHashOf(remoteDomain)
        }
      }
    };
    designerState.state.domains = [
      ...designerState.state.domains.slice(0, index),
      applied,
      ...designerState.state.domains.slice(index + 1)
    ];
    return 'updated';
  }

  /**
   * Read the catalog back and converge — the canonical catch-up, after every
   * poll tick and after every partition heals. Mutations cross the designerSync
   * one path (`applyRemoteDocument`) so selection/history semantics stay
   * identical to a tab-originated apply.
   */
  async function pullRemoteChanges() {
    const records = await transport.listCatalogs({ includeDeleted: true });
    const mutations = new Set();
    for (const record of records) {
      const mutation = applyServerRecord(record);
      if (mutation) mutations.add(mutation);
    }
    if (mutations.size === 0) return { pulled: false, reason: 'already-current' };
    const payload = designerState.snapshotState();
    applyRemoteDocument(designerState, payload);
    await persistAndRender();
    const summary = [...mutations].join('/');
    notify(`The designer synchronized with the shared catalog (${summary}).`, 'info');
    return { pulled: true, mutations: [...mutations] };
  }

  /** One full sync round: read-back first (server truth), then push local dirt. */
  async function syncNow() {
    if (syncing) return { synced: false, reason: 'already-syncing' };
    syncing = true;
    try {
      const pulled = await pullRemoteChanges();
      const pushed = await pushLocalChanges();
      degraded = false;
      lastSyncAt = new Date().toISOString();
      return { synced: true, pulled, pushed: pushed.filter((outcome) => outcome.pushed).length };
    } catch (error) {
      degraded = true;
      notify(
        `The shared catalog is unreachable (${String((error && error.message) || error)}). `
          + 'Local work still saves to Cana; synchronization retries on the next cycle. '
          + 'There is no fallback store behind the catalog.',
        'error'
      );
      return { synced: false, reason: 'transport-unavailable' };
    } finally {
      syncing = false;
    }
  }

  /** Local committed write observed through Cana's ordered listener. */
  function onLocalCommit(event) {
    if (!event || event.store !== store.storeName || event.key !== stateKey) return;
    if (event.type === 'cleared') return;
    if (pushHandle !== null) cancelSchedule(pushHandle);
    pushHandle = schedule(() => {
      pushHandle = null;
      if (!started || degraded) return undefined;
      // Returned so an injected scheduler's caller can await the push; the
      // catch declares the failure instead of leaking an unhandled rejection.
      return pushLocalChanges().catch((error) => {
        degraded = true;
        notify(
          `Pushing to the shared catalog failed (${String((error && error.message) || error)}); `
            + 'the local edit is durable in Cana and the push retries on the next cycle.',
          'error'
        );
      });
    }, pushDebounceMs);
  }

  function scheduleNextPoll() {
    if (pollHandle !== null) cancelSchedule(pollHandle);
    pollHandle = schedule(async () => {
      pollHandle = null;
      await syncNow();
      if (started) scheduleNextPoll();
    }, pollIntervalMs);
  }

  /**
   * Publish a local domain into the shared catalog. The marker write-back is
   * persisted, so the link survives reloads; the returned record carries the
   * server-assigned id and version 1.
   */
  async function publishDomain(domainId, details = {}) {
    const domain = designerState.state.domains.find((entry) => entry.id === domainId);
    if (!domain) return { published: false, reason: 'domain-not-found' };
    if (catalogMarkerOf(domain)) return { published: false, reason: 'already-shared' };
    const created = await transport.createCatalog({
      name: details.name || domain.name,
      description: details.description,
      design: buildCatalogDesignPayload(domain),
      provenance: domain.context?.provenance
    });
    setMarker(domain, {
      id: created.id,
      version: created.version,
      contentHash: contentHashOf(domain)
    });
    await persistAndRender();
    return { published: true, record: created };
  }

  /**
   * Remove a domain from the shared catalog: the remote record is tombstoned
   * (propagating to every other user), the local domain stays and loses its
   * marker — it becomes a local-only domain again.
   */
  async function unpublishDomain(domainId) {
    const domain = designerState.state.domains.find((entry) => entry.id === domainId);
    const marker = domain ? catalogMarkerOf(domain) : null;
    if (!domain || !marker) return { unpublished: false, reason: 'not-shared' };
    await transport.deleteCatalog(marker.id, marker.version);
    clearMarker(domain);
    conflicts.delete(marker.id);
    await persistAndRender();
    return { unpublished: true };
  }

  /**
   * Resolve a raised conflict. `take-server` replaces the local domain with
   * the server design; `take-local` re-pushes the local design against the
   * server's current version — a deliberate new write, never a blind
   * overwrite. Both rebase the marker and persist.
   */
  async function resolveConflict(catalogId, strategy) {
    if (!CATALOG_CONFLICT_STRATEGIES.includes(strategy)) {
      return { resolved: false, reason: 'unknown-strategy' };
    }
    const conflict = conflicts.get(catalogId);
    if (!conflict) return { resolved: false, reason: 'no-conflict' };
    const domain = designerState.state.domains.find((entry) => entry.id === conflict.domainId);
    const current = await transport.getCatalog(catalogId);
    if (strategy === 'take-server') {
      if (domain) {
        const remoteDomain = domainFromCatalogDesign(current.design);
        const index = designerState.state.domains.findIndex((entry) => entry.id === domain.id);
        if (current.deletedAt) {
          designerState.state.domains = designerState.state.domains.filter(
            (entry) => entry.id !== domain.id
          );
        } else {
          designerState.state.domains[index] = {
            ...remoteDomain,
            id: domain.id,
            context: {
              ...(remoteDomain.context || {}),
              catalog: { id: catalogId, version: current.version, contentHash: contentHashOf(remoteDomain) }
            }
          };
        }
      }
      conflicts.delete(catalogId);
      const payload = designerState.snapshotState();
      applyRemoteDocument(designerState, payload);
      await persistAndRender();
      return { resolved: true, strategy };
    }
    if (!domain) return { resolved: false, reason: 'domain-not-found' };
    if (current.deletedAt) {
      // The server record is tombstoned: take-local means republishing as a
      // restore plus a content write — a restore IS a versioned write.
      await transport.restoreCatalog(catalogId, current.version);
      const restored = await transport.getCatalog(catalogId);
      current.version = restored.version;
    }
    const updated = await transport.updateCatalog(catalogId, {
      version: current.version,
      design: buildCatalogDesignPayload(domain),
      provenance: domain.context?.provenance
    });
    setMarker(domain, {
      id: catalogId,
      version: updated.version,
      contentHash: contentHashOf(domain)
    });
    conflicts.delete(catalogId);
    await persistAndRender();
    return { resolved: true, strategy };
  }

  /**
   * Start syncing: initial read-back (the convergence baseline), then the
   * local-commit subscription and the poll loop. A failed initial read-back
   * is a declared state — the client still starts, degraded, and retries on
   * the next cycle; there is no fallback.
   */
  async function start() {
    if (started) return { started: true, already: true };
    started = true;
    const client = store.client;
    if (client && typeof client.subscribe === 'function') {
      unsubscribe = client.subscribe(onLocalCommit);
    }
    scheduleNextPoll();
    const first = await syncNow();
    return { started: true, converged: first.synced === true };
  }

  /** Stop syncing: unsubscribe and cancel every pending cycle. */
  function stop() {
    started = false;
    if (pollHandle !== null) {
      cancelSchedule(pollHandle);
      pollHandle = null;
    }
    if (pushHandle !== null) {
      cancelSchedule(pushHandle);
      pushHandle = null;
    }
    if (typeof unsubscribe === 'function') {
      unsubscribe();
      unsubscribe = null;
    }
  }

  return {
    originId: clientOriginId,
    start,
    stop,
    syncNow,
    publishDomain,
    unpublishDomain,
    resolveConflict,
    /** Test/diagnostic handles. */
    getConflicts: () => [...conflicts.values()],
    getStatus: () => ({
      degraded,
      lastSyncAt,
      sharedCount: sharedDomains().length,
      conflictCount: conflicts.size
    }),
    onLocalCommit
  };
}

/**
 * Create the HTTP transport port for the catalog API. `tokenProvider`
 * supplies the bearer token per request; `fetchImpl` is injected so the
 * module stays runtime-agnostic (browser `fetch` or Node's). Non-2xx
 * responses throw an error carrying `status` and the parsed `body` — the
 * 409 path is how stale writes become reviewable conflicts.
 */
export function createCatalogHttpTransport({
  baseUrl,
  tokenProvider = () => '',
  fetchImpl,
  apiPrefix = '/api/1.0.0'
} = {}) {
  const fetchFn = fetchImpl || (typeof globalThis !== 'undefined' ? globalThis.fetch : undefined);
  if (typeof fetchFn !== 'function') {
    throw new Error('createCatalogHttpTransport requires a fetch implementation.');
  }
  // `baseUrl` may be a function so a host can be repointed (e.g. failover);
  // the root is resolved per request, never captured once.
  const resolveRoot = () => {
    const base = typeof baseUrl === 'function' ? baseUrl() : baseUrl;
    return `${String(base || '').replace(/\/$/, '')}${apiPrefix}`;
  };

  async function call(method, path, body) {
    const headers = {
      Accept: 'application/json; charset=utf-8'
    };
    const token = tokenProvider();
    if (token) headers.Authorization = token;
    if (body !== undefined) headers['Content-Type'] = 'application/json; charset=utf-8';
    const response = await fetchFn(`${resolveRoot()}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    const text = await response.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch (_) {
      parsed = null;
    }
    if (!response.ok) {
      const error = new Error(
        `Catalog API ${method} ${path} failed with status ${response.status}`
      );
      error.status = response.status;
      error.body = parsed;
      throw error;
    }
    return parsed;
  }

  return {
    listCatalogs: async ({ includeDeleted = false, page = 1, size = 500 } = {}) => {
      const query = `?page=${page}&size=${size}${includeDeleted ? '&includeDeleted=true' : ''}`;
      const payload = await call('GET', `/catalogs${query}`);
      return Array.isArray(payload?.result) ? payload.result : [];
    },
    getCatalog: (id) => call('GET', `/catalogs/${encodeURIComponent(id)}`),
    createCatalog: (body) => call('POST', '/catalogs', body),
    updateCatalog: (id, body) => call('PUT', `/catalogs/${encodeURIComponent(id)}`, body),
    deleteCatalog: (id, version) => call(
      'DELETE',
      `/catalogs/${encodeURIComponent(id)}?version=${encodeURIComponent(String(version))}`
    ),
    restoreCatalog: (id, version) => call(
      'POST',
      `/catalogs/${encodeURIComponent(id)}/restore`,
      { version }
    )
  };
}
