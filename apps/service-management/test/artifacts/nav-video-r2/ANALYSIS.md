# Nav video Round 2 — ANALYSIS

- Recorded: 2026-10-11 (shell **0.9.137** at capture — R1 fixes live)
- Shell after fixes: **0.9.138**
- Video: `apps/service-management/test/artifacts/nav-video-r2/tour.webm`
- Verdict (probes): **PASS** (midInside=0; soft peers full inventory)

## Findings this round (vision on R1 residuals)

1. **Toast still near mini-map** — Viewport `right/bottom` offset still left toast over canvas chrome; R1 calc did not clear sidebar+minimap (`03`, `04`).
2. **Soft depth overshot** — Users soft peer became nearly illegible / over-blurred; corridor context lost (`04`, `06`, `07`). Need readable-but-behind, not blackout.
3. **Field focus over-zooms** — Non-FK fields (`10-field-title`) framed the thin field row → Task alone, quiet siblings + soft peers off-camera.
4. **Deep wheel zoom emptiness** — `13-zoom-wheel-in` still fragments entities / void canvas (user zoom residual).
5. **zoomFluidity clamp-min** — 36× zoom-out clicks timed out at default 5s (suite flake, not UX).

## Fixes applied (→ shell 0.9.138)

| Area | Change |
| --- | --- |
| Toast | Bottom-left park when designer active; info toast hide 3.2s in designer |
| Soft depth | Opacity 0.76 + lighter veil; inset recess shadow (scale-free depth) |
| Soft edges | Opacity 0.70 (readable corridors) |
| Field camera | Seed from owning entity; union soft-peer domain hulls; bias to field |
| Tests | `clamps at min` timeout 15s + longer idle wait |

## Residual for Round 3

- Soft-domain *true* visual scale still blocked by edge anchors — explore clip/inset or layout packing.
- Deep user zoom re-center / peer-aware zoom clamp during focus.
- Relationship focus framing + edge skim at soft domain borders.
- Quiet same-domain siblings could use slightly clearer settle vs soft endpoints.
- Overview ContactPoint hull clipping.

## Key PNGs reviewed

`03-overview`, `04-domain-tasks`, `06-entity-user`, `07-entity-task`, `09-field-assigneeId`, `10-field-title`, `13-zoom-wheel-in`, `25-refocus-quiet-peer`
