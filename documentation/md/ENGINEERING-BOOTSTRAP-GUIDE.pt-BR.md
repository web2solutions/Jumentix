<!--
Arquivo gerado automaticamente a partir de: documentation/md/ENGINEERING-BOOTSTRAP-GUIDE.md
Idioma alvo: Português (Brasil)
-->
# Guia de bootstrap de engenharia

Este guia explica como usar esse padrão para criar um novo serviço de back-end em três formatos comuns:

- Serviço API REST
- Microsserviço (serviço focado em domínio)
- Serviço baseado em manipulador AWS Lambda

O objetivo é ajudar os engenheiros de software a passar da ideia ao serviço funcional com a arquitetura e as convenções existentes.

## Mapa do espaço de trabalho Monorepo

Layout atual do espaço de trabalho:

- `apps/backend-template`: propriedade do aplicativo em tempo de execução para perfis de bootstrap de backend e ecossistemas PM2.
- `apps/service-management`: aplicativo web de gerenciamento de serviços e servidor de tempo de execução.
- `packages/*`: pacotes internos reutilizáveis ​​(mediador de mensagens, clientes SDK, infra adaptadores).
- root `apps/backend-template/src/`: ponte de migração incremental enquanto a propriedade do aplicativo/pacote é finalizada.

Comandos principais de orquestração:

```bash
pnpm run mono:build
pnpm run mono:test
pnpm run mono:lint
pnpm run mono:typecheck
```

## 1. Antes de começar

### Requisitos de tempo de execução e ferramentas

- Node.js `22.x`
- npm
- Redis (para fluxos relacionados a mutex e cenários de integração)

### Instalar dependências

```bash
pnpm install
```

### Execute verificações de linha de base

```bash
pnpm run lint
pnpm run test:unit
pnpm run oas:check-routes
```

## 2. Entenda o fluxo da arquitetura

O projeto segue este caminho de solicitação:

`Handler -> Controller -> Service -> Use Case -> Repository -> Adapter`

Use esta regra ao criar novos recursos:

- As preocupações com HTTP e transporte permanecem nos manipuladores/controladores.
- O comportamento empresarial permanece em serviços/casos de uso/modelos de domínio.
- Os detalhes de persistência de dados permanecem em repositórios/adaptadores.

## 3. Crie um novo recurso de API REST

### Passo a passo

1. Defina ou atualize o contrato OpenAPI em `spec/`.
2. Adicione o manipulador de solicitação ao adaptador de estrutura selecionado.
3. Adicionar/estender método de controlador.
4. Implementar método de serviço e função de caso de uso.
5. Atualizar contrato e implementação do repositório.
6. Adicione testes de unidade para comportamento de serviço/caso de uso.
7. Adicione teste de integração para o endpoint.

### Lista de verificação sugerida

- [] Operação OEA adicionada com `operationId` claro
- [] O método do controlador existe para operação
- [] O manipulador resolve a operação para o método correto do controlador
- [] A validação cobre solicitação e campos obrigatórios
- [] Os campos sensíveis são limpos nas respostas de saída
- [] Os testes passam localmente e no portão CI

## 4. Crie um novo microsserviço a partir deste modelo

Uma estratégia prática é clonar este repositório e manter apenas o contexto limitado que você precisa primeiro e depois evoluir.

### Abordagem recomendada

1. Identifique o limite do domínio (por exemplo, faturamento, estoque, notificações).
2. Manter a estrutura da arquitetura básica inalterada.
3. Substitua exemplos de modelos de domínio/casos de uso por modelos específicos de domínio.
4. Manter padrões de infraestrutura compartilhados (autenticação, validação, contratos de repositório, testes, CI).
5. Comece com um adaptador na memória e depois passe para um adaptador de banco de dados real.

### Por que isso funciona

- Mantém as convenções da equipe estáveis ​​entre os serviços.
- Reduz o tempo de inicialização para cada novo microsserviço.
- Facilita a integração entre serviços para os engenheiros.

## 5. Crie ou estenda manipuladores Lambda

