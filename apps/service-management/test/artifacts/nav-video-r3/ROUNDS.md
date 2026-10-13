# Nav-video UX rounds — summary

Three sequential record → analyze → fix passes on Domain Designer focus/camera UX.

| Round | Capture shell | Fix shell | Video |
| ---: | --- | --- | --- |
| 1 | `0.9.136` | `0.9.137` | `apps/service-management/test/artifacts/nav-video-r1/tour.webm` |
| 2 | `0.9.137` | `0.9.138` | `apps/service-management/test/artifacts/nav-video-r2/tour.webm` |
| 3 | `0.9.138` | **`0.9.139`** | `apps/service-management/test/artifacts/nav-video-r3/tour.webm` |

Final shell pin: **`0.9.139`** (`sw.js` / `index.html` / capture scripts / browser tests).

## Per-round top fixes

### Round 1 → `.137`
- Stronger focus chrome vs soft/quiet depth (veil + dimmer soft edges)
- Toast offset attempt clear of mini-map
- Domain-focus camera bias toward home hull
- Entity settle transitions

### Round 2 → `.138`
- Toast parked **bottom-left** (clears mini-map + sidebar); faster designer info hide
- Soft depth dialed back to readable-behind (inset recess, lighter veil)
- Field camera seeds from owning entity + soft-peer hulls (stops title over-zoom)
- zoomFluidity `clamp-min` timeout hardened

### Round 3 → `.139`
- Relationship focus: one-hop soft peers + hull framing
- Focus-stage deep zoom blends anchor toward selection center (less void)
- Soft-domain inset outline faux-recede; quieter siblings slightly brighter

## Final suite counts

Command: `rtk proxy bun test apps/service-management/test/integration/browser/edgeRoutingFocus.browser.integration.test.ts apps/service-management/test/integration/browser/zoomFluidity.browser.integration.test.ts`

| Suite | Result |
| --- | --- |
| edgeRoutingFocus | **3 pass** |
| zoomFluidity | **14 pass** |
| **Total** | **17 pass / 0 fail** (55 expects) |

Capture tours: all three rounds **PASS** (midInside=0 throughout).

## Remaining polish

- True soft-domain CSS `scale` still deferred (edge-anchor alignment)
- Overview ContactPoint hull packing
- Edge skim at soft borders under curved routes
- WebKit headless MediaRecorder unavailable (Playwright `tour.webm` is primary)

## Artifact layout

Each round dir contains: `tour.webm`, `01`–`26` step PNGs, `frames/`, `MANIFEST.json`, `ANALYSIS.md`.
Round 3 also has this `ROUNDS.md`.
