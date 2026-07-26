<!--
Arquivo gerado automaticamente a partir de: documentation/md/SPEC-FEATURES-WORKFLOWS-CATALOG.md
Idioma alvo: Português (Brasil)
-->
# Catálogo de recursos e fluxos de trabalho de especificações

Este catálogo mapeia os recursos do Jumentix para os artefatos de especificações necessários e limites de implementação.

Use isso como ponto de entrada de planejamento antes das alterações de código.

## Grupo de capacidade A - Fábrica de serviços de back-end

Inclui:

1. Serviços de API REST
2. Serviços substitutos WebSocket + REST
3. Serviços substitutos gRPC + REST
4. Implantações orientadas a funções (Lambda, Vercel Functions, Cloudflare Workers)

Especificações necessárias:

1. `spec/1.0.0.yml` para contratos HTTP
2. `spec/asyncapi/1.0.0.websocket.yml` e/ou `spec/asyncapi/1.0.0.grpc.yml`
3. Contratos de erro em `documentation/md/ERROR-CONTRACTS-AND-RESPONSES.md`
4. Contratos de tempo de execução/ambiente em `documentation/md/RUNTIME-ENVIRONMENT-CONTRACTS.md`

Verificações obrigatórias:

1. Verificações de resolução de rota/manipulador
2. Unidade + integração + testes de fumaça para adaptadores afetados
3. Verificações do limite de cobertura

## Grupo de Capacidade B - Evolução de Domínio e Dados

Inclui:

1. Criação de novo domínio
2. Mudanças de entidade/modelo de dados
3. Mudanças no objeto de valor (Documento, Endereço, Telefone, Email, etc.)
4. Atualizações de relacionamento e RBAC/locação

Especificações necessárias:

1. Esquemas OpenAPI e objetos de porta (`spec/1.0.0.yml`)
2. Modelo de domínio/documentos de entidade (`documentation/md/DOMAIN-DATA-ENTITIES.md`, `documentation/md/domains/**/*`)
3. Documentos de eventos/mensagens quando o comportamento é assíncrono (`documentation/md/EVENTS-AND-MESSAGES-MAP.md`)
4. Atualizações dos requisitos dos agentes para impacto do NFR

Verificações obrigatórias:

1. Testes unitários de domínio/modelo
2. Testes de integração de endpoint
3. Verificações de alinhamento de contrato

## Grupo de Capacidade C - Integração em Tempo Real

Inclui:

1. Manipuladores Socket.IO e contratos de mensagens
2. Manipuladores gRPC e contratos de solicitação/resposta
3. Resiliência entre nós usando adaptadores Redis/cluster

Especificações necessárias:

1. Arquivos de contrato AsyncAPI
2. Documentos do adaptador em tempo real:
   - `documentação/md/adapters/realtime/WEBSOCKET-API.md`
   - `documentação/md/adapters/realtime/GRPC-API.md`
3. Documentos de contrato em tempo real:
   - `documentation/md/contracts/WEBSOCKET-REALTIME-CONTRACTS.md`
   - `documentação/md/contratos/GRPC-REALTIME-CONTRACTS.md`

Verificações obrigatórias:

1. Testes de unidade em tempo real, quando aplicável
2. Testes de integração multi-instâncias
3. Testes de fumaça em tempo real

## Grupo de Capacidade D - Persistência e Drivers Externos

Inclui:

1. Comportamento do adaptador oficial na memória
2. Drivers SQL por meio do Sequelize
3. Mongo até Mangusto
4. Adaptadores DynamoDB/Cassandra/Firebase/Aurora/RDS/Oracle
5. Armazene abstração por meio de `IStore` e `IDatabaseClient`

Especificações necessárias:

1. Contratos de persistência em `pacotes/contratos de persistência`
2. Contratos de seleção de driver de tempo de execução (`AAA_DATABASE_DRIVER`)
3. Documentos do adaptador de banco de dados em `documentation/md/adapters/databases/*`
4. Documentos da matriz de validação de fumaça em `documentation/md/DATABASE-DRIVERS-SMOKE-TESTS.md`

