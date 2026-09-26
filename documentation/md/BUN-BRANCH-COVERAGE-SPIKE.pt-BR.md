# JUM-541 — Spike de cobertura de branches no Bun vs limite de 90% de branches

Data: 2026-07-30  
Versão fixada do Bun: `1.3.13` (`.bun-version`)

## Pergunta

O `bun test --coverage` emite registros BRDA/BRF/BRH confiáveis o suficiente para o limite de 90% de branches da era Jest (Reqs 014/020/063)?

## Método

1. Executado `bun test --coverage --coverage-reporter=lcov` em um subconjunto de testes unitários compatível com Bun em `apps/backend-template/test/unit/modules/Users/domain`.
2. Inspecionado `coverage/lcov.info` em busca de registros `BRDA:` / `BRF:` / `BRH:`.
3. Comparado o formato (não o % absoluto) com uma amostra LCOV do Jest dos mesmos arquivos, quando disponível.

## Veredito

| Verificação | Resultado |
| --- | --- |
| Arquivo LCOV gerado | Sim |
| Registros de linha (`DA:`) | Presentes |
| Registros de branch (`BRDA`/`BRF`/`BRH`) | **Presentes no Bun 1.3.13 para este subconjunto** |
| Limite falha fechado quando faltam branches | Aplicar via LCOV mesclado + limites existentes de Jest/Codecov até que flags nativas de limite do Bun sejam adotadas no repositório |

**Decisão para o JUM-437:** manter a barra de 90% de branches. Mesclar LCOV de Bun + Node com a regra "primeiro arquivo visto vence" (`ci-cd/merge-coverage-reports.js`) para que Codecov/Sonar não contem em dobro. Se uma versão futura do Bun deixar de emitir BRDA, reabrir este spike antes de baixar a barra.

## Plano B (se o BRDA sumir)

1. Manter a cobertura do Jest como autoridade da métrica de branches com `ciRunner: "node"` nas suítes afetadas.
2. **Não** remover silenciosamente a dimensão de branches dos limites.
3. Registrar um follow-up contra a versão fixada do toolchain no épico do Bun.

## Comandos de evidência

```bash
bun test --coverage --coverage-reporter=lcov apps/backend-template/test/unit/modules/Users/domain
rg -n '^BR(DA|F|H):' coverage/lcov.info | head
bun run coverage:merge
```
