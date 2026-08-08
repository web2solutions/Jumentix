/**
 * pwaShell.js — page-side half of the PWA shell (JUM-489): service worker
 * registration, the user-visible update flow, and the recovery path.
 *
 * Loaded by a small inline module script in `index.html`, deliberately NOT by
 * `script.js`: the PWA shell is orthogonal to the designer boot sequence
 * (JUM-484's Cana migration may rewire that boot), so the two never share a
 * code path beyond this file's own module.
 *
 * ## The update flow (why it asks instead of swapping)
 *
 * The service worker (sw.js) precaches the shell under a VERSIONED cache name
 * and never calls `skipWaiting()` on its own — a silent mid-edit swap would
 * replace code under unsaved editor state. When a shipped update arrives:
 *
 * 1. the new worker installs and WAITS (the old one still controls the page);
 * 2. this module shows a banner: "A new version is available" — with the
 *    explicit actions "Reload to update" and "Later";
 * 3. only on "Reload to update" does the page post `SKIP_WAITING` to the
 *    waiting worker; the worker activates, deletes stale versioned caches,
 *    claims clients, and the page reloads on `controllerchange`.
 *
 * A waiting worker survives dismissal: "Later" hides the banner, but the next
 * load finds `registration.waiting` already set and asks again — no user is
 * pinned to a stale version, and no edit session is ever swapped under.
 *
 * ## Recovery path
 *
 * The banner carries a "Reset app shell" action that requires no knowledge of
 * service workers: it unregisters every registration, deletes the shell
 * caches (the `service-management-shell@*` prefix ONLY), and reloads. It
 * never touches the designer's data — Cana (JUM-483/484) lives in a
 * different storage. Note the inverse is NOT true: the browser's "clear site
 * data" removes BOTH the shell caches and the Cana database (documented in
 * the README).
 *
 * The module is DOM-free in its logic: every browser global is injected (or
 * resolved through guarded defaults), so the unit suite exercises the whole
 * flow with fakes — no jsdom, no shims (Requirement 115 spirit).
 */

/* global navigator, window, document */

// Prefix shared with sw.js (a classic worker cannot import this module; this
// module must not import a non-module script). The unit suite pins the two
// copies equal — if you change one, change both in the same commit.
export const PWA_SHELL_CACHE_PREFIX = 'service-management-shell@';

export const SERVICE_WORKER_URL = './sw.js';
export const SKIP_WAITING_MESSAGE_TYPE = 'SKIP_WAITING';
export const UPDATE_BANNER_ID = 'pwa-update-banner';

function resolveDeps(overrides) {
  return {
    serviceWorkerContainer: overrides.serviceWorkerContainer !== undefined
      ? overrides.serviceWorkerContainer
      : (typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined),
    cacheStorage: overrides.cacheStorage !== undefined
      ? overrides.cacheStorage
      : (typeof window !== 'undefined' ? window.caches : undefined),
    documentRef: overrides.documentRef !== undefined
      ? overrides.documentRef
      : (typeof document !== 'undefined' ? document : undefined),
    locationRef: overrides.locationRef !== undefined
      ? overrides.locationRef
      : (typeof window !== 'undefined' ? window.location : undefined),
    serviceWorkerUrl: overrides.serviceWorkerUrl || SERVICE_WORKER_URL
  };
}

function buildBanner(documentRef, { message, actions }) {
  const banner = documentRef.createElement('div');
  banner.id = UPDATE_BANNER_ID;
  banner.className = 'pwa-update-banner';
  banner.setAttribute('role', 'alert');

  const text = documentRef.createElement('p');
  text.className = 'pwa-update-banner-message';
  text.textContent = message;
  banner.appendChild(text);

  const buttonRow = documentRef.createElement('div');
  buttonRow.className = 'pwa-update-banner-actions';
  actions.forEach(({ label, kind, onSelect }) => {
    const button = documentRef.createElement('button');
    button.type = 'button';
    button.className = `pwa-update-banner-btn pwa-update-banner-btn-${kind}`;
    button.dataset.pwaAction = kind;
    button.textContent = label;
    button.addEventListener('click', onSelect);
    buttonRow.appendChild(button);
  });
  banner.appendChild(buttonRow);
  return banner;
}

function removeBanner(documentRef) {
  const existing = documentRef.getElementById(UPDATE_BANNER_ID);
  if (existing && existing.parentNode) {
    existing.parentNode.removeChild(existing);
  }
}

function showBanner(documentRef, options) {
  removeBanner(documentRef);
  const banner = buildBanner(documentRef, options);
  documentRef.body.appendChild(banner);
  return banner;
}

/**
 * Deletes every cache with the shell prefix — and ONLY those. Designer data
 * (Cana) lives in a different storage and is never touched here.
 */
