# Playwright Zoom Fluidity + Edge Cases (JUM-918 follow-up)

**Shell expected:** `0.9.144` (`sw.js` + `script.js?v=` + CSS query)

## Goal

Wheel / toolbar / keyboard zoom must feel like a camera (pointer-anchored, 60FPS chase), not a stepped CSS snap. Massive edge-case coverage blocks regressions.

## Implementation markers

| Symbol | Role |
| --- | --- |
| `beginOrRetargetUserZoom` | Start/retarget fluid user zoom |
| `applyAnchoredZoomFrame` | Keep model point under cursor |
| `tickUserZoom` | Exp-smooth chase @ ~60FPS |
| `USER_ZOOM_LAMBDA` | Snappier than focus Camera3 |
| `dataset.userZooming` | Live flight marker for tests/CSS |

## Edge-case matrix

1. Wheel zoom in / out settles
2. Rapid wheel retarget mid-flight
3. Toolbar `+` / `-`
4. Keyboard `=` / `-`
5. Clamp max `2.5` / min `0.25`
6. Pointer anchor drift budget
7. Shift+wheel → pan only (no zoom)
8. Ctrl+wheel (pinch) still zooms
9. `deltaMode` LINE + PAGE
10. Wheel interrupts focus Camera3
11. Fit / Reset then wheel

## Commands

```bash
rtk proxy bun test apps/service-management/test/integration/browser/zoomFluidity.browser.integration.test.ts
rtk proxy bun apps/service-management/scripts/capture-zoom-edge-cases.mjs
```

Artifacts: `apps/service-management/test/artifacts/zoom-fluidity-playwright/`

## Hard Reload

Live Brave may still hold SW `0.9.128`. Unregister SW + Hard Reload so `script.js?v=0.9.144` loads before judging feel.
