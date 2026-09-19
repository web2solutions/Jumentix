# Service Management Design System and PWA Shell

This is the E7 document of the Service Management E1–E8 documentation chain
([JUM-490](https://linear.app/jumentix/issue/JUM-490/docs-e7-documentation-design-system-and-pwa-shell)).
It documents the two surfaces that define what the designer *looks like* and
*how it reaches the user's machine*: the **design-system adoption**
([JUM-488](https://linear.app/jumentix/issue/JUM-488/feature-adopt-jumentix-design-system-and-storybook-coverage))
and the **installable PWA shell**
([JUM-489](https://linear.app/jumentix/issue/JUM-489/feature-installable-pwa-shell-service-worker-manifest))
— exactly as the code behaves today, with the multi-tab sync gap closure
([JUM-485](https://linear.app/jumentix/issue/JUM-485/feature-write-event-integration-multi-tab-sync-via-cana-message))
already landed inside the shell.

Part of this document is contributor-facing (how the token layer stays in
sync, how to add a component without reintroducing ad-hoc styles) and part is
deliberately **user-facing**: the keyboard and screen-reader model, how to
install the designer as an app, what the update prompt means, and how to
recover from a stuck cache without knowing what a service worker is. A
keyboard path that exists but is undocumented is a path nobody finds.

Two deliberate boundaries:

- **The data story is linked, not duplicated.** Where the designer's work
  lives (Cana), how the localStorage migration behaved, and what offline
  means for *data* belong to the E6 document
  ([JUM-487](https://linear.app/jumentix/issue/JUM-487/docs-e6-documentation-cana-adoption-migration-and-offline-behavior)),
  with the storage port contract in the E3 document,
  [Service Management Module Architecture](./SERVICE-MANAGEMENT-MODULE-ARCHITECTURE.md).
  This document states the shell↔data boundary once — because the update and
  recovery story is incomprehensible without it — and does not restate the
  persistence story.
- **The visual source of truth lives on the website.** The component
  inventory, the design constraints and the Storybook workflow are owned by
  the website's
  [Design System and Storybook](../../apps/jumentix-website/documentation/DESIGN-SYSTEM-AND-STORYBOOK.md)
  document. This document covers the designer's *adoption* of that system;
  it does not redefine it.

## Design system adoption at the token layer (JUM-488)

The designer is a zero-build vanilla SPA served from its own static root. It
cannot import the website's React components, so adoption happens at the
**token layer**: shared custom properties and shared idioms, not shared
components.

### Which tokens the designer uses

[`apps/service-management/tokens.css`](../../apps/service-management/tokens.css)
vendors the website's
[`components/design-system/tokens.css`](../../apps/jumentix-website/components/design-system/tokens.css):
the color ramps (`--jtx-blue-*`, `--jtx-green-*`, `--jtx-coral-*`,
`--jtx-yellow-*`), ink and muted text, surfaces and lines, code-surface
background, radii, shadows, the 4–48 px spacing scale, `--jtx-motion-fast`,
`--jtx-content-width`, the dark-theme overrides under `:root.dark`, the
`prefers-reduced-motion` guard, and the `--jtx-font-sans` / `--jtx-font-mono`
typography stacks (Inter and IBM Plex Mono — the same type voice as the
website's Mantine theme).

[`styles.css`](../../apps/service-management/styles.css) resolves **every
cosmetic value** — color, typography, radius, shadow, spacing, motion — to
those tokens, loads after `tokens.css` in
[`index.html`](../../apps/service-management/index.html), and scopes its
element-level rules under `.service-management-shell` (with `:where()`) so
the exact app cascade applies when the website Storybook embeds the
stylesheet. What deliberately stays literal:

- **Structural geometry the canvas math depends on** — the 3200×2200 canvas,
  the 24 px grid, 520 px domains, 190 px entities — pinned by
  [`src/model/modelQueries.js`](../../packages/designer-core/src/model/modelQueries.js)
  and its unit suite. These numbers are behaviour, not cosmetics.
- **The compact inspector density** (5–7 px gaps in the dense panels), which
  has no token equivalent.
- **The attention-tone literals** — error styling follows the design system's
  "attention" idiom: `--jtx-coral-50` surface with coral-ramp text `#a32e1a`
  and border `#ffc0ad`, the same literals the website's `StatusBadge`
  component uses (no coral-ramp text token exists to reference).

Beyond colors, the designer follows the system's interaction idioms: the
focus ring is the design-system `:focus-visible` ring (3 px `--jtx-blue-200`,
2 px offset) on every input, select and button; hover follows the
secondary-action idiom (blue-50 surface, blue-200 border); motion respects
`prefers-reduced-motion` through the vendored guard.

### How tokens stay in sync — the vendored-copy rule

`apps/service-management/tokens.css` is a **copy**, and copies drift unless a
rule forbids it. The rule is written in the file's own header:

> SOURCE OF TRUTH: `apps/jumentix-website/components/design-system/tokens.css`.
> Keep the token values byte-identical with the website file; token changes
> land in the website file first and are mirrored here.

Two corollaries a contributor must know:

- **The website file is extended additively, never designer-first.** When the
  designer needed the typography stacks as tokens (JUM-488), they were added
  to the *website* file — because the vendored copy exists, non-Mantine
  consumers inherit the same type voice — and then mirrored down. A token
  added only to the designer's copy would be invisible to the website and
  silently deleted on the next mirror.
- **The `.jtx-story-canvas` Storybook wrapper is website-only** and is
  intentionally omitted from the vendored copy — it is the one sanctioned
  difference between the two files.

### How to add a component without reintroducing ad-hoc styles

1. **Reuse existing tokens before introducing a new value.** A cosmetic
   literal in `styles.css` is a regression to the pre-JUM-488 state; if no
   token fits, add a *semantic* token to the website's `tokens.css` first and
   mirror it into the vendored copy in the same change.
2. **Keep structural geometry literal only when the canvas math owns it** —
   and when it does, the number belongs in `modelQueries.js`'s pinned set,
   not invented per-component.
3. **Scope element-level rules under `.service-management-shell`.** An
   unscoped rule leaks into the Storybook chrome the moment the story mounts
   it.
4. **Add or extend a story** in the designer's Storybook coverage (below) so
   the new surface is exercised by the same static-build, smoke and
   accessibility gates as the rest.

### Where the Storybook inventory lives

The designer has no Storybook of its own; its coverage lives in the website
workspace as
[`components/service-management-designer/ServiceManagementDesigner.stories.tsx`](../../apps/jumentix-website/components/service-management-designer/ServiceManagementDesigner.stories.tsx),
which imports the designer's real `tokens.css` and `styles.css` and mounts
its real markup. Eight stories cover the key UI states: `TabShell`,
`WorkspaceControls`, `DomainCanvas` (entities, edges, mini-map),
`StatusSurfaces` (the JUM-543 non-blocking surfaces), `EntityInspector`,
`PanelsAndLists`, `CodePreviews` and `PwaUpdateBanner` (the JUM-489 update
prompt). Because the stylesheets are token-driven, the addon-themes
light/dark switch applies to the designer exactly as it does to the website
components.

The inventory is enforced, not aspirational:
[`scripts/storybook-smoke.mjs`](../../apps/jumentix-website/scripts/storybook-smoke.mjs)
requires all eight designer story IDs and a minimum catalog of 54 entries,
and the Storybook accessibility addon is configured to report violations as
errors (`a11y: { test: 'error' }` in
[`.storybook/preview.tsx`](../../apps/jumentix-website/.storybook/preview.tsx)).
Storybook is exclusively a website-workflow gate — run by the path-scoped
`.github/workflows/website.yml`, never by the monorepo test matrix — with
commands `bun run website:storybook`, `website:storybook:build` and
`website:storybook:smoke` from the root. The full workflow, ownership and
design constraints are documented in
[Design System and Storybook](../../apps/jumentix-website/documentation/DESIGN-SYSTEM-AND-STORYBOOK.md).

## Accessibility: the keyboard and screen-reader model

This section is user-facing. Everything in it is operable today and matches
the behaviour JUM-488 shipped; the semantic layer is exercised by the
Storybook accessibility gate (violations fail as errors), and tab switching
itself is exercised end-to-end by the browser suites below.

### The tab bar is a real tablist

The six visible tabs are a WAI-ARIA tablist (`role="tablist"`, `role="tab"`,
`aria-selected`, `aria-controls` in
[`index.html`](../../apps/service-management/index.html); behaviour in
[`src/ui/tabs.js`](../../apps/service-management/src/ui/tabs.js)):

- **One tab stop for the whole bar.** Roving `tabindex` puts only the active
  tab in the tab order; the others are reachable by arrow keys, not by
  repeated Tab presses.
- **Arrow keys move and activate.** `ArrowLeft`/`ArrowRight` cycle through
  the tabs (wrapping at the ends), `Home`/`End` jump to the first/last tab,
  and the focused tab activates automatically — there is no separate
  "confirm" step.
- **Space and Enter keep their native behaviour** on every button, including
  the tabs.

### Reaching the canvas: the skip link

The first tab stop on the page is the **skip link** ("Skip to canvas
workspace"), which jumps past the header and tab bar to the workspace
(`#workspace-main`). It is invisible until focused; the design-system focus
ring doubles as its reveal affordance.

### The canvas's non-visual equivalent

The domain canvas is a visual surface, but every structural operation has a
keyboard path — selection is never pointer-only:

- **Select without the pointer.** Every entry in the sidebar lists (domains,
  relationships) is a real `<button>`, rendered by
  [`src/ui/inspectors.js`](../../apps/service-management/src/ui/inspectors.js),
  and the "Search entity" field plus its **Find** button selects an entity and
  scrolls the canvas to it — so Tab + Enter selects an entity without touching
  the canvas.
- **Move the selection with the arrow keys.** With an entity selected and no
  input focused, the arrow keys nudge it 8 px (snap-aligned), `Shift`+arrow
  16 px — the same snap math the pointer drag uses (`script.js`'s global
  keyboard map).
- **Create relationships without the drag.** `Alt+R` starts relationship-pick
  mode from the selected entity (the keyboard equivalent of the anchor drag);
  `Escape` cancels relationship-pick mode or an anchor drag in progress, and
  clears the selected relationship.
- **Arrange and inspect.** `Alt+L` auto-layouts, `Alt+V` toggles compact
  view, `Ctrl`/`Cmd`+wheel zooms, and the workspace toolbar (zoom, fit,
  reset, snap, compact, large-canvas) is ordinary buttons. The three view
  switches (compact view, snap, large canvas) are `aria-pressed` toggles —
  [`src/ui/canvas.js`](../../apps/service-management/src/ui/canvas.js) keeps
  the pressed state in sync with the view flags they flip.
- **Edit history and deletion.** `Ctrl`/`Cmd+Z` undoes, `Ctrl`/`Cmd+Y` (or
  `Ctrl`/`Cmd+Shift+Z`) redoes; `Delete`/`Backspace` removes the selected
  relationship, and the selected entity after a confirmation gate.
- **Space still activates buttons.** The Space-held pan modifier engages only
  from non-interactive targets, so a keyboard user operating a focused button
  with Space triggers the button, never the pan.

### What a screen reader announces

- **A single polite live region** (`#status-region`, `role="status"`,
  `aria-live="polite"`) announces validation messages and API results — the
  JUM-543 status-surface contract the E5 document describes; info notices
  auto-hide, errors persist.
- **A selection status line** (`#selection-status`, also `role="status"`)
  announces which domain is selected as the selection changes.
- **Per-panel status lines** (PM2 preview, service configuration, runtime
  environment) are live regions too, so failures are announced where the user
  is looking.
- **Every control has an accessible name** — visible label or `aria-label` —
  and the PWA update banner is `role="alert"`, so the update prompt is
  announced, not just shown.
- **Every static control has reachable help** — JUM-733 turns static browser
  `title` text into an adjacent `?` control with `aria-expanded`,
  `aria-controls` and `aria-describedby`. The help text is available to
  keyboard and touch users, not only mouse hover. Hidden file inputs are the
  only static exemption because their visible import buttons carry the user
  action.

## Installing the designer as an app (JUM-489)

The designer is an installable PWA. The installable pieces are
[`manifest.webmanifest`](../../apps/service-management/manifest.webmanifest)
(name "Jumentix Service Management", short name "Service Mgmt", `standalone`
display, start URL and scope `./`, theme/background `#0f172a`, and SVG + PNG
icons including a maskable 512 px variant and the Apple touch icon, all under
[`icons/`](../../apps/service-management/icons)) and the service worker
([`sw.js`](../../apps/service-management/sw.js), a classic script served from
the app root so its scope is the whole app), registered by the page-side
[`src/pwa/pwaShell.js`](../../apps/service-management/src/pwa/pwaShell.js)
through a small inline module at the end of `index.html`.

**How to install** — the designer is served by
[`server.js`](../../apps/service-management/server.js), by default at
`http://127.0.0.1:3200`:

- **Chromium browsers (Chrome, Edge):** the install affordance in the address
  bar, or the browser menu's "Install" / "Save and share" entry.
- **Safari on macOS:** File → "Add to Dock". **Safari on iOS:** Share → "Add
  to Home Screen".
- **Any other modern browser:** the designer works identically in an ordinary
  tab; installation is an enhancement, never a requirement.

There is deliberately **no custom install button** in the app — installation
is the browser's native UI, and the app never intercepts it.

**What installing changes:** the designer opens in its own window (standalone
display) with its own icon, and the shell is precached so it loads offline
(next section). **What installing does not change:** the features, the data,
or the update cadence — the installed app is the same app, served and updated
by the same mechanisms as the tab.

## Updates and recovery — written for the user

A cache-first shell is a cache with no expiry that the user cannot see, so
the update path is the substance of the PWA work, not an afterthought.

**How the designer updates.** The shell is precached under a **versioned
cache name** (`service-management-shell@<version>`; `SHELL_VERSION` in
`sw.js`, bumped on every shell change), and the worker never activates a new
version on its own — a silent mid-edit swap would replace code under unsaved
editor state. When a shipped update arrives:

1. The new version installs and **waits**; the version you are running keeps
   serving. Nothing changes mid-session.
2. A banner appears: **"A new version of Service Management is available."**
   with three actions — **Reload to update**, **Later**, **Reset app shell**.
   The banner is `role="alert"`, so it is announced to screen readers.
3. **Reload to update** switches to the new version and reloads the page —
   this is the only path that activates an update. **Later** dismisses the
   banner without updating; the prompt returns on the next load, so dismissing
   never pins you to a stale version.

**Recovering from a stuck cache.** If the shell ever misbehaves — a failed
offline-shell install surfaces a banner of its own ("The offline shell failed
to install … The designer still works online.") — the **Reset app shell**
action is the recovery path, and it requires no knowledge of what a service
worker is: it unregisters the worker, deletes **only** the
`service-management-shell@*` caches, and reloads. The next load fetches a
fresh shell from the server. Reset never touches the designer's data, which
lives in a different storage (the boundary below).

**Proven by:**
[`pwaShell.test.ts`](../../apps/service-management/test/unit/pwaShell.test.ts)
(worker handlers, update flow, recovery — with injected fakes, including the
on-disk check that every committed precache entry exists) and
[`pwaShell.browser.integration.test.ts`](../../apps/service-management/test/integration/browser/pwaShell.browser.integration.test.ts),
which runs against the real server in a real WebKit browser: manifest and
worker content types, precache↔static-manifest agreement (the JUM-463
alignment — the precache list, including JUM-485's `designerSync.js` entry
and the generated Cana bundle, must be exactly what the server serves),
registration under the versioned cache name, **the shell loading and staying
interactive with the server actually killed** (a real dead server, not an
emulated offline mode), and the full update flow — prompt shown, no silent
swap, stale caches cleaned on activation.

**Offline scope.** With the network disabled the **shell** loads and stays
interactive — that is the whole offline contract of the PWA work. The worker
serves the precached shell cache-first and nothing else: `/api/` responses,
non-GET requests and cross-origin requests pass straight to the network (and
fail naturally offline), and **zero application data is cached** — a
convenience copy in the Cache API would be a fallback by the back door, with
weaker guarantees than the store it shadows. What offline means for your
*data* is Cana's story, told by the E6 document.

## The storage boundary: what installing does not do

**Installing the designer does not back up your work.** The shell and the
data are separate storages with separate lifecycles:

- The **shell** (HTML, CSS, JS, manifest, icons) lives in the Cache API under
  `service-management-shell@*` — disposable, regenerable from the server at
  any time, and exactly what "Reset app shell" deletes.
- The **data** (your designs) lives in the Cana database — never cached by
  the service worker, never touched by "Reset app shell".

One asymmetry every user should know: the browser's own **"clear site data"**
(or clearing browsing data for this origin) removes **both** — the shell
caches *and* the Cana database. The shell being present never implies your
designs are safe; there is no copy of your work in the shell to fall back to.
Export your designs through the designer's exporters when you want a durable
copy.

The full data story — the Cana adoption, the one-way localStorage migration
and its backup download, multi-tab sync, and offline data behaviour — is
owned by the E6 document
([JUM-487](https://linear.app/jumentix/issue/JUM-487/docs-e6-documentation-cana-adoption-migration-and-offline-behavior));
the storage port contract is in
[Service Management Module Architecture](./SERVICE-MANAGEMENT-MODULE-ARCHITECTURE.md)
(E3) and the Cana usage rules in
[Cana Usage Guide](./CANA-USAGE-GUIDE.md). This document states the boundary
once and defers to them rather than maintaining a second, drifting
explanation.

## What this document deliberately does not cover

- **The data story in full** — E6
  ([JUM-487](https://linear.app/jumentix/issue/JUM-487/docs-e6-documentation-cana-adoption-migration-and-offline-behavior))
  and the E3 document own it; only the shell↔data boundary is stated here.
- **The website's component inventory and design constraints** — owned by
  [Design System and Storybook](../../apps/jumentix-website/documentation/DESIGN-SYSTEM-AND-STORYBOOK.md);
  this document covers the designer's token-layer adoption of that system.
- **The operations console and its status-surface contract** — the E5
  document, [Service Management Operations Console](./SERVICE-MANAGEMENT-OPERATIONS-CONSOLE.md);
  the live-region model is summarized here only as far as the screen-reader
  story requires.
- **The static-serving manifest rules** (boot-only vs on-miss) — documented
  in the [application README](../../apps/service-management/README.md); the
  precache↔static-manifest agreement is mentioned here only because the PWA
  tests pin it.

## References

- Token layer: [`apps/service-management/tokens.css`](../../apps/service-management/tokens.css) (vendored; source of truth [`components/design-system/tokens.css`](../../apps/jumentix-website/components/design-system/tokens.css)), [`styles.css`](../../apps/service-management/styles.css), [`index.html`](../../apps/service-management/index.html)
- Accessibility behaviour: [`src/ui/tabs.js`](../../apps/service-management/src/ui/tabs.js), [`src/ui/canvas.js`](../../apps/service-management/src/ui/canvas.js), [`src/ui/inspectors.js`](../../apps/service-management/src/ui/inspectors.js), the global keyboard map in [`script.js`](../../apps/service-management/script.js); structural geometry pinned by [`src/model/modelQueries.js`](../../packages/designer-core/src/model/modelQueries.js)
- Storybook coverage: [`ServiceManagementDesigner.stories.tsx`](../../apps/jumentix-website/components/service-management-designer/ServiceManagementDesigner.stories.tsx), [`storybook-smoke.mjs`](../../apps/jumentix-website/scripts/storybook-smoke.mjs), [`.storybook/preview.tsx`](../../apps/jumentix-website/.storybook/preview.tsx)
- PWA shell: [`manifest.webmanifest`](../../apps/service-management/manifest.webmanifest), [`sw.js`](../../apps/service-management/sw.js), [`src/pwa/pwaShell.js`](../../apps/service-management/src/pwa/pwaShell.js), [`icons/`](../../apps/service-management/icons), [`server.js`](../../apps/service-management/server.js)
- Suites: [`pwaShell.test.ts`](../../apps/service-management/test/unit/pwaShell.test.ts), [`pwaShell.browser.integration.test.ts`](../../apps/service-management/test/integration/browser/pwaShell.browser.integration.test.ts), [`spaBoot.browser.integration.test.ts`](../../apps/service-management/test/integration/browser/spaBoot.browser.integration.test.ts), [`modelQueries.test.ts`](../../apps/service-management/test/unit/modelQueries.test.ts)
- Requirements: [076](../../.agents/requirements/project/076-task-documentation-and-bilingual-governance.md) (EN/PT parity)
- Sibling E-chain documents: [Runtime Environment Contracts](./RUNTIME-ENVIRONMENT-CONTRACTS.md) (E1), [Service Management Module Architecture](./SERVICE-MANAGEMENT-MODULE-ARCHITECTURE.md) (E3), [Service Management Contract Parity Guarantees](./SERVICE-MANAGEMENT-CONTRACT-PARITY.md) (E4), [Service Management Operations Console](./SERVICE-MANAGEMENT-OPERATIONS-CONSOLE.md) (E5), [Cana Usage Guide](./CANA-USAGE-GUIDE.md), [Design System and Storybook](../../apps/jumentix-website/documentation/DESIGN-SYSTEM-AND-STORYBOOK.md) (website), [Service Management Application](./SERVICE-MANAGEMENT-APPLICATION.md)
- Linear: [JUM-488](https://linear.app/jumentix/issue/JUM-488/feature-adopt-jumentix-design-system-and-storybook-coverage), [JUM-489](https://linear.app/jumentix/issue/JUM-489/feature-installable-pwa-shell-service-worker-manifest), [JUM-485](https://linear.app/jumentix/issue/JUM-485/feature-write-event-integration-multi-tab-sync-via-cana-message), [JUM-487](https://linear.app/jumentix/issue/JUM-487/docs-e6-documentation-cana-adoption-migration-and-offline-behavior), [JUM-490](https://linear.app/jumentix/issue/JUM-490/docs-e7-documentation-design-system-and-pwa-shell)