export async function clearShellCaches(cacheStorage) {
  if (!cacheStorage) return [];
  const names = await cacheStorage.keys();
  const shellNames = names.filter((name) => name.startsWith(PWA_SHELL_CACHE_PREFIX));
  await Promise.all(shellNames.map((name) => cacheStorage.delete(name)));
  return shellNames;
}

/**
 * The recovery path: unregister every service worker registration, delete the
 * shell caches, reload. Exported for tests; wired to the banner's
 * "Reset app shell" action.
 */
export async function resetPwaShell(deps) {
  const { serviceWorkerContainer, cacheStorage, locationRef } = resolveDeps(deps || {});
  if (serviceWorkerContainer) {
    const registrations = await serviceWorkerContainer.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }
  await clearShellCaches(cacheStorage);
  if (locationRef) locationRef.reload();
}

function showShellError(deps, message) {
  const { serviceWorkerContainer, cacheStorage, documentRef, locationRef } = deps;
  return showBanner(documentRef, {
    message,
    actions: [
      {
        label: 'Reset app shell',
        kind: 'reset',
        onSelect: () => {
          resetPwaShell({ serviceWorkerContainer, cacheStorage, locationRef })
            .catch(() => showShellError(deps, 'Could not reset the app shell.'));
        }
      },
      { label: 'Dismiss', kind: 'later', onSelect: () => removeBanner(documentRef) }
    ]
  });
}

/**
 * Shows the "new version available" banner for a registration whose waiting
 * worker holds the update. Reload posts SKIP_WAITING to the waiting worker;
 * the worker's activation claims the page, `controllerchange` fires, and the
 * reload lands on the new shell. No accept, no activation — the old shell
 * keeps serving until the user chooses.
 */
export function promptForUpdate(deps, registration) {
  const { serviceWorkerContainer, cacheStorage, documentRef, locationRef } = deps;

  let reloadOnControllerChange = false;
  serviceWorkerContainer.addEventListener('controllerchange', () => {
    // Guard: only the flow the user accepted may reload the page. A
    // controllerchange from any other path (e.g. first install) must not
    // bounce an edit session.
    if (reloadOnControllerChange && locationRef) {
      locationRef.reload();
    }
  });

  return showBanner(documentRef, {
    message: 'A new version of Service Management is available.',
    actions: [
      {
        label: 'Reload to update',
        kind: 'reload',
        onSelect: () => {
          const waiting = registration.waiting;
          if (!waiting) return;
          reloadOnControllerChange = true;
          waiting.postMessage({ type: SKIP_WAITING_MESSAGE_TYPE });
        }
      },
      {
        label: 'Later',
        kind: 'later',
        onSelect: () => removeBanner(documentRef)
      },
      {
        label: 'Reset app shell',
        kind: 'reset',
        onSelect: () => {
          resetPwaShell({ serviceWorkerContainer, cacheStorage, locationRef })
            .catch(() => {
              // Even a failed reset ends on the error banner, never silently.
              showShellError(deps, 'Could not reset the app shell.');
            });
        }
      }
    ]
  });
}

/**
 * Tracks a freshly discovered installing worker: when it reaches `installed`
 * while another worker still controls the page, an update is waiting and the
 * user must be asked. (On first install there is no controller — no prompt.)
 */
export function trackInstallingWorker(deps, registration, installingWorker) {
  installingWorker.addEventListener('statechange', () => {
    if (installingWorker.state === 'installed' && deps.serviceWorkerContainer.controller) {
      promptForUpdate(deps, registration);
    }
  });
}

/**
 * Registers the service worker and wires the update flow.
 *
 * Returns a result object instead of throwing so the inline boot snippet
 * stays trivial: `{ status: 'registered' | 'unsupported' | 'failed' }`.
 * Failure is LOUD: a registration error surfaces the recovery banner rather
 * than vanishing into the console.
 */
export async function registerPwaShell(overrides = {}) {
  const deps = resolveDeps(overrides);
  const { serviceWorkerContainer } = deps;

  if (!serviceWorkerContainer) {
    // No service worker support: the designer still works online exactly as
    // before — the shell is an enhancement, never a requirement.
    return { status: 'unsupported' };
  }

  let registration;
  try {
    registration = await serviceWorkerContainer.register(deps.serviceWorkerUrl);
  } catch (error) {
    showShellError(
      deps,
      `The offline shell failed to install (${error instanceof Error ? error.message : String(error)}). The designer still works online.`
    );
    return { status: 'failed', error };
  }

  // An update shipped while the user was away: a worker is already waiting.
  if (registration.waiting && serviceWorkerContainer.controller) {
    promptForUpdate(deps, registration);
  }

  registration.addEventListener('updatefound', () => {
    if (registration.installing) {
      trackInstallingWorker(deps, registration, registration.installing);
    }
  });

  return { status: 'registered', registration };
}
