# Ext JS Kitchen Sink — Component Reverse Engineering

Source: [Ext JS Kitchen Sink](https://examples.sencha.com/extjs/8.0.0/examples/kitchensink/)  
Measured build: Classic **Triton** theme, Ext **7.8.0.33** (`KitchenSink-all_*.css`).  
Walk coverage: **267/267** leaf examples, **0** navigation errors.

This note extracts the *component contracts* (structure, tokens, behavior) — not Sencha code — so the Domain Designer right rail can match or beat ExtJS usability without pulling ExtJS itself.

## Skin decision (locked)

**Jumentix Domain Designer keeps and improves its current dark skin.** We do **not** adopt Ext Triton/Material light surfaces. Ext skins are a catalog of *geometry and hierarchy* only; paint stays Jumentix dark (`#12141a` rail family, coral `#f05a28` brand hover, blue `#60a5fa` selection/primary).

### ExtJS skins offered

**Classic:** `theme-classic`, `theme-gray`, `theme-neptune`, `theme-neptune-touch`, `theme-crisp`, `theme-crisp-touch`, `theme-triton`.

**Modern:** `theme-material` (supports `darkMode`), `theme-ios`, `theme-triton`, `theme-neptune`.

Closest *behavioral* dark reference: Material `darkMode` + our designer hardcodes — not Triton light.

---

## 1. Taxonomy (what ExtJS specializes)

| Category | Folders | Leaves | Job |
| --- | ---: | ---: | --- |
| Components | 17 | 121 | Buttons, forms, layouts, panels, tabs, toolbars, windows |
| Grids | 3 | 33 | Tabular edit / property inspect |
| Charts | 15 | 61 | Visualization |
| Pivot Grids | 0 | 16 | Aggregation |
| D3 | 4 | 16 | Hierarchy / heatmap |
| Trees | 0 | 10 | Nested navigation |
| Calendar | 0 | 6 | Scheduling |
| Templates | 0 | 4 | Auth shells |

**Design rule ExtJS never breaks:** one leaf = one responsibility. Login Form ≠ Contact Form ≠ Field Types. Our rail must follow the same rule (Domains ≠ Entities ≠ Edit ≠ History ≠ Validate ≠ Diff ≠ Export ≠ Import).

---

## 2. Shell layout (KitchenSink chrome)

Master–detail border layout:

1. **West** — searchable tree (`Examples`)
2. **Center** — one live example (title bar + body)
3. **East** — collapsible `Details` (code preview), collapsed by default

Implication for Domain Designer: canvas = center; accordion rail = specialized west/east panels; never dump unrelated actions into one cell.

---

## 3. Measured Triton tokens

| Token | Value | Role |
| --- | --- | --- |
| `--ext-font` | `'Open Sans', Helvetica Neue, …` | Body + chrome |
| `--ext-font-size` | `13px` / weight `300` | Body text |
| `--ext-ink` | `#404040` | Primary text |
| `--ext-ink-on-accent` | `#f0f0f0` | Title / primary button text |
| `--ext-accent` | `#5fa2dd` | Panel header, primary button, focus ring |
| `--ext-accent-focus` | `#77b0e2` | Field focus border |
| `--ext-surface` | `#ffffff` | Panel body, toolbar, field fill |
| `--ext-surface-muted` | `#ececec` / `#e9e9e9` | App chrome / accordion hd |
| `--ext-surface-toolbar-btn` | `#f6f6f6` | Toolbar button face |
| `--ext-line` | `#d0d0d0` | Borders |
| `--ext-select` | `#ffefbb` | Grid selected row |
| `--ext-hover` | `#eaeff4` | Grid hover row |
| `--ext-radius` | `0` | Sharp corners (Triton) |
| Field min-height | `30–32px` | Text + label row |
| Panel header pad | `11–12px 15–16px` | Title bar density |
| Button pad (small) | `7px` | Primary / toolbar |
| Button font | `400 12px/16px` | Inner label |

---

## 4. Component anatomy (DOM contracts)

### 4.1 Panel

```
.x-panel
  .x-panel-header          // accent bar, tools docked
    .x-title > .x-title-text
    .x-tool…               // pin / gear / collapse
  .x-panel-bodyWrap
    .x-panel-body          // white surface, 1px #d0d0d0
```

CSS facts:

- Header border/background: `#5fa2dd`
- Title: `16px/400`, color `#f0f0f0`, **no** uppercase transform
- Body: `#fff`, ink `#404040`, font `300 13px`

### 4.2 Accordion

```
.x-accordion-layout-ct     // padding 5px 5px 0; bg #fff
  .x-accordion-item.x-panel
    .x-accordion-hd        // bg #ececec; pad 12px 10px
    .x-panel-body          // only when expanded
```

Behavior:

- Header tools: collapse (`+/-`), optional pin/gear
- Sibling headers stay visible; **one content region owns height**
- Hover header: `#f6f6f6`

### 4.3 Form field

```
.x-field.x-form-item
  .x-form-item-label       // min-height 32px; pad-top 8px
  .x-form-item-body
    .x-form-trigger-wrap   // 1px #d0d0d0; focus → #77b0e2
      .x-form-text         // min-height 30px; pad 5px 10px 4px
      .x-form-trigger…     // clear / search / spinner
```

Field Types leaf demonstrates: text, password, file, textarea, display, number, checkbox, radio, date, time — each a **typed** control, never a raw dump.

### 4.4 Button

| UI | Face | Inner text |
| --- | --- | --- |
| `default-small` (primary) | `#5fa2dd`, radius 0, pad 7px | `#f0f0f0` 12px/400 |
| `default-toolbar-small` | `#f6f6f6`, radius 0, pad 7px | `#606060` 12px/400 |

Scales: `small` / `medium` / `large`. Icon align: left|right|top|bottom.

### 4.5 Segmented button

`.x-segmented-button { display:table; table-layout:fixed }` — related actions share one strip (export formats, view modes).

### 4.6 Toolbar

`.x-toolbar-default`: white face, `1px #d0d0d0`, pad `6px 0 6px 8px`. Hosts toolbar-ui buttons, not primary blue CTAs.

### 4.7 Grid / Property Grid / List

- Row hover: `#eaeff4`
- Row selected: `#ffefbb`
- Property Grid = two-column key/value editor (inspector pattern)

### 4.8 Tabs

Tab bar reuses accent `#5fa2dd`, height ~44px. Active tab is a **mode**, not a second sidebar.

---

## 5. Usability rules derived from ExtJS

1. **Specialize leaves** — never mix Create + Import + Validate in one cell.
2. **Header = identity** — title names the job; tools are optional and right-docked.
3. **Collapsed by default for secondary** — Details rail, nested fieldsets.
4. **Consistent field geometry** — 30–32px controls, label+body contract.
5. **Button hierarchy** — primary (accent) vs toolbar (neutral) vs danger.
6. **Segment related actions** — export formats as one segmented strip.
7. **Selection opens owner** — click row → Property/Edit panel, exclusive expand.
8. **No raw scroll dumps** — previews live in nested Details, not the cell body.

---

## 6. Domain Designer mapping

| ExtJS contract | Domain Designer cell |
| --- | --- |
| Accordion item | `.sidebar-accordion-cell` |
| Panel header title | `.sidebar-accordion-title` |
| Panel body | `.sidebar-accordion-body > .panel` |
| Form field | `.jx-field` (label + control) |
| Toolbar row | `.jx-toolbar` / `.row` |
| Primary button | `.jx-btn.jx-btn-primary` |
| Toolbar button | `.jx-btn` |
| Danger button | `.jx-btn.jx-btn-danger` |
| Segmented strip | `.jx-segmented` (Export formats) |
| Selectable list | `#domain-list.list` → Ext-like row states |
| Property / Edit | Edit accordion + inspector panels |
| Details (code) | nested `<details class="sidebar-nested-details">` |

Dark adaptation keeps Ext **geometry and hierarchy**, remaps Triton light surfaces to **improved Jumentix dark** (`--jx-*` under `#tab-domain-designer`). Primary CTA uses designer blue; brand hover keeps coral.

---

## 7. Evidence files

- Measured walk + style samples: `extjs-reverse-engineer.json`
- Live CSS source: `KitchenSink-all_1.css` (Triton)
- Future framework seed: `JUMENTIX-UI-FRAMEWORK-SEED.md`

---

## 8. Out of scope (this delivery)

We do **not** vendor ExtJS (license + size). We reverse-engineer contracts and reimplement with semantic HTML + CSS under `#tab-domain-designer`. No multi-skin runtime, no light Triton port, no `packages/jumentix-ui` package yet (see seed doc).
