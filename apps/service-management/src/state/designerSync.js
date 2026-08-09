/**
 * designerSync — multi-tab write-event synchronisation for the Service
 * Management designer (JUM-485), subscribing to Cana's ordered write events
 * (`CanaClient.subscribe`, Cana JUM-413) and reconciling remote changes with
 * the local undo/redo history.
 *
 * ## The event surface and why a channel sits beside it
 *
 * Cana publishes committed write events — `CanaChangeEvent` with `type`,
 * `store`, `key`, `record`, `cursor` (monotonic per database), `correlationId`
 * and `originId` — to the SUBSCRIBING client instance, in cursor order, only
 * after commit (packages/cana/src/core/client.ts). Delivery is per client
 * instance: tab B's commits never enter tab A's event stream, because each tab
 * holds its own client over the shared IndexedDB. The cross-tab transport is
 * therefore a `BroadcastChannel` bridge: this module subscribes to the local
 * client's ordered events and re-publishes the ones for the state document,
 * stamped with THIS tab's `originId`, so every other tab applies them as
 * remote changes. `originId` is also the echo guard — a message whose
 * `originId` matches this tab's is dropped, which is how an event is
 * attributed to the tab that wrote it. (Cana's own `originId` identifies the
 * writing CLIENT; the sync layer stamps its own tab identity because the
 * channel, not Cana, is the cross-tab boundary.)
 *
 * ## The durable cursor, honestly scoped
 *
 * Cana's resumption API is `subscribe(listener, { sinceCursor })`: events with
 * `cursor > sinceCursor` still inside the client's retained window replay
 * synchronously, and a cursor the window no longer covers throws a `'NotFound'`
 * `CanaError` — the engine's own instruction to reload from the database. The
 * retained window is per client instance, so the cursor is durable across an
 * in-session gap (backgrounded tab, resubscription) but NOT across a page
 * reload — a fresh client restarts its cursors with an empty window. This
 * module therefore persists the last seen cursor (best-effort, guarded
 * ambient localStorage), attempts a cursor resume at `start()`, and treats a
 * resume failure exactly as Cana prescribes: a full document resync through
 * the store, then a fresh subscription. Remote catch-up is ALWAYS by document
 * read-back (`resync()`/`resume()`), never by replay, because remote events
 * live in the OTHER tab's retained window. A tab closed during activity
 * resumes without loss or duplication: the boot `loadState()` already applies
 * the current document, and the cursor path converges the event stream.
 *
 * ## The three questions JUM-485 demands explicit answers to
 *
 * 1. **Does undo apply to remote changes? NO.** The undo stack is local-only:
 *    remote applies never call `recordHistory()`, so no remote change can be
 *    undone here and undo never "resurrects" what another tab deleted. A
 *    remote change TRUNCATES the redo branch (`history.future = []`) rather
 *    than leaving a stack that replays into a state that no longer exists.
 *    The local `past` stack is kept: undoing a LOCAL action after a remote
 *    change restores the local snapshot and persists it as a new, deliberate
 *    local write (whole-document last-writer-wins, like every local edit) —
 *    it is never an undo OF the remote change.
 * 2. **What happens to a pending local edit when a remote change touches the
 *    same entity? The committed document wins; the unsaved input survives.**
 *    The remote change is applied to `state` (Cana holds the truth), and the
 *    re-render preserves the user's mid-form input, focus, caret and canvas
 *    scroll/zoom (the UI layer passes a focus-preserving `render`; `view` and
 *    `activeTab` are never imported from the remote document). The status
 *    region announces the remote change (JUM-543 surface, never `alert()`),
 *    and when the user explicitly saves, their version is asserted —
 *    last-writer-wins, consistent with whole-document sync. Neither the
 *    pending edit nor the remote change is silently dropped.
 * 3. **How is the current selection preserved when the selected domain/entity/
 *    relationship is deleted remotely? Selection is per-tab and reconciled,
 *    never imported.** The remote document's selection ids are NOT applied;
 *    the local selection is kept and `reconcileSelection()` then drops ids
 *    that dangle: a deleted selected relationship or entity clears to `null`;
 *    a deleted selected domain falls back to the first remaining domain (or
 *    `null` when none remain). Every reconciliation is announced through the
 *    status region, so a dangling selection is impossible and never silent.
 *
 * ## No fallback applies here too
 *
 * Cana has no fallback to localStorage — no fallback at all (decision
 * 2026-07-29). When the event channel is unavailable or the store cannot be
 * opened, this module declares the state through the status region instead of
 * quietly reverting to a single-tab local session that still writes. And a
 * save whose outcome Cana reports `'unknown'` (worker crash after dispatch,
 * Cana JUM-411) is never assumed successful: `reportSaveOutcome()` reconciles
 * by reading the document back — a read-back matching the attempted payload
 * confirms the write; anything else reloads the last confirmed state into the
 * designer. (`client.resolveWrite()` needs the operation ledger, which the
 * designer database does not enable; read-back reconciliation needs no schema
 * change and there is no second store to reconcile against.)
 *
 * ## Event storms coalesce
 *
 * A bulk import in another tab emits one committed event per write. Channel
 * messages are trailing-edge debounced (`coalesceWindowMs`): only the latest
 * document is applied, once, so re-render work is bounded no matter how large
 * the storm, and the notification reports how many changes coalesced.
 *
 * This module is DOM-free and import-safe in any runtime: the channel, the
 * cursor storage, the scheduler and the tab identity are all injected or
 * resolved defensively from `globalThis`, exactly like the store port.
 */

