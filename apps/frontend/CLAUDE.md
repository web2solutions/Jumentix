# CLAUDE.md - @jumentix/frontend

Claude Code segue **`AGENTS.md` deste diretório** (fonte única das regras do frontend) e as
regras do monorepo em `../../CLAUDE.md` — `rtk proxy bun run <script>`, Caveman, Linear como
SSOT, registry/agent-bus e todos os `.agents/requirements/*`.

Resumo do que não pode ser esquecido aqui:

1. Fronteira de contrato (Requirement 136): nenhum import de `apps/backend-template/**`; o
   backend é conhecido só pela OAS empacotada (`src/contracts/openapi.json`, gerada de
   `spec/1.0.0.yml`).
2. Nada hardcoded do domínio: campos, labels (`x-label`), filtros/ordenação
   (`x-list-capabilities`), referências (`x-references`), RBAC (`info.x-rbac` + `security`).
3. Textos de UI via `t()` em `src/i18n`; sem strings soltas em PT ou EN.
4. Gates antes de entregar: `bun run test` (unit + component), `typecheck`, `lint`, `build`,
   `test:e2e` (Docker) e, na raiz, `bun run frontend:coverage:check`.
