<!--
Arquivo gerado automaticamente a partir de: documentation/md/JUMENTIX-MONOREPO-EXECUTION-PLAN.md
Idioma alvo: Português (Brasil)
-->
# Plano de Execução Jumentix Monorepo

## Objetivo

Converta o repositório atual em um produto pnpm monorepo chamado `Jumentix`, minimizando caminhos de implementação incertos e preservando a previsibilidade de entrega.

## Princípios Orientadores

1. Paridade funcional antes do avanço de cada onda migratória.
2. Ondas pequenas e revisáveis ​​com pontos de reversão explícitos.
3. Portões de qualidade rígida (`lint`, `test`, `build`, `coverage`, verificações de segurança) em cada onda.
4. Atualizações da documentação e do registro de requisitos na mesma onda das alterações no código.
5. Adaptadores reutilizáveis ​​genéricos devem ser empacotados como bibliotecas npm distribuíveis.

## Linha de base do escopo

Componentes monorepo de destino:

- `apps/backend-template`
- `aplicativos/gerenciamento de serviços`
- `pacotes/cli-init`
- `pacotes/mediador de mensagens`
- `pacotes/sdk-rest-client`
- `pacotes/sdk-websocket-client`
- `pacotes/sdk-grpc-client`
- pacotes de configuração/ferramentas compartilhados (ts/eslint/jest/contracts) conforme necessário

Planejando proteções e referência de inventário de migração:

- `documentação/md/JUMENTIX-MIGRATION-INVENTORY-AND-ROLLBACK.md`

## Instantâneo da implementação atual

Implementado no repositório:

- `pnpm-workspace.yaml` adicionado.
- root `package.json` inclui scripts recursivos `packageManager` e `mono:*`.
- root `.npmrc` inclui vinculação de espaço de trabalho e configurações de lockfile compartilhado para consistência monorepo.
- estrutura inicial do espaço de trabalho criada:
  - `apps/backend-template`
  - `aplicativos/gerenciamento de serviços`
  - `pacotes/cli-init`
  - `pacotes/mediador de mensagens`
  - `pacotes/sdk-rest-client`
  - `pacotes/sdk-websocket-client`
  - `pacotes/sdk-grpc-client`
- Inicialização da onda 3 em andamento:
  - `packages/sdk-rest-client`, `packages/sdk-websocket-client` e `packages/sdk-grpc-client` agora têm arquivos de origem em nível de pacote e scripts de construção/verificação de tipo TypeScript.
  - Os pacotes SDK agora incluem READMEs em nível de pacote com exemplos de uso.
- Inicialização da onda 4 em andamento:
  - `packages/cli-init` agora expõe pontos de entrada bin executáveis e possui a implementação de bootstrap usada pelo wrapper CLI raiz.
  - O pacote CLI agora inclui README em nível de pacote com contrato de comando.
- Inicialização da onda 6 em andamento:
  - adicionado detector de espaço de trabalho afetado (`pnpm run ci:affected`) para classificar deltas de arquivos por `root`, `apps/*`, `packages/*` e escopo somente de documentos como uma base primitiva para execução seletiva de CI monorepo.
  - adicionados scripts de simulação de lançamento (`pnpm run release:dry-run`, `release:dry-run:packages`, `release:dry-run:apps`) para verificar a prontidão do artefato do pacote e contratos de script de construção/teste do espaço de trabalho do aplicativo.
  - adicionado executor de CI monorepo (`pnpm run ci:monorepo`) que executa validação leve somente de documentos ou portão estrito + comandos de aplicativo/pacote afetados, dependendo do escopo alterado.
  - Pipelines de CI alinhados ao fluxo monorepo: GitHub Actions agora é instalado com pnpm e executa `ci:monorepo` com reconhecimento de escopo; O CircleCI agora instala o pnpm e executa `ci:monorepo`.
- extração de pacote reutilizável em andamento:
  - `packages/message-mediator` (com exportações de ponte local no código backend)
  - `packages/key-value-storage` (com exportações de ponte local no código backend)
  - `pacotes/contratos de persistência` (`IStore` compartilhado e `IDatabaseClient` genérico)
  - `packages/mutex-service` (com exportações de ponte local no código backend)
  - `packages/external-persistence-core` (classe base + opções de conexão para adaptadores de banco de dados externos)
  - `packages/external-store-proxy` (banco de dados externo proxy `IStore` + fábrica com exportação de ponte local)
  - `packages/external-db-repositories` (conectores de banco de dados externos concretos com exportações de ponte local)
  - `packages/database-client-factory` (compilador de cliente de banco de dados baseado em driver com exportação de ponte local)
  - `packages/runtime-infra` (compilação infra de tempo de execução baseada em ambiente compartilhado para bootstraps do adaptador)
  - `packages/adapter-runtime-bootstrap` (bootstrap de composição de autenticação/tempo de execução compartilhado para adaptadores)
  - migração de bootstrap do adaptador expandida para incluir novas estruturas HTTP e adaptadores HTTP sem servidor
  - Carregador `start-rest-api` expandido para suportar matriz de estrutura via `JUMENTIX_HTTP_FRAMEWORK` e acoplamento de script reduzido

