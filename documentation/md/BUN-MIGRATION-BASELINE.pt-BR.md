# Baseline de Compatibilidade e Migração para Bun

Entregável da task [JUM-23] do Linear (projeto: `[Tooling] Replace Internal Node and pnpm Workflows with Bun`). Evidências coletadas em 2026-07-26, Bun `1.3.14` (Homebrew, macOS), worktree dedicado a partir de `origin/dev` (`63ecaef`).

## 1. Inventário (superfície atual Node/pnpm)

| Dimensão | Contagem |
| --- | --- |
| Arquivos `package.json` (raiz + workspaces) | 22 |
| Total de scripts npm | 333 |
| Scripts invocando `pnpm` / `npm` | 115 / 115 |
| Scripts invocando `node` | 81 (67 na raiz) |
| Scripts invocando `tsc` | 46 |
| Scripts invocando `pm2` | 40 |
| Scripts invocando `jest` | 26 |
| Scripts invocando `ts-node` | 15 |
| Scripts de governança `ci-cd/*.js` | 28 (Node puro, sem dependências) |
| Arquivos de teste | 199 |

Censo de APIs jest em 199 arquivos: `jest.fn` 592, `jest.spyOn` 54, `jest.mock` 40, `clearAllMocks` 6, `resetModules` 5, `requireActual` 2, `setTimeout` 4, fake timers 1.

## 2. Trial de `bun install`

- 4069 pacotes instalados em **37,5s**.
- 1 falha: `uWebSockets.js` (dependência via tarball do GitHub, erro `clonefileat`) — requer `trustedDependencies`/override na JUM-26.
- A suíte unit completa do jest roda **verde (518/518)** sobre `node_modules` instalado pelo Bun — forte evidência de que o linker do Bun satisfaz a resolução do repositório.

## 3. Trial de `bun test` (zero adaptação)

| Runner | Testes | Resultado | Tempo |
| --- | --- | --- | --- |
| Jest (`pnpm run test:unit`, com coverage) | 518/518, 94 suítes | verde | **157,6s** |
| `bun test test/unit` (sem mudanças) | 369 descobertos, 306 passam, 63 falham, 31 erros de carga | parcial | **1,78s (~88x)** |

O gap de descoberta (518 vs 369) é causado por erros de carga que abortam arquivos inteiros.

## 4. Taxonomia de falhas (finita e endereçável)

1. **Imports de tipo sem `import type`** (~30 erros diretos; 340 linhas candidatas no repo, convenção de interfaces `I*`). O runtime ESM do Bun não resolve tipos TS apagados importados como valores. Correção: codemod mecânico para `import type` (seguro também no jest). Maior bloqueador individual.
2. **`jest.resetModules` (13) e `jest.doMock` (2)** — sem equivalente no `bun:test`. Correção: refactor para padrões de factory/reset explícito ou `mock.module`; candidatos à fronteira de validação Node-compat (JUM-37) se o refactor for desproporcional.
3. **Leituras de arquivo dependentes de cwd (5 ENOENT)** — suposição do `rootDir` do jest; corrigir com resolução relativa a `import.meta.dir`.
4. **Residual (4)**: ordenação de mock (`shouldStartFallbackRestApi`), atribuição readonly, um acesso undefined — investigação individual.

Suportado nativamente pelo `bun:test` (sem ação): `jest.fn`, `jest.spyOn`, hooks de ciclo de vida, matchers de `expect` usados no código, aliases de path do tsconfig (`@src`, `@test`, `@jumentix/*`).

## 5. Ordem de migração recomendada (alimenta JUM-24..31)

1. JUM-24: pin da toolchain (`.bun-version`, `bunfig.toml`, check de bootstrap espelhando `check-node-version`).
2. Codemod `import type` (repo inteiro, neutro de runner, risco zero) — antes de qualquer troca de runner.
3. JUM-26: trust/override do `uWebSockets.js`; verificar migração `pnpm.overrides` → `overrides`.
4. JUM-29: migração unit em ordem de camada (domain → application → adapters), com gate de paridade por camada (mesma contagem descoberta, delta de coverage < 0,1%, 0 flakes / 20 execuções — ver Test Pyramid JUM-432/434..436).
5. Refactors de `jest.resetModules/doMock` como sub-mudanças escopadas dentro da JUM-29.
6. Coverage/reporters sob Bun (JUM-31): `bun test --coverage --coverage-reporter=lcov`; validar thresholds 99/99/99/90 e upload único ao Codecov (Req 014).

## 6. Riscos e restrições

- `bun test` não lê `jest.config.js` (bootstrap de env do `ci-cd/loadEnvironment.js` deve migrar para `--preload` ou `[test].preload` no `bunfig.toml`).
- Typechecking TypeScript continua obrigatório (`tsc` permanece; Bun transpila sem typechecking).
- Dependências via tarball do GitHub exigem configuração explícita de confiança.
- **`bun install` altera o `package.json`**: removeu `pnpm.patchedDependencies` e fundiu overrides com escopo pnpm (ex.: `restify>find-my-way`) no campo `overrides` do npm — formato que o npm rejeita (`EINVALIDTAGNAME`), quebrando qualquer tooling via npm/npx (incluindo o gate do husky). JUM-25/26 devem tratar a migração de overrides/patches explicitamente e `bun install` não deve rodar na árvore gerenciada por pnpm até o cutover.
- **`bun install` altera o `package.json`**: removeu `pnpm.patchedDependencies` e fundiu overrides com escopo pnpm (ex.: `restify>find-my-way`) no campo `overrides` do npm, formato que o npm rejeita (`EINVALIDTAGNAME`), quebrando tooling npm/npx incluindo os gates do husky. Também falhou ao linkar `uWebSockets.js`, o que quebra o alvo de integração hyper-express. `bun install` não deve rodar na árvore gerenciada por pnpm até que JUM-25/26 tratem explicitamente lockfile, overrides e patches.
- As requirements 001/012/048 mandatam Node/pnpm e precisam ser formalmente superadas (JUM-22) antes de qualquer cutover.

## 7. Evidências

- Logs brutos: `bun install`, `bun test` (`/tmp/bun-unit.log`), baseline jest (`/tmp/jest-unit.log`) — sumarizados acima; tempos medidos na mesma máquina, na mesma árvore.
- Este documento não alega nenhum gate verde além da execução jest reproduzida; é evidência de pesquisa para o M1.
