<!--
Arquivo gerado automaticamente a partir de: documentation/md/JUMENTIX-BUNDLER-RUNTIME-TEMPLATES.md
Idioma alvo: Português (Brasil)
-->
# Jumentix Bundler e modelos de tempo de execução

## Objetivo

Defina modelos de linha de base por tipo de artefato para que a CLI de inicialização e os pacotes de espaço de trabalho produzam um comportamento previsível de construção/tempo de execução.

## Matriz de modelos

| Tipo de artefato | Construir linha de base de ferramentas | Linha de base do tempo de execução | Contrato de Saída |
|---|---|---|---|
| Serviço de back-end (nó) | Compilador TypeScript (`tsc`) com caminhos de espaço de trabalho | Nó 22 + perfil PM2 + carregador de adaptador baseado em env | Saída de construção JS + mapas de origem + contrato env |
| SPA de front-end | Perfil de empacotador moderno (equivalente a Vite) + TS | Tempo de execução do navegador com hospedagem estática | Pacote de ativos estáticos + manifesto PWA opcional |
| SSR de front-end | Perfil de empacotador compatível com SSR + TS | Tempo de execução do nó (entrada do servidor) + ativos estáticos | pacote de servidor + pacote de cliente + contrato de env |
| Biblioteca npm de back-end | `tsc` + saída de declaração | Tempo de execução do nó gerenciado pelo consumidor | lista de permissões do pacote `main` + `types` + `files` |
| Biblioteca npm de front-end | modo de biblioteca bundler + declarações TS | Tempo de execução do consumidor de navegador/SSR | Pacote ESM/CJS + tipos + contrato de estilo/ativos |

## Regras do modelo de tempo de execução

- O tempo de execução do nó foi corrigido para a versão principal `22`.
- A inicialização de back-end é selecionada por contratos de ambiente:
  - `JUMENTIX_HTTP_FRAMEWORK`
  - `JUMENTIX_REALTIME_API`
  - `JUMENTIX_REALTIME_API_PROTOCOL`
  - `JUMENTIX_DATABASE_DRIVER`
  - `JUMENTIX_KEYVALUESTORAGE_DRIVER`
- O substituto REST permanece ativo para perfis de serviço em tempo real.

## Regras de construção/liberação

- Todos os pacotes de espaço de trabalho devem expor scripts `build`, `test` e `typecheck`.
- Pacotes publicáveis ​​devem ter versões semver válidas e metadados de `arquivos` não vazios.
- A automação de liberação raiz deve manter:
  - `changelog: atualização`
  - `changelog:verificar`
  - `liberação: simulação`
  - `release:dry-run:packages`
  - `lançamento: simulação: aplicativos`
- CI gate inclui validação de governança de lançamento por meio de `bun run release:governance:check`.

## Mapeamento de andaime CLI

Os tipos de serviço Bootstrap devem ser mapeados para modelos:

| Tipo de serviço CLI | Modelo |
|---|---|
| `restapi` | Serviço de back-end (nó) |
| `websocket+restaupi` | Serviço de back-end (nó) + perfil em tempo real |
| `grpc+restau` | Serviço de back-end (nó) + perfil em tempo real |
| `funções` | Modelo de pacote de funções do provedor |
| `frontend-spa` | SPA de front-end |
| `frontend-ssr` | SSR de front-end |
| `lib-back-end` | Biblioteca npm de back-end |
| `lib-frontend` | Biblioteca npm de front-end |

## Critérios de aceitação

- As definições de modelo são documentadas e vinculadas ao índice README.
- As verificações de CI e de liberação impõem metadados e contratos de script necessários.
- A lógica do scaffold pode mapear cada tipo de serviço para um modelo explícito.