Nota de validação pendente:

- A execução recursiva completa do pnpm está atualmente bloqueada neste ambiente devido à resolução da rede do registro (`ENOTFOUND`) durante a inicialização do `pnpm install`.
- A validação local do npm neste ambiente atualmente mostra instabilidade do gerenciador de pacotes (travamento do manipulador de saída `npm ci` e desvio de permissão de cache), portanto, a verificação recursiva final deve ser executada na máquina CI/limpa com o nó `22.23.1`.

## Marcos de migração

### Marco 1 – Fundação do espaço de trabalho

Entregáveis:

- `pnpm-workspace.yaml`
- scripts de espaço de trabalho root `package.json`
- Nó 22 aplicado na raiz do espaço de trabalho e CI
- configurações básicas compartilhadas (ts/eslint/jest) publicadas internamente no espaço de trabalho

Critérios de saída:

- `pnpm -r lint`, `pnpm -r test` e `pnpm -r build` são aprovados.
- CI executa comandos do espaço de trabalho com êxito.

### Marco 2 - Extração do Mediador de Mensagens

Entregáveis:

- `pacotes/mediador de mensagens` contendo contratos/portas/adaptadores
- aplicativo de back-end importa pacote mediador por meio da dependência do espaço de trabalho

Critérios de saída:

- testes de unidade do pacote mediador aprovados
- testes de back-end são aprovados após reescritas de importação

Situação atual:

- Extraído e interligado (`apps/backend-template/src/modules/port/*` + `apps/backend-template/src/infra/messages/*` agora reexporta contratos/adaptadores de pacotes).
- Migração do auxiliar de compilação em tempo de execução concluída com ponte de compatibilidade.

### Marco 3 – Divisão do SDK

Entregáveis:

- SDKs de protocolo como pacotes independentes
- documentos e exemplos em nível de pacote

Critérios de saída:

- todos os pacotes SDK são criados e testados de forma independente
- comportamento do contrato validado por testes automatizados

### Marco 4 - Produção CLI

Entregáveis:

- CLI movida para `packages/cli-init`
- orquestração de bootstrap para geração de projetos backend/frontend/híbridos

Critérios de saída:

- o teste de fumaça de bootstrap passa de ponta a ponta
- os documentos de instalação e uso estão completos

### Marco 5 - Realocação de aplicativos

Entregáveis:

- back-end movido para `apps/backend-template`
- gerenciamento de serviços movido para `apps/service-management`

Critérios de saída:

- ambos os aplicativos são executados em scripts de espaço de trabalho
- Os perfis PM2 permanecem funcionais

Situação atual:

- `apps/service-management` já foi realocado.
- `apps/backend-template` agora possui scripts de espaço de trabalho operacional (construção/teste/integração/CI/PM2) mapeados para o tempo de execução raiz como ponte de migração.
- Pendente: movimentação física de diretórios/arquivos de tempo de execução de backend para `apps/backend-template`.

Guia de execução:

- `documentação/md/JUMENTIX-WAVE5-APP-REHOMING-CUTOVER.md`

### Marco 6 - CI/CD e reforço de liberação

Entregáveis:

- matriz CI com reconhecimento de espaço de trabalho
- estratégia de lançamento (versões independentes/bloqueadas) implementada
- fluxo de changelog definido para produtos e pacotes

Critérios de saída:

- As verificações de PR ficam verdes no modo monorepo
- liberação de simulação validada

## Ritmo de entrega (sugerido)

- Sprint P0: Marco 1 + pré-trabalho para Marco 2
- Sprint P1: Marcos 2 e 3
- Sprint P2: Marcos 4 e 5
- Sprint P3: Marco 6 + estabilização

## Controles de risco

1. Risco de quebra de importação:
   - Use reescritas de importação assistidas por codemod e verificações de compilação em cada PR.
2. Instabilidade do IC:
   - Habilite a matriz do espaço de trabalho de forma incremental e aplique a aprovação antes da próxima onda.
3. Risco de RP superdimensionado:
   - Limitar o escopo PR a uma onda ou unidade de extração de embalagens.
4. Ambigüidade de nomenclatura/embalagem:
   - Confirme a nomenclatura do pacote npm e o modelo de distribuição antes da publicação da CLI.

## Status de prontidão da fase 0/1

- Divisão de escopo definida para Onda 1 (obrigatório) vs Onda 2+ (melhorias).
- Decisões de nomenclatura bloqueadas (`Jumentix`, `@jumentix/cli-init` como destino de instalação oficial, `jumentix-init` como comando de tempo de execução).
- Procedimento de ramificação/etiquetagem/reversão documentado com pontos de verificação pré/pós-onda.
- Atual -> mapeamento de estoque alvo documentado com notas de bloqueio.

## Definição de Pronto (por onda)

- Escopo de onda documentado.
- Lista de arquivos necessários definida.
- Estratégia de teste e reversão documentada.
- Critérios de aceitação acordados.

## Definição de Concluído (por onda)

- Código mesclado com todas as verificações obrigatórias em verde.
- Documentação atualizada.
- Requisitos de agentes e tarefas do projeto sincronizadas.
- Nenhum bloqueador não resolvido para a próxima onda.
