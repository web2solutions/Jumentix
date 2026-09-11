<!--
Arquivo gerado automaticamente a partir de: documentation/md/JUMENTIX-WAVE5-PATH-DELTA-MAP.md
Idioma alvo: Português (Brasil)
-->
# Mapa Delta do Caminho Jumentix Wave 5

Este mapa rastreia reescritas de caminho de tempo de execução para o modelo de back-end e onda de realocação de gerenciamento de serviço.

## Tabela de mapeamento pós-transição

| Caminho legado | Caminho atual |
| --- | --- |
| `src/` | `apps/backend-template/src/` |
| `teste/` | `apps/backend-template/test/` |
| `semente/` | `apps/backend-template/seed/` |
| `OASdoc/` | `apps/backend-template/OASdoc/` |
| `AsyncAPIdoc/` | `apps/backend-template/AsyncAPIdoc/` |
| `docker/` | `apps/backend-template/docker/` |
| `docker-compose-*.yml` | `apps/backend-template/docker-compose-*.yml` |
| `gerenciamento de serviços/` | `aplicativos/gerenciamento de serviços/` |
| `apps/backend-template/pm2/` | `pm2/` (propriedade raiz) |

## Âncoras de caminho legado (pré-transição)

### Âncoras de tempo de execução de back-end

- `./src/interface/HTTP/adapters/start-rest-api.ts`
- `./src/interface/WebSocket/adapters/start-websocket-api.ts`
- `./src/interface/gRPC/adapters/start-grpc-api.ts`
- equivalentes compilados em produção em `./.build/interface/...`
- dados iniciais em `./seed/*`

### Âncora de gerenciamento de serviços

- `./service-management/server.js`

## Âncoras atuais (pós-transição)

### Aplicativo de modelo de back-end

- `./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts`
- `./apps/backend-template/src/interface/WebSocket/adapters/start-websocket-api.ts`
- `./apps/backend-template/src/interface/gRPC/adapters/start-grpc-api.ts`
- equivalentes compilados de produção em `./.build/apps/backend-template/src/interface/...`
- dados iniciais em `./apps/backend-template/seed/*`

### Aplicativo de gerenciamento de serviços

- `./apps/service-management/server.js`

## Arquivos de propriedade reescritos

1. `pm2/ecosystem.dev.config.cjs`
2. `pm2/ecosystem.staging.config.cjs`
3. `pm2/ecosystem.production.config.cjs`
4. Scripts raiz `package.json` contendo:
   - iniciadores de tempo de execução
   - comandos de construção/teste apontando para `apps/backend-template/*`
   - referências de composição do docker em `apps/backend-template/`
5. documentos e referências de integração:
   - `README.md`
   - `documentação/md/SETUP-RUNTIME-AND-API.md`
   - `documentation/md/SERVICE-MANAGEMENT-APPLICATION.md`

## Lista de verificação de validação

- `bun run oas:check-routes` verde com resolução `apps/backend-template/src`.
- `bun run test:unit` verde usando `apps/backend-template/test/unit`.
- Os scripts de inicialização PM2 dev/staging/prod fazem referência aos ecossistemas `pm2/*`.
- O aplicativo Service Management ainda inicia em `apps/service-management/server.js`.
