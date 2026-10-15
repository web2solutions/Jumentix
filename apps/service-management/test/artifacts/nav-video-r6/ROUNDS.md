# Nav-video UX rounds — summary (r4–r6)

Three MORE sequential record → analyze → fix passes after r1–r3.

| Round | Capture shell | Fix shell | Video |
| ---: | --- | --- | --- |
| 1 | `0.9.136` | `0.9.137` | `apps/service-management/test/artifacts/nav-video-r1/tour.webm` |
| 2 | `0.9.137` | `0.9.138` | `apps/service-management/test/artifacts/nav-video-r2/tour.webm` |
| 3 | `0.9.138` | `0.9.139` | `apps/service-management/test/artifacts/nav-video-r3/tour.webm` |
| 4 | `0.9.139` | `0.9.140` | `apps/service-management/test/artifacts/nav-video-r4/tour.webm` |
| 5 | `0.9.140` | `0.9.141` | `apps/service-management/test/artifacts/nav-video-r5/tour.webm` |
| 6 | `0.9.141` | **`0.9.142`** | `apps/service-management/test/artifacts/nav-video-r6/tour.webm` |

Final shell pin: **`0.9.142`** (`sw.js` / `index.html` / capture scripts / browser tests).

Capture out-dir: `NAV_VIDEO_OUT` env (or `--out=`) on `capture-nav-video-mvp.mjs`.

## Per-round top fixes (r4–r6)

### Round 4 → `.140`
- True soft-domain CSS `scale(0.94)` + `domEntityAnchorPoint` (no nested entity scale compound)
- ContactPoint hull packing (`y:650→548`, Users height `900→760`) + repair migrate
- Stronger deep-zoom blend; domain obstacle pad for edge skim

### Round 5 → `.141`
- `selectionZoomAnchorPoint()` for relationship endpoint mid (not soft-hull void)
- Cross-domain highway lift clears domain tops/bottoms (edge skim)
- Capture probe counts soft-domain / quiet-entity scales

### Round 6 → `.142`
- Zoom anchor locks to focused **entity/field/domain** (entity wheel-in no longer tracks soft-union void)
- Soft domain dial `0.94→0.92`

## Cumulative note (r1–r3 → r4–r6)

| Theme | r1–r3 | r4–r6 |
| --- | --- | --- |
| Soft depth | Dim / veil / inset outline (no domain scale) | True CSS soft-domain scale + DOM anchors |
| Camera | Domain bias, field peer hulls, rel one-hop | Zoom anchor away from soft-union void |
| Packing | — | ContactPoint hull tightened |
| Edges | Soft-edge dim, one-hop peers | Highway clearance off soft borders |
| Chrome | Toast bottom-left, quiet opacity | Soft scale dial + probe honesty |

r1–r3 detail: `apps/service-management/test/artifacts/nav-video-r3/ROUNDS.md`.

## Final suite counts

Command: `rtk proxy bun test apps/service-management/test/integration/browser/edgeRoutingFocus.browser.integration.test.ts apps/service-management/test/integration/browser/zoomFluidity.browser.integration.test.ts`

| Suite | Result |
| --- | --- |
| edgeRoutingFocus | **3 pass** |
| zoomFluidity | **14 pass** |
| **Total** | **17 pass / 0 fail** (55 expects) |

Capture tours r4–r6: all **PASS** (midInside=0 throughout).

## Remaining polish

- Soft scale per-scenario tuning (domain vs entity)
- Wider Users grid to co-row ContactPoint with Email/Phone
- Curved overview skim vs orthogonal highway clearance
- Capture wheel still aims canvas center (blend mitigates)
- WebKit headless MediaRecorder unavailable (Playwright `tour.webm` primary)

## Artifact layout

Each round dir: `tour.webm`, `01`–`26` step PNGs, `frames/`, `MANIFEST.json`, `ANALYSIS.md`.
This file lives in r6 and covers r4–r6 + cumulative link to r1–r3.