import { normalizeStatePayload } from '@jumentix/designer-core/state/designerState.js';
import { CANA_STATE_KEY } from '../store/CanaDesignerStore.js';

/** BroadcastChannel name shared by every designer tab of this origin. */
export const DESIGNER_SYNC_CHANNEL_NAME = 'service-management.cana-write-events';

/** Cursor-storage key for the last Cana event cursor this tab saw. */
export const DESIGNER_SYNC_CURSOR_KEY = 'service-management.v1.sync-cursor';

/** Default trailing-edge window that coalesces a remote event storm. */
export const DESIGNER_SYNC_COALESCE_MS = 50;

/** Canonical JSON (recursively sorted keys) for content comparison. */
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** The model slice remote applies and resyncs compare and replace. */
function modelSliceOf(source) {
  return {
    domains: Array.isArray(source?.domains) ? source.domains : [],
    relationships: Array.isArray(source?.relationships) ? source.relationships : [],
    deployments: Array.isArray(source?.deployments) ? source.deployments : []
  };
}

/** Resolve the ambient localStorage without assuming a DOM (guarded). */
function resolveDefaultCursorStorage() {
  try {
    return typeof globalThis !== 'undefined' ? globalThis.localStorage : undefined;
  } catch (_) {
    return undefined;
  }
}

/**
 * Resolve the default cross-tab transport: a `BroadcastChannel` on the shared
 * channel name. Returns `null` when the runtime has no usable
 * `BroadcastChannel` — a declared state, never a silent single-tab session.
 */
function resolveDefaultChannel(channelName) {
  try {
    if (typeof globalThis !== 'undefined' && typeof globalThis.BroadcastChannel === 'function') {
      return new globalThis.BroadcastChannel(channelName);
    }
  } catch (_) {
    // A throwing constructor (disabled channel API) is the same declared state.
  }
  return null;
}