Os manipuladores Lambda devem usar a mesma composição de serviço dos adaptadores REST sempre que possível.

### Passos práticos

1. Crie o arquivo manipulador no caminho do adaptador da estrutura lambda.
2. Reutilize a fábrica de composição de serviço compartilhado.
3. Construa o controlador com os serviços compostos.
4. Mapeie a carga útil do evento Lambda para a entrada do evento do domínio.
5. Retorne um objeto de resposta padronizado semelhante a HTTP.

### Verificações de qualidade Lambda

- Mantenha o formato da resposta consistente com os manipuladores existentes.
- Reutilize a lógica centralizada de autenticação e validação.
- Evite fiação única personalizada que diverge da composição REST.

## 6. Fluxo de trabalho de modelagem de dados (com Moon Modeler)

Você pode combinar este padrão com o [Moon Modeler](https://www.datensen.com/products/moon-modeler/) para um design de persistência mais rápido e seguro.

### Fluxo de trabalho sugerido

1. Modele entidades e relações no Moon Modeler.
2. Exporte artefatos de esquema.
3. Mapeie artefatos para modelos de domínio e interfaces de repositório.
4. Implemente o adaptador para o mecanismo de persistência escolhido.
5. Adicione testes de migração e repositório.
6. Valide o comportamento por meio de testes unitários e de integração.

## 7. Fluxo de trabalho assistido por IA para entrega mais rápida

As ferramentas de IA podem ajudar a acelerar tarefas repetitivas de engenharia:

- rascunho de especificações de rota e DTOs da OEA
- rascunho de cenários de teste e matrizes de casos extremos
- gerar andaime do adaptador de repositório
- sugerir refatoradores preservando os limites da arquitetura

Prática recomendada:

- Use IA para rascunhos.
- Mantenha a revisão final, as escolhas de arquitetura e os critérios de aceitação com os engenheiros.
- Imponha a correção com lint, testes e porta CI.

## 8. Comandos que você usará com mais frequência

### Tempo de execução de desenvolvimento

```bash
pnpm run dev:express
pnpm run dev:fastify
pnpm run dev:restify
pnpm run dev:hyper-express
pnpm run dev:serverless
```

### PM2 multi-aplicativo (monorepo)

```bash
pnpm run pm2:start:dev:restapi
pnpm run pm2:start:dev:websocket-rest
pnpm run pm2:start:dev:grpc-rest
```

Esses perfis iniciam o gerenciamento de serviços junto com adaptadores de back-end usando `pm2/*`.

### Qualidade e paridade de CI

```bash
pnpm run lint
pnpm run test:unit
pnpm run oas:check-routes
pnpm run build:dev
pnpm run ci:smoke
pnpm run ci:gate
pnpm run ci:monorepo
```

## 9. Definição de pronto para novos recursos

Um recurso deve ser considerado concluído quando:

- O contrato OpenAPI é atualizado e a verificação de resolução de rota é aprovada.
- O comportamento empresarial é coberto por testes unitários.
- O caminho crítico do endpoint tem cobertura de integração.
- Nenhum campo confidencial vaza nas respostas da API.
- `pnpm run ci:gate` passa localmente e em CI.

## 10. Armadilhas comuns a serem evitadas

- Misturar preocupações de infraestrutura dentro de casos de uso de domínio.
- Retornando persistência interna (senha/salt/segredos) nas respostas.
- Adicionando lógica específica da estrutura diretamente nos serviços.
- Criação de composição divergente para Lambda versus REST.
- Ignorar verificações de resolução de rota da OAS antes dos testes de tempo de execução.

Seguir os padrões existentes neste modelo é o caminho mais rápido para uma entrega consistente e sustentável.


<!-- test-pyramid-tdd -->
## Pirâmide de Testes Hexagonal / TDD (Bun)

Localmente todos os testes rodam no Bun (Requisito 106). Prefira:

```bash
bun run tdd
bun run tdd:domain
bun run test:unit
bun run test-map:check
```

Node/Jest é exclusivo do CI. Veja `documentation/md/HEXAGONAL-TEST-PYRAMID.pt-BR.md`.
