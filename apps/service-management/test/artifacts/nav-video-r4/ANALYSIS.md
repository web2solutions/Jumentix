# Nav video Round 4 — ANALYSIS

- Recorded: 2026-10-11 (shell **0.9.139** at capture — R3 fixes live)
- Shell after fixes: **0.9.140**
- Video: `apps/service-management/test/artifacts/nav-video-r4/tour.webm`
- Verdict (probes): **PASS** (midInside=0; soft peers full inventory; edge-select soft=8)

## Findings this round (vision on R3 residuals)

1. **Soft domain still transform:none** — Users soft peer readable but same visual size as focus (`04`, `07`). Need true CSS scale + DOM anchors.
2. **ContactPoint hull packing** — Large empty band under Email/Phone inside Users (`03`, `05`, `22`). ContactPoint at y:650 / hull 900.
3. **Deep wheel zoom voids** — `13-zoom-wheel-in` still parks on empty canvas (relationship focus).
4. **Edge skim** — Cross-domain corridors graze soft-domain borders (`07`).
5. **Relationship soft peers OK** — `12-edge-select` keeps Users + Tasks (soft=8); R3 one-hop framing holds.
6. **Field framing** — `10-field-title` still Tasks-local (soft=0, quiet siblings); acceptable for title field.
7. **Toast / soft depth** — R2–R3 cues still good on overview + domain focus.

## Fixes applied (→ shell 0.9.140)

| Area | Change |
| --- | --- |
| Soft domain depth | True CSS `scale(0.94)` on `.domain.is-soft`; neutralize nested entity soft/quiet scales |
| Edge anchors | `domEntityAnchorPoint` via getBoundingClientRect; `edgeEndpoint` prefers DOM for side anchors |
| ContactPoint packing | Sample Users hull `900→760`; ContactPoint `y:650→548`; repair migrates prior spread |
| Deep zoom | Stronger focus-center blend (`0.24 + deep*0.5`, earlier deep ramp) |
| Edge skim | Domain obstacle pad `8→16` so corridors skirt soft borders |

## Residual (post R4 — future polish)

- Soft scale may still need slight dial (0.94 vs 0.92) after vision re-check.
- Deep zoom may still void under extreme wheel-in on thin corridors.
- Field focus soft-peer promotion when field is a cross-domain FK (assigneeId ok; title local).
- MediaRecorder/captureStream unavailable in WebKit headless (Playwright `tour.webm` primary).

## Key PNGs reviewed

`03-overview`, `04-domain-tasks`, `05-domain-users`, `07-entity-task`, `10-field-title`, `12-edge-select`, `13-zoom-wheel-in`, `22-esc-to-domain`