/** Default tab identity: unique per page load, no DOM required. */
function defaultOriginId() {
  try {
    if (typeof globalThis !== 'undefined' && typeof globalThis.crypto?.randomUUID === 'function') {
      return `designer-tab-${globalThis.crypto.randomUUID()}`;
    }
  } catch (_) {
    // Fall through to the Math.random spelling.
  }
  return `designer-tab-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Reconcile the LOCAL selection against the model after a remote apply
 * (question 3): ids that dangle because their domain/entity/relationship was
 * deleted remotely are cleared — relationship and entity to `null`, domain to
 * the first remaining domain (or `null` when none remain).
 *
 * @param {Object} state - the designer's shared state object (mutated).
 * @returns {string[]} the reconciled kinds ('domain'|'entity'|'relationship'),
 * in reconciliation order, for the user-facing announcement.
 */
export function reconcileSelection(state) {
  const reconciled = [];
  if (state.selectedRelationshipId
    && !state.relationships.some((relationship) => relationship.id === state.selectedRelationshipId)) {
    state.selectedRelationshipId = null;
    reconciled.push('relationship');
  }
  if (state.selectedEntityId
    && !state.domains.some((domain) => domain.entities.some((entity) => entity.id === state.selectedEntityId))) {
    state.selectedEntityId = null;
    reconciled.push('entity');
  }
  if (state.selectedDomainId
    && !state.domains.some((domain) => domain.id === state.selectedDomainId)) {
    state.selectedDomainId = state.domains.length > 0 ? state.domains[0].id : null;
    reconciled.push('domain');
  }
  return reconciled;
}

/**
 * Apply a remote document to the in-memory designer state — the one path every
 * remote change crosses (channel apply, cursor-gap resync, resume, unknown-save
 * reconciliation).
 *
 * Semantics (the module header records the reasoning):
 * - the MODEL slice (`domains`, `relationships`, `deployments`) is replaced
 *   with the remote document, normalised exactly as `loadState()` normalises;
 * - the selection stays LOCAL and is reconciled (never imported, question 3);
 * - `view` and `activeTab` stay LOCAL (question 2: no stolen zoom/scroll/tab);
 * - history is NOT recorded (remote changes are not undoable, question 1) and
 *   the redo branch is truncated, because redoing would replay into a state
 *   that no longer exists;
 * - nothing is persisted: the document is already durable in Cana — re-saving
 *   it would echo the change back into the channel as a new local write.
 *
 * @param {Object} designerState - the object returned by `createDesignerState`.
 * @param {Object} payload - the decoded remote `service-management.v1` document.
 * @returns {{reconciled: string[]}} reconciled selection kinds.
 */
export function applyRemoteDocument(designerState, payload) {
  const { state, history, recomputeIdCounter } = designerState;
  const parsed = normalizeStatePayload(payload || {});
  state.domains = parsed.domains;
  state.relationships = parsed.relationships;
  state.idCounter = parsed.idCounter;
  state.deployments = parsed.deployments;
  if (typeof recomputeIdCounter === 'function') recomputeIdCounter();
  if (history) history.future = [];
  const reconciled = reconcileSelection(state);
  return { reconciled };
}

/**
 * Create the designer's multi-tab sync engine.
 *
 * @param {Object} options
 * @param {import('../store/CanaDesignerStore.js').CanaDesignerStore} options.store -
 * the Cana store; the client it holds provides the ordered listener API.
 * @param {Object} options.designerState - `createDesignerState`'s return value.
 * @param {Function} [options.render] - re-render after a remote apply; the UI
 * layer passes a focus/scroll-preserving wrapper (question 2).
 * @param {Function} [options.notify] - `(message, severity) => void`, the
 * JUM-543 status surface.
 * @param {Object} [options.channel] - injected transport (tests); defaults to
 * a `BroadcastChannel` on `DESIGNER_SYNC_CHANNEL_NAME`.
 * @param {string} [options.channelName] - channel name override (tests).
 * @param {string} [options.originId] - this tab's identity (echo guard).
 * @param {string} [options.stateKey] - state document key override (tests).
 * @param {Storage} [options.cursorStorage] - cursor persistence override (tests).
 * @param {Function} [options.schedule] - `(fn, ms) => handle` (tests).
 * @param {Function} [options.cancelSchedule] - `(handle) => void` (tests).
 * @param {number} [options.coalesceWindowMs] - storm-coalescing window.
 */
export function createDesignerSync({
  store,
  designerState,
  render = () => {},
  notify = () => {},
  channel,
  channelName = DESIGNER_SYNC_CHANNEL_NAME,
  originId,
  stateKey = CANA_STATE_KEY,
  cursorStorage,
  schedule = (fn, ms) => setTimeout(fn, ms),
  cancelSchedule = (handle) => clearTimeout(handle),
  coalesceWindowMs = DESIGNER_SYNC_COALESCE_MS
} = {}) {
  const syncOriginId = originId || defaultOriginId();
  const ownsChannel = channel === undefined;
  let syncChannel = null;
  let unsubscribe;
  let started = false;
  let lastCursor = null;
  let pendingRemote = null;
  let pendingFlush = null;
  let coalescedCount = 0;

  function cursorStorageBackend() {
    return cursorStorage !== undefined ? cursorStorage : resolveDefaultCursorStorage();
  }

  function readPersistedCursor() {
    const storage = cursorStorageBackend();
    if (!storage) return null;
    try {
      const raw = storage.getItem(DESIGNER_SYNC_CURSOR_KEY);
      if (raw === null || raw === undefined) return null;
      const value = Number(raw);
      return Number.isInteger(value) && value >= 0 ? value : null;
    } catch (_) {
      return null;
    }
  }

  function persistCursor(cursor) {
    const storage = cursorStorageBackend();
    if (!storage) return;
    try {
      storage.setItem(DESIGNER_SYNC_CURSOR_KEY, String(cursor));
    } catch (_) {
      // Cursor persistence is best-effort bookkeeping; losing it only means
      // the next start resyncs by document, which is always correct.
    }
  }

  /**
   * Local commit observed through Cana's ordered listener: record the durable
   * cursor and re-publish the committed record on the channel, stamped with
   * this tab's identity. Only the state document crosses; baseline writes and
   * foreign stores are not designer state.
   */
  function onLocalEvent(event) {
    if (!event || event.store !== store.storeName || event.key !== stateKey) return;
    if (typeof event.cursor === 'number') {
      lastCursor = event.cursor;
      persistCursor(event.cursor);
    }
    if (!syncChannel) return;
    syncChannel.postMessage({
      originId: syncOriginId,
      cursor: event.cursor,
      correlationId: event.correlationId,
      at: event.at,
      record: event.record
    });
  }

  /**
   * Remote change observed through the channel. The origin guard drops this
   * tab's own echo (a shared in-process medium can deliver it); everything
   * else coalesces into one trailing-edge apply.
   */
  function onChannelMessage(message) {
    if (!message || typeof message !== 'object') return;
    if (message.originId === syncOriginId) return;
    if (typeof message.record !== 'string') return;
    pendingRemote = message;
    coalescedCount += 1;
    if (pendingFlush !== null) cancelSchedule(pendingFlush);
    pendingFlush = schedule(() => flushPendingRemote(), coalesceWindowMs);
  }

  /** Apply the latest coalesced remote document, once. */
  function flushPendingRemote() {
    pendingFlush = null;
    const message = pendingRemote;
    const applied = coalescedCount;
    pendingRemote = null;
    coalescedCount = 0;
    if (!message) return { applied: false, reason: 'no-pending-remote' };
    return applyRemoteMessage(message, applied);
  }

  /** User-facing summary of a remote apply (JUM-543 surface, never alert()). */
  function describeRemoteApply(reconciled, applied) {
    const base = applied > 1
      ? `${applied} changes from another tab were applied.`
      : 'A change from another tab was applied.';
    if (reconciled.includes('domain')) {
      return `${base} The selected domain was deleted remotely; the selection moved to the first remaining domain.`;
    }
    if (reconciled.includes('entity')) {
      return `${base} The selected entity was deleted remotely and the selection was cleared.`;
    }
    if (reconciled.includes('relationship')) {
      return `${base} The selected relationship was deleted remotely and the selection was cleared.`;
    }
    return base;
  }

  /**
   * Apply one remote channel message: decode the committed document, replace
   * the model slice, re-render (focus-preserving at the UI layer) and announce
   * through the status region. A record that does not decode triggers a full
   * resync — never a partial apply.
   */
  function applyRemoteMessage(message, applied = 1) {
    let payload;
    try {
      payload = JSON.parse(message.record);
    } catch (error) {
      notify(
        `A change from another tab could not be decoded (${String((error && error.message) || error)}); `
          + 'resynchronising from the store.',
        'error'
      );
      resync('undecodable-remote');
      return { applied: false, reason: 'undecodable-remote' };
    }
    const { reconciled } = applyRemoteDocument(designerState, payload);
    render();
    notify(describeRemoteApply(reconciled, applied), 'info');
    return { applied: true, reconciled };
  }

  /**
   * Full resynchronisation by document read-back — the canonical catch-up for
   * a cursor gap, a backgrounded tab resuming, or an undecodable remote
   * record. Compares the model slice before applying so a resume with nothing
   * missed costs no re-render. `'unavailable'`/`'lost'` are declared through
   * the status region: there is no fallback store behind Cana.
   */
  async function resync(reason = 'resync') {
    const result = await store.load();
    if (result.status === 'ok') {
      // Compare the NORMALISED payload: the in-memory model was normalised on
      // load, so raw stored JSON and current state spell the same document
      // differently and only the normalised comparison can be a no-op.
      const parsed = normalizeStatePayload(result.payload);
      if (canonicalJson(modelSliceOf(parsed)) === canonicalJson(modelSliceOf(designerState.state))) {
        return { resynced: false, reason: 'already-current' };
      }
      const { reconciled } = applyRemoteDocument(designerState, result.payload);
      render();
      notify(
        reason === 'resume'
          ? 'The designer caught up with changes made in another tab.'
          : 'The designer resynchronised with the stored document.',
        'info'
      );
      return { resynced: true, reconciled };
    }
    if (result.status === 'empty') {
      return { resynced: false, reason: 'empty' };
    }
    notify(
      `Multi-tab sync could not resynchronise: the stored document is ${result.status}`
        + `${result.reason ? ` (${result.reason})` : ''}. With no fallback store, this tab keeps its `
        + 'current state and retries on the next event; export your work as a precaution.',
      'error'
    );
    return { resynced: false, reason: result.status };
  }

  /**
   * Subscribe to the local client's ordered write events, resuming from the
   * persisted cursor when one exists. A cursor the retained window no longer
   * covers (Cana throws `'NotFound'`) is exactly Cana's reload-from-database
   * signal: resync by document, then subscribe fresh.
   */
  async function subscribeLocal() {
    const client = store.client;
    if (!client || typeof client.subscribe !== 'function') {
      notify(
        'Multi-tab sync could not start: the Cana client in this host exposes no ordered '
          + 'listener API. This tab will not see changes from other tabs until it is reloaded.',
        'error'
      );
      return false;
    }
    const persistedCursor = readPersistedCursor();
    if (persistedCursor !== null) {
      try {
        unsubscribe = client.subscribe(onLocalEvent, { sinceCursor: persistedCursor });
        return true;
      } catch (_) {
        await resync('cursor-gap');
      }
    }
    unsubscribe = client.subscribe(onLocalEvent);
    return true;
  }

  /**
   * Start syncing: open the store, resolve the channel, subscribe. An
   * unavailable channel is a DECLARED state (status region, severity error) —
   * the designer never quietly becomes a single-tab local application.
   */
  async function start() {
    if (started) return { started: true, already: true };
    started = true;
    const open = await store.ensureOpen();
    if (!open.ok) {
      notify(
        `Multi-tab sync could not start: ${open.reason} This tab will not see changes `
          + 'from other tabs until it is reloaded.',
        'error'
      );
      return { started: false, reason: open.reason };
    }
    syncChannel = channel !== undefined ? channel : resolveDefaultChannel(channelName);
    if (!syncChannel) {
      notify(
        'Multi-tab sync is unavailable in this browsing context (no BroadcastChannel). '
          + 'The designer still saves to Cana, but changes made in other tabs will not '
          + 'appear here and this tab\'s changes will not reach them until reload.',
        'error'
      );
    } else if (typeof syncChannel.addEventListener === 'function') {
      syncChannel.addEventListener('message', (event) => onChannelMessage(event?.data));
    } else {
      syncChannel.onmessage = (event) => onChannelMessage(event && event.data !== undefined ? event.data : event);
    }
    const subscribed = await subscribeLocal();
    return { started: subscribed, channelAvailable: Boolean(syncChannel) };
  }

  /**
   * Resume a backgrounded tab: catch up by document read-back (remote events
   * live in the other tab's Cana window, so replay cannot catch them up). A
   * tab that missed nothing pays no re-render.
   */
  async function resume() {
    if (!started) return { resynced: false, reason: 'not-started' };
    return resync('resume');
  }

  /**
   * Reconcile a save whose outcome Cana reported `'unknown'` (worker crash
   * after dispatch; Cana JUM-411) — surfaced, never silently assumed
   * successful. Read-back reconciliation: the stored document matching the
   * attempted payload confirms the write; anything else reloads the last
   * confirmed state so the designer never diverges from what is durable.
   *
   * @param {Object} result - the port's save result (`{status, reason}`).
   * @param {Object} [attemptedPayload] - the payload the save tried to write.
   */
  async function reportSaveOutcome(result, attemptedPayload) {
    if (!result || result.status === 'persisted') return { confirmed: true };
    notify(
      `A save could not be confirmed (${result.reason || 'unknown outcome'}); `
        + 'reconciling with the stored document.',
      'error'
    );
    const readBack = await store.load();
    if (readBack.status === 'ok') {
      const confirmed = attemptedPayload !== undefined
        && canonicalJson(readBack.payload) === canonicalJson(attemptedPayload);
      if (confirmed) {
        notify('The save was confirmed after reconciliation.', 'info');
        return { confirmed: true, reconciled: 'read-back-match' };
      }
      applyRemoteDocument(designerState, readBack.payload);
      render();
      notify(
        'The last save could not be confirmed; the designer reloaded the last confirmed state.',
        'error'
      );
      return { confirmed: false, reconciled: 'reloaded' };
    }
    notify(
      'The save outcome is unknown and the stored document could not be read back '
        + `(${readBack.status}). There is no fallback store: export your work now as a precaution.`,
      'error'
    );
    return { confirmed: false, reason: readBack.status };
  }

  /** Stop syncing: unsubscribe, drop any pending coalesced apply, release the channel. */
  function stop() {
    if (pendingFlush !== null) {
      cancelSchedule(pendingFlush);
      pendingFlush = null;
    }
    pendingRemote = null;
    coalescedCount = 0;
    if (typeof unsubscribe === 'function') {
      unsubscribe();
      unsubscribe = undefined;
    }
    if (ownsChannel && syncChannel && typeof syncChannel.close === 'function') {
      syncChannel.close();
    }
    syncChannel = null;
    started = false;
  }

  return {
    originId: syncOriginId,
    start,
    stop,
    resume,
    resync,
    reportSaveOutcome,
    onLocalEvent,
    onChannelMessage,
    flushPendingRemote,
    applyRemoteMessage,
    /** Test/diagnostic handle: the last Cana cursor this tab saw. */
    getLastCursor: () => lastCursor
  };
}
