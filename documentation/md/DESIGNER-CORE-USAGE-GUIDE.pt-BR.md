# @jumentix/designer-core — guia de uso

## Responsabilidade no escopo

- **Camada:** toolkit de modelo de domínio (sem DOM)
- **Responsável por:** normalize/validate/export/import de designs
- **Usado com:** guia SPA/PWA e `@jumentix/cana`
- **Não responsável por:** UI, IndexedDB em si, ou APIs HTTP

## O que é

`@jumentix/designer-core` é o núcleo do designer de domínio do Service
Management, seguro para o browser. Valida modelos de domínio, normaliza payloads
de importação e monta documentos de exportação — tudo sem DOM, `window` ou
dependências exclusivas de Node. Use em SPAs, Storybook, playgrounds de docs e
testes unitários.

## Por que existe

Times júnior precisam de um lugar compartilhado para responder: “Este design é
válido?”, “Posso exportar?” e “A reimportação round-trip funciona?”. Sem
`designer-core`, cada app duplicaria regras de validação e divergiria da UI do
designer. O pacote mantém as mesmas regras que o app Service Management usa,
para que PWAs offline e testes server-side vejam comportamento idêntico.

## Pré-requisitos

- **Runtime:** browser moderno ou Bun/Node 18+ (sem DOM).
- **Gerenciador de pacotes:** Bun (recomendado) ou npm/pnpm com workspace linkado.
- **Leitura prévia:** [Começando](/docs/pt-BR/jumentix/concepts/getting-started)
  — você deve saber o que é um modelo de domínio (domains, entities,
  relationships).
- **Opcional:** editor JSON ou o playground de docs abaixo.

## Glossário

| Termo | Significado |
| --- | --- |
| **Modelo de domínio** | O slice `{ domains, relationships }` com bounded contexts, entidades, campos e links entre entidades. |
| **State** | O estado completo do designer após `normalizeStatePayload` — slice do modelo mais view, deployments, interfaces e configuração. |
| **Normalizar** | `normalizeStatePayload` preenche padrões, limita valores e descarta relationships inválidos para que todos vejam a mesma forma. |
| **Issue de modelo** | Um achado de `collectModelIssues` — `{ message, entityId, severity }` com severity `error`, `warn` ou `info`. |
| **Modelo sample** | `buildSampleModelPayload()` — domínio inicial realista (Users/Organization) com prefixo de id `sample-`. |
| **Export suite** | Documento JSON completo (`kind: service-management-suite`) de `buildJsonExportDocument`. |

## Passos

### 1. Instalar (< 5 minutos)

```bash
bun add @jumentix/designer-core
```

### 2. Primeiro sucesso — validar o modelo sample (< 15 minutos)

Carregue o sample embutido, normalize e colete issues. Zero erros significa que
o gate de exportação passaria.

```js
import {
  buildSampleModelPayload,
  normalizeStatePayload,
  collectModelIssues
} from '@jumentix/designer-core';

const raw = buildSampleModelPayload();
const state = normalizeStatePayload(raw);
const issues = collectModelIssues(state);
const errors = issues.filter((issue) => issue.severity === 'error');

console.log({ ok: errors.length === 0, totalIssues: issues.length });
```

**Verifique o sucesso:** `errors.length === 0` e `state.domains.length >= 1`.

### 3. Fluxo central — validar antes de salvar

Sempre valide o state normalizado antes de persistir no Cana ou enviar ao backend:

```js
function validateForSave(rawPayload) {
  const state = normalizeStatePayload(rawPayload);
  const issues = collectModelIssues(state);
  const blocking = issues.filter((i) => i.severity === 'error');
  return { state, ok: blocking.length === 0, issues };
}
```

Mantenha payloads serializáveis em JSON (somente objetos e arrays planos). Aumente
o `version` do documento quando adicionar campos de export que o store não possa
ignorar.

### 4. Fluxo central — exportação e round-trip de reimportação

