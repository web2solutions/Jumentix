# Modelo de componentes em classes do Service Management

UI em classes ES vanilla em `apps/service-management`. Sem React/Vue. Cada aba
é um `TabApplication`; o chrome compartilhado vive em `Component`. A lógica de
domínio permanece em `@jumentix/designer-core`.

## Por quê

O shell cresceu como factories `create*` ligadas em `script.js`. Isso não
escala: abas compartilham closures opacas, superfícies filhas não têm dono, e
UI nova continua caindo no monólito. O modelo de classes dá a cada aba e filho
um dono nomeado, ciclo mount/destroy explícito e uma pasta por aba.

## Tipos centrais

| Classe | Caminho | Papel |
| --- | --- | --- |
| `Component` | `src/ui/component/Component.js` | Base: `el`, filhos, `on`/`mount`/`destroy`/`render` |
| `TabApplication` | `src/ui/component/TabApplication.js` | App da aba: `key`, `activate`/`deactivate`, `ctx` |
| `TabHost` | `src/ui/app/TabHost.js` | Chrome da tablist, hash, teclado ARIA |
| `ServiceManagementApp` | `src/ui/app/ServiceManagementApp.js` | Host do shell; registra todas as abas |
| `LegacyTabApplication` | `src/ui/app/LegacyTabApplication.js` | Adaptador até a aba ser totalmente migrada |

## Layout de pastas

```
src/ui/component/          # Component, TabApplication
src/ui/app/                # ServiceManagementApp, TabHost, LegacyTabApplication
src/ui/tabs/<tab-key>/     # Um TabApplication + filhos por aba
src/ui/shared/             # Só cross-tab (futuro: ControlHelp, …)
```

## Regras

1. UI nova do SM é `class extends Component|TabApplication` sob `src/ui/…`.
2. Não adicionar novas factories `create*` no shell. Factories legadas são
   allow-list até o PR da aba removê-las.
3. Uma aba não importa filhos de outra. Compartilhar só via `src/ui/shared/`
   ou designer-core.
4. Classes de UI não reimplementam model/validation — chamam designer-core.

## Estado da migração

| Aba | Classe | Status |
| --- | --- | --- |
| Architecture | `ArchitectureTab` + filhos EmptyState/Coach | Migrada (controller do canvas ainda é factory atrás da aba) |
| Domain Designer | `DomainDesignerTab` | Stub → hooks Legacy; próximo peel |
| Interface Designer | `InterfaceDesignerTab` | Stub |
| Service Config | `ServiceConfigTab` | Stub |
| Deploy Management | `DeployManagementTab` | Stub |
| Monitoring | `MonitoringTab` | Stub |
| OpenAPI | `OpenApiTab` | Stub (próximo após Architecture) |
| Code Workspace | `CodeWorkspaceTab` | Stub |

Ordem sugerida após Architecture: OpenAPI → Monitoring → abas do inspectors
(Interface / Service Config / Deploy) → Domain Designer → Code Workspace.

## Layout do shell (canvas-first)

- **Main nav** é um rail de ícones à esquerda em `aside.main-nav` (sem barra de
  topo). O hambúrguer só expande/recolhe **rótulos** — as oito apps continuam
  clicáveis.
- **Stage** preenche a largura restante em `100dvh`.
- Architecture / Domain Designer mantêm **piso de canvas** (`--jx-canvas-min`) e
  rail direito elástico (`--jx-rail-width`). O rail começa **contraído** (toggle
  Panels estilo hambúrguer); Hide/Show expande ou contrai. Abaixo de ~1100px um
  rail aberto fecha (ou vira overlay) para o canvas continuar visível. Show
  manual reabre.

## Boot

`script.js` instancia `ServiceManagementApp`, registra as oito classes de aba,
chama `smApp.mount()` e mantém uma fachada fina `tabs` (`setActiveTab` /
`renderTabs` / `applyHashTab`) para os call sites restantes.

## Testes

- `test/unit/component.dom.test.ts` — ciclo de vida Component / TabApplication
- `test/unit/serviceManagementApp.dom.test.ts` — TabHost + mount do ArchitectureTab
- `test/unit/architectureCanvas.dom.test.ts` — comportamento do controller do canvas
