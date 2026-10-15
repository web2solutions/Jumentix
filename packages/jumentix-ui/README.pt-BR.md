# `@jumentix/jumentix-ui`

Primitivos de UI de primeira parte com contratos grau Ext (ferramentas de painel, Toolbar, Field, Button, Segmented, Tabs, List, Details, Form, Scope chrome), com **pele escura Jumentix** como primária. Sem runtime Sencha.

## Propósito

Materializar o padrão de interação do Domain Designer (rail e toolbar do canvas) para outras superfícies Jumentix reutilizarem a mesma geometria e hierarquia.

## Consumo

```css
@import '@jumentix/jumentix-ui/css';
```

Prefixo de classe: `jtx-ui-*`. Tokens: `--jtx-ui-*`.

O Domain Designer mantém aliases locais `jx-*` sob `#tab-domain-designer`.

## KitchenSink

Abra [`gallery/index.html`](gallery/index.html) no navegador.

## Naturezas × hierarquia

| Natureza | Job de UI | Hierarquia |
| --- | --- | --- |
| Structure | Modelar browse/edit | Domain ⊃ Entity ⊃ Field |
| Temporal | Undo/redo | Stack do modelo |
| Assure | Validar / diff | Lê o grafo |
| Emit | Exportar | Serializa o grafo |
| Ingest | Importar / reset | Substitui o grafo |
| Navigate | Chrome do canvas | Path somente leitura |

## Evidência

- `apps/service-management/docs/EXTJS-COMPONENT-REVERSE-ENGINEERING.md`
- `apps/service-management/docs/JUMENTIX-UI-FRAMEWORK-SEED.md`
