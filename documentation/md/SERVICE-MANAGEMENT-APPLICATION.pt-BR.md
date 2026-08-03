<!--
Arquivo gerado automaticamente a partir de: documentation/md/SERVICE-MANAGEMENT-APPLICATION.md
Idioma alvo: Português (Brasil)
-->
# Aplicativo de gerenciamento de serviços

O aplicativo estático `domaindesigner` anterior foi consolidado em:

- `aplicativos/gerenciamento de serviço/`

Agora é um conjunto com guias para design do ciclo de vida do serviço.

Arquivos principais de implementação:

- `apps/service-management/index.html`
- `apps/service-management/script.js`
- `apps/service-management/styles.css`
- `apps/service-management/server.js`

## Guias

1. **Designer de Domínio**
   - MVP completo de modelagem ER incluindo:
     - ciclo de vida e inspetor de domínio/entidade
     - âncoras de relacionamento, controles de dobra/caminho, estilo de roteamento
     - metadados de contexto limitado
     - agregado + invariantes
     - RBAC por entidade/ação
     - contratos de mensagens (`evento/comando/solicitação/resposta`)
     - Composição OpenAPI (`oneOf/allOf/anyOf`, referências externas, discriminador)
     - diferença de esquema + dicas de migração
     - exemplos de solicitação/resposta
     - visualização do esqueleto do código
     - fluxos de exportação/importação (JSON, OAS, Markdown, JSON Schema, AsyncAPI, pacote, pacote padrão)
     - modo minimapa e tela grande
2. **Designer de interface de comunicação**
   - Registra adaptadores de interface de entrada e mapeamentos de controladores:
     -HTTP/REST
     -gRPC
     -WebSocket
     - SSE
3. **Configuração do serviço**
   - Captura o perfil de tempo de execução e a forma de implantação:
     - tipo de serviço (`API REST`, `API WebSocket + API REST`, `API gRPC + API REST`)
     - modo de execução
     - provedor de nuvem
     - comportamento de ativos estáticos
     - portas de tempo de execução (`REST`, `WebSocket`, `gRPC`)
   - Mostra visualização de perfil orientado a PM2 para orquestração de tempo de execução de VM.
   - Inclui controles de ambiente de tempo de execução para leitura/atualização:
     - `JUMENTIX_HTTP_FRAMEWORK`
     - `JUMENTIX_REALTIME_API`
     - `JUMENTIX_REALTIME_API_PROTOCOL`
     - `JUMENTIX_REALTIME_API_DATABASE_DRIVER`
   - O editor de ambiente de tempo de execução tem como alvo o arquivo de ambiente selecionado:
    - `dev` -> `apps/backend-template/src/config/.env.dev`
    - `staging` -> `apps/backend-template/src/config/.env.staging`
    - `ci` -> `apps/backend-template/src/config/.env.ci`
4. **Gerenciamento de implantação**
   - Rastreia alvos de implantação e metadados de implantação em tempo de execução.

Guia de uso detalhado:

- [Recursos e uso do Designer de Domínio](./DOMAIN-DESIGNER-FEATURES-AND-USAGE.md)

## Correr

Servido por PM2:

- `bun run dev:service-management`
- o perfil dev padrão (`bun run dev`) também inicia o `service-management` através do PM2.

O estado do aplicativo persiste com o navegador `localStorage`.

Caminho de desenvolvimento recomendado:

1. `bun run dev:service-management`
2. Abra o URL de gerenciamento de serviço local
3. Modelo de domínios/entidades
4. Execute exportações (esquema OAS/AsyncAPI/JSON/pacote)
5. Use artefatos gerados como contratos para implementação de API

## API Runtime Env (integrada)

- `GET /api/runtime/env?environment=dev|development|staging|ci|test`
- `POST /api/runtime/env`

O servidor persiste chaves de tempo de execução aprovadas para arquivos em `apps/backend-template/src/config/`.

### Postura de segurança

- Bind padrão é `127.0.0.1` (apenas loopback).
- Vincular a todas as interfaces requer opt-in explícito via `JUMENTIX_SERVICE_MANAGEMENT_HOST=0.0.0.0`.
- Token bearer opcional para requisições de mutação via `JUMENTIX_SERVICE_MANAGEMENT_AUTH_TOKEN`.
- Cada mutação é registrada com timestamp, ambiente e chaves alteradas (não valores).

### Contrato de erro

- Ambiente desconhecido: `400` com lista de aceitos, nenhum arquivo escrito.
- Diretório de configuração ausente na inicialização: servidor encerra com erro claro.
- Arquivo de ambiente ausente: `400` com path resolvido.
- Payload JSON inválido: `400` distinguindo parse de falha de filesystem.
- Mutação não autorizada: `401` quando token de auth está configurado.

## Fluxo de edição em tempo de execução

1. Selecione o ambiente em Configuração de Serviço.
2. Clique em `Load Environment` para ler os valores atuais do arquivo env.
3. Altere as chaves de tempo de execução no formulário.
4. Clique em `Salvar ambiente` para persistir os valores.
5. Reinicie o perfil PM2 se a alteração do tempo de execução afetar os processos ativos.

## Notas

- O editor de ambiente de tempo de execução limita intencionalmente as atualizações às chaves aprovadas (proteção).
- Combinações de tempo de execução não suportadas são bloqueadas pela validação de inicialização no bootstrap.

## Modelos de contêiner

Os modelos de contêiner de nível de serviço são fornecidos em:

- `apps/backend-template/docker/services/`

Perfis orquestrados:

- `apps/backend-template/docker-compose-service-templates.yml`

## Testes

Fumaça de integração:

```bash
bun run test:integration:service-management
```

Fumaça da unidade para presença de recurso de roteiro:

```bash
NODE_ENV=dev bunx jest apps/backend-template/test/unit/service-management/mvp.roadmap.features.test.ts --runInBand
```

