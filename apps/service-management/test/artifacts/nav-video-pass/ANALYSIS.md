# Nav video pass — ANALYSIS

- Generated: 2026-10-11 (after fixes)
- Branch: `cursor/feature/edge-focus-camera3-mvp`
- Shell: **0.9.133** (bumped from 0.9.132)
- Mode: short verify after fixes (full tour captured earlier for before-state)
- Playwright video: `tour.webm`
- MediaRecorder: unavailable in WebKit headless (`Element.captureStream` missing) — Playwright `recordVideo` is the primary artifact
- ffmpeg frames: under `frames/` (fps=2)

## Findings (before → after)

### 1. Esc → overview left Users truncated (1 of 5 cards)
- **Before:** Soft-peer focus filtered Users to endpoint cards only. `showOverview` skipped remount because `setSelectedDomain(null)` already flipped `canvasStage` and cleared depth classes before camera settle. midInside also spiked (3) on domain/overview Esc.
- **After:** `showOverview` always remounts domains/edges on settle. Esc entity→domain remounts peers. Users restores to 5 cards; midInside=0.
- **Fix:** `canvas.js` `showOverview`; `script.js` Escape ladder remount flags.

### 2. Fit / Reset destroyed focus stage (depth CSS stopped applying)
- **Before:** Fit/Reset called `showOverview`, forcing `stage=overview` while selection stayed entity — soft/quiet classes present but scale CSS (`[data-canvas-stage="focus"]`) inactive (computed scale ≈ 1).
- **After:** Fit/Reset re-frame the live selection and keep `stage=focus` when something is selected.
- **Fix:** `canvas.js` `fitView` / `resetView`.

### 3. Same-domain siblings promoted to soft instead of quiet
- **Before:** Task focus marked Project/Comment as `is-soft` (0.82) because they are edge endpoints.
- **After:** Soft = cross-domain endpoints only; same-domain siblings are quiet (0.58). Task focus: soft=2 (Users+User), quiet=2 (Project, Comment).
- **Fix:** `canvas.js` `syncSelectionClasses` cross-domain soft rule.

### 4. Soft/quiet peer clicks were dead
- **Before:** (a) soft domains stacked under `.edges` (z-index 18); (b) entity name `pointerdown`/`click` `stopPropagation` swallowed re-focus; (c) same-entity click used `remountCanvas:false` even when hopping peers; (d) cross-entity field hops skipped remount.
- **After:** Soft/quiet/focus domains z-index 19–22; name field selects peer when not focused; entity hop remounts; field hop remounts when entity changes. Peer click reaches User (Users:5 restored).
- **Fix:** `styles.css` focus-stage domain z-index; `canvas.js` name/entity click + onEnd; `script.js` `setSelectedField`.

### 5. Relationship quiet chip looked like a 0-entity ghost
- **Before:** Quiet outsider domains collapsed with empty DOM; probe flagged ghost.
- **After:** Quiet chips label `N in background` (model count). Soft empty peers remain the real ghost signal.
- **Fix:** `canvas.js` quiet count label; analysis probe refined.

### 6. Shell pin
- Bumped `sw.js` / `index.html` / capture scripts / browser tests to **0.9.133**.

## Re-verify status

| Check | Result |
| --- | --- |
| Short nav-video tour | **clean** (exit 0) — midInside 0 all steps; overview Users:5; fit keeps focus; peer click changes scope |
| `edgeRoutingFocus.browser.integration.test.ts` | **3 passed** |
| `zoomFluidity.browser.integration.test.ts` | **14 passed** |
| Playwright `tour.webm` | written |
| MediaRecorder secondary | unavailable (WebKit headless) — expected |

## Step matrix (short after)

See `MANIFEST.json` for full probes. Highlights:

| Step | Focus | Stage | midInside | soft | quiet |
| --- | --- | --- | ---: | ---: | ---: |
| entity-task | entity | focus | 0 | 2 | 2 |
| fit-view | entity | focus | 0 | 2 | 2 |
| esc-to-overview | none | overview | 0 | 0 | 0 |
| refocus-quiet-peer | field/entity on User | focus | 0 | ≥2 | ≥0 |

## Artifacts

- `tour.webm` — continuous Playwright WebKit recording
- `NN-*.png` — per-step screenshots
- `frames/frame-*.png` — ffmpeg extract
- `MANIFEST.json` — machine probes + findings