Verificações obrigatórias:

1. Testes de fumaça do motorista
2. Verificações de integração para repositórios críticos
3. Verificações de inicialização em tempo de execução

## Capability Group E - Gerenciamento de serviços e automação de desenvolvedores

Inclui:

1. Guias/fluxos de trabalho do aplicativo de gerenciamento de serviços
2. MVP do Designer de Domínio
3. Escopo do Designer de Interface de Comunicação
4. Configuração de serviços e implantação de fluxos de trabalho de gerenciamento
5. Automação de andaime de inicialização CLI

Especificações necessárias:

1. Documentos de gerenciamento de serviços em `apps/service-management/documentation/*`
2. Contratos CLI e documentos em `packages/cli-init/*`
3. Documentos de execução e migração do Monorepo

Verificações obrigatórias:

1. Scripts de validação de fluxo de trabalho
2. Sincronização de documentos com índices README
3. Rastreabilidade da governança em relação aos itens do conselho do projeto

## Grupo de Capacidade F - Governança, Conformidade e Liberação

Inclui:

1. Cobertura e limites de IC
2. Segurança e controles PCI
3. Regras de governança de tarefas do projeto
4. Controles de liberação/versionamento

Especificações necessárias:

1. `.agentes/requisitos/*`
2. `.agentes/NFR-REGISTRY.md`
3. `documentação/md/JUMENTIX-PROJECT-GOVERNANCE.md`
4. `documentação/md/JUMENTIX-RELEASE-AND-VERSIONING-STRATEGY.md`

Verificações obrigatórias:

1. Verificações de CI `ci:gate` e monorepo
2. Portões da política de cobertura
3. Varreduras/portões de segurança
4. Evidências de ligação de governança em RP

## Grupo de Capacidade G - Site do produto e portal de documentação

Inclui:

1. Páginas comerciais de produto e casos de uso
2. Documentação técnica baseada em Markdown
3. Rotas canônicas e retrocompatíveis de documentação
4. Busca, sidebar, índice da página, feedback, links de edição e navegação responsiva
5. Automação de build e publicação na Vercel

Especificações necessárias:

1. `.agents/requirements/069-jumentix-website-commercial-static-vercel-governance.md`
2. `.agents/requirements/091-jumentix-website-design-system-and-storybook.md`
3. `.agents/requirements/092-jumentix-oss-commercial-experience.md`
4. `apps/jumentix-website/documentation/COMMERCIAL-EXPERIENCE.pt-BR.md`
5. `apps/jumentix-website/documentation/CONTENT-PIPELINE.pt-BR.md`
6. `apps/jumentix-website/documentation/VERCEL-DEPLOYMENT.pt-BR.md`
7. Auditoria de UX e arquitetura da informação em
   `apps/jumentix-website/documentation/research`

Verificações obrigatórias:

1. Typecheck e build de produção do site
2. Verificações prepublish de rotas e marcadores de conteúdo inválido
3. Verificação no navegador de layout, navegação, links e estados responsivos
4. Smoke test do deploy de produção na Vercel
5. Cobertura Storybook para componentes reutilizáveis do site
6. Build estático do Storybook e validação smoke do manifesto
7. Validação de acessibilidade, temas, viewports e redução de movimento do design system
8. Paridade das rotas comerciais EN/PT e navegação que preserva o idioma
9. Metadados canônicos, hostname do sitemap, paginação do changelog e integridade dos links

## Definição de fluxo de trabalho (especificações primeiro)

Para cada grupo de capacidade:

1. Defina ou atualize os artefatos de especificação primeiro.
2. Validar a arquitetura e os limites NFR.
3. Implemente apenas o escopo de especificações aprovado.
4. Comprove a conformidade com testes/verificações.
5. Publicar evidências de governança e sincronizar documentos.
