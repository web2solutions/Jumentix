<!--
Arquivo gerado automaticamente a partir de: documentation/md/JUMENTIX-WAVE5-APP-REHOMING-CUTOVER.md
Idioma alvo: Português (Brasil)
-->
# JumentiX Wave 5 App Re-homing Cutover

Este documento é o guia de transição executável para mover aplicativos de tempo de execução para limites de aplicativos de espaço de trabalho.

## Escopo

- Mova o tempo de execução de back-end da raiz do repositório para `apps/backend-template`.
- Mova o aplicativo Service Management de `/service-management` para `apps/service-management`.
- Preservar o comportamento atual, perfis PM2, portas CI e política de cobertura.

## Pré-condições

1. Os códigos das ondas 3 e 4 são mesclados (propriedade do SDK/CLI estabilizada).
2. Pacotes compartilhados `@jumentix/*` são compilados e importados por pontes de compatibilidade.
3. O tempo de execução do nó é `22.23.1` no CI e no ambiente de validação local.

## Sequência de transição

Companheiro de reescrita de caminho:

- `documentação/md/JUMENTIX-WAVE5-PATH-DELTA-MAP.md`

### Etapa 1 - Movimentação do arquivo do aplicativo de back-end

Mova esses diretórios raiz para `apps/backend-template`:

- `apps/backend-template/src/`
- `especificação/`
- `apps/backend-template/test/`
-`pm2/`
- `semente/`
- `sem servidor.ts`
- `docker-compose*.yml`

Status:

- Concluído em 2 de julho de 2026.
- Movimentação física concluída para diretórios de tempo de execução:
  - `apps/backend-template/src/` -> `apps/backend-template/src/`
  - `apps/backend-template/test/` -> `apps/backend-template/test/`
  - `docker/` + `docker-compose*.yml` -> `apps/backend-template/*`
  - `OASdoc/` + `AsyncAPIdoc/` -> `apps/backend-template/*`
- A propriedade do ecossistema PM2 agora reside na raiz `pm2/*`.
- Evidência de encerramento da onda:
  - PR #112: `https://github.com/XpertMinds/Jumentix/pull/112`
  - Problema de normalização: `https://github.com/XpertMinds/Jumentix/issues/113`
  - Problema de estabilização de CI: `https://github.com/XpertMinds/Jumentix/issues/114`
  - Problema de caminho sem servidor: `https://github.com/XpertMinds/Jumentix/issues/115`
- Tarefas residuais transferidas para acompanhamento dedicado:
  - Fechamento de governança e mapeamento de evidências (`#116`)
  - Subtarefas de proteção de CI/versão Wave 6 (`#94`, `#98`, `#99`)

Mantenha os ativos raiz compartilhados na raiz:

- `.agentes/`
- `documentação/`
- `pacotes/`
- `ferramentas/`
- arquivos de configuração no nível do workspace (`package.json#workspaces`, `bun.lock`, `bunfig.toml`).

### Etapa 2 - Mudança no gerenciamento de serviços

Mover:

- `/service-management/*` (legado) -> `apps/service-management/*`

Atualize todas as referências de tempo de execução:

- scripts de pacote
- Caminhos de aplicativos PM2
- links de documentos

### Etapa 3 - Caminho de importação e reescrita de configuração

1. Reescreva aliases absolutos e caminhos tsconfig onde os caminhos ainda assumem tempo de execução raiz.
2. Certifique-se de que os caminhos de teste rootDir/moduleNameMapper sejam resolvidos no espaço de trabalho do aplicativo.
3. Mantenha os wrappers de compatibilidade com versões anteriores quando necessário para uma onda.

### Etapa 4 - PM2 e validação em tempo de execução

Valide todos os perfis após a migração do caminho:

-desenvolvedor
- encenação
- produção

Verificações de processo necessárias:

-RESTAPI
- websocketAPI + RESTAPI
- grpcAPI + RESTAPI
- processo de aplicativo de gerenciamento de serviço

### Etapa 5 - Validação da porta CI

Verificações verdes mínimas exigidas:

- fiapos
- testes unitários
- fumaça de integração selecionada
- Resolução de rota da OEA
- construir
- porta limite de cobertura
- fumaça de segurança

### Etapa 6 - Decisão de limpeza da ponte

Após transição bem-sucedida:

1. manter os wrappers de compatibilidade para uma onda de estabilização ou
2. remova os wrappers no PR de limpeza dedicado.

## Plano de reversão

Se alguma etapa falhar:

1. Reverta apenas o escopo PR da onda com falha.
2. Restaure os caminhos originais do PM2.
3. Execute novamente `ci:gate` e verificações de cobertura.
4. Retomar com lotes de movimentação mais restritos (back-end e depois gerenciamento de serviço separadamente).

## Critérios de aceitação

1. `apps/backend-template` executa o tempo de execução da API com comportamento externo inalterado.
2. `apps/service-management` executa comportamento de UI/servidor inalterado.
3. Perfis PM2 são executados com sucesso com novos caminhos de aplicativos.
4. As portas CI e os limites de cobertura permanecem verdes.
5. README/docs/agents refletem as localizações finais dos aplicativos.

Status: satisfeito para a linha de base da Onda 5; itens residuais rastreados em questões de acompanhamento.