Prove que o design sobrevive export → parse → normalizar:

```js
import {
  buildJsonExportDocument,
  buildStateFromSuiteExport
} from '@jumentix/designer-core';

const document = buildJsonExportDocument(state);
const parsed = JSON.parse(JSON.stringify(document));
const imported = buildStateFromSuiteExport(parsed, state);

if (!imported.ok) {
  throw new Error(imported.reason);
}

const roundTrip = normalizeStatePayload(imported.state);
const roundTripIssues = collectModelIssues(roundTrip);
```

**Verifique o sucesso:** `imported.ok === true` e issues com severity `error`
permanecem zero.

### 5. Superfície completa — mapa da API pública

| Área | Exports principais | Use quando |
| --- | --- | --- |
| Modelo | `buildSampleModelPayload`, `isSampleDomain`, model queries | Bootstrap ou marcar conteúdo sample |
| State | `normalizeStatePayload`, `createDesignerState` | Pipelines de load/save (store injetado pelo app) |
| Validação | `collectModelIssues`, `collectDeployTargetIssues`, … | Gates pré-save e de exportação |
| Exportadores | `buildJsonExportDocument`, `buildOasDocument`, `buildMarkdownExport`, … | Download / codegen |
| Importadores | `buildStateFromSuiteExport`, `buildDomainFromPackage`, `buildDomainsFromOas` | Upload de arquivos |
| Codegen | `buildHexagonalBundle`, `buildAsyncApiFileSet` | Geração de boilerplate |

Importe só o necessário — amigável a tree-shaking em bundlers que suportam.

## Experimente no playground de docs

<DocsPlayground runtime="designer-core" id="getting-started" />

O playground expõe `api` com as funções reais mais um alias de conveniência:

```js
const raw = api.buildSampleModelPayload();
const state = api.normalizeStatePayload(raw);
const result = api.validate(state);
// result: { ok, issues, errorCount }
```

Não passe um formato toy `{ version, name, entities }` — a validação espera
`domains` e `relationships` após a normalização.

## Erros comuns

| Sintoma | Causa | Correção | Verificar sucesso |
| --- | --- | --- | --- |
| `domains.forEach is not a function` | Payload bruto sem `normalizeStatePayload` | Chame `normalizeStatePayload` primeiro | `Array.isArray(state.domains)` |
| Vários “Duplicate entity name” | Entidades copiadas no mesmo domínio | Renomeie entidades ou remova duplicatas | Reexecute `collectModelIssues`; erros sumiram |
| Gate de export bloqueia em RBAC | Papel fora do vocabulário do contrato | Use papéis do contrato RBAC do tenant | Sem issues RBAC com severity `error` |
| `buildStateFromSuiteExport` retorna `{ ok: false }` | `kind`/`version` errados ou shape legado | Leia `reason`; use suite export v2 | `imported.ok === true` |
| Estrutura circular em JSON.stringify | Instâncias de classe ou nós DOM no state | Mantenha só dados planos | Serialização funciona |

## Checklist júnior (“Eu consigo …”)

- [ ] Instalar `@jumentix/designer-core` e importar `buildSampleModelPayload` em script ou SPA.
- [ ] Normalizar um payload com `normalizeStatePayload` e explicar o que ele corrige.
- [ ] Executar `collectModelIssues` e listar só blockers com severity `error`.
- [ ] Carregar o modelo sample e confirmar zero issues com severity `error`.
- [ ] Exportar com `buildJsonExportDocument` e reimportar via `buildStateFromSuiteExport`.
- [ ] Descrever quando validar (antes de save/export) vs quando exportar (após validação passar).

## Próximo passo

Persista designs validados offline com
[Cana](/docs/pt-BR/jumentix/packages/cana/usage) e siga o
[guia SPA/PWA](/docs/pt-BR/jumentix/guides/spa-pwa) para ligar o designer-core
a um frontend zero-build.