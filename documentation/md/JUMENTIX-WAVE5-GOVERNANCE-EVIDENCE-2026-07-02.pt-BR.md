<!--
Arquivo gerado automaticamente a partir de: documentation/md/JUMENTIX-WAVE5-GOVERNANCE-EVIDENCE-2026-07-02.md
Idioma alvo: Português (Brasil)
-->
# Evidência de governança Jumentix Wave 5 (02/07/2026)

Este instantâneo registra evidências de governança para tarefas de encerramento monorepo Wave 5 monitoradas no projeto GitHub **Jumentix**.

## Problemas rastreados

- #113 — Normalize os caminhos legados restantes após a realocação do aplicativo
- #114 — Estabilize a porta CI e teste os pontos de entrada após a migração
- #115 — Corrigir mapeamento de caminho do manipulador Serverless/Lambda para `restapi`
- #116 — Fechar status de governança da Onda 5 e mapeamento de evidências

## Evidência de Execução

### CI e estabilização de portão de teste (#114)

Validado localmente:

```bash
pnpm run ci:gate
```

Resultado: **aprovado** (lint + verificações de arquitetura + unidade + resolução de rota OAS + construção + fumaça).

### Validação de mapeamento de manipulador sem servidor (#115)

Adicionado comando de validação explícito:

```bash
pnpm run serverless:check-handlers
```

Resultado: **pass** (`34` manipuladores resolvidos para arquivos existentes).

`ci:gate` agora executa `serverless:check-handlers` antes da compilação.

### Atualizações de normalização de caminho (#113)

Principais documentos/exemplos de tempo de execução atualizados para caminhos de propriedade do aplicativo pós-migração:

- `README.md`
- `documentação/md/CI-TROUBLESHOOTING.md`
- `documentação/md/SETUP-RUNTIME-AND-API.md`
- `documentação/md/DATABASE-DRIVERS-SMOKE-TESTS.md`
- `documentação/md/RUNTIME-ENVIRONMENT-CONTRACTS.md`
- `documentação/md/EVENTS-AND-MESSAGES-MAP.md`
- `documentation/md/HEXAGONAL-FEATURE-DRIVEN-MIGRATION.md`

## Instantâneo do status do projeto GitHub

- #114: **Concluído**
- #115: **Concluído**
- #113: **Em andamento**
- #116: **Em andamento**

## Restrições/Acompanhamento

- `.agents/*` é somente leitura no ambiente de execução atual, portanto, o alinhamento do arquivo do agente para esta onda deve ser concluído em uma passagem de acompanhamento gravável.
