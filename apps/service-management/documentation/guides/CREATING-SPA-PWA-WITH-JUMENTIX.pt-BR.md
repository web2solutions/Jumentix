<!--
Arquivo gerado automaticamente a partir de: apps/service-management/documentation/guides/CREATING-SPA-PWA-WITH-JUMENTIX.md
Idioma alvo: Português (Brasil)
-->
# Criando SPA/PWA com Jumentix

Este guia descreve como usar Jumentix para planejar e entregar aplicativos frontend (SPA/PWA) integrados com serviços backend.

## Responsabilidade no escopo

- **Responsável por:** Jornada frontend/offline para apps no estilo Service Management
- **Usado com:** designer-core, cana, hub do app service-management
- **Não responsável por:** Repositórios de banco server-side ou clientes gRPC Node

## Glossário

- **Guia** — documento de jornada; siga os passos em ordem antes de pular para mapas de API.
- **Composition root** — startup que liga env → adapters → use-cases.

## O que é

Construa uma SPA/PWA com designer-core para o modelo e Cana para persistência offline.

## 1. Modele primeiro os domínios de negócios

Use o Designer de Domínio para definir:

- domínios e contextos limitados
- entidades de dados e objetos de valor
- relacionamentos e restrições
- Contratos de API e eventos

Isso mantém o estado do front-end e os contratos de back-end alinhados desde a primeira iteração.

## 2. Definir contratos de comunicação

Utilize o Communication Interface Designer para escolher:

- Consumo somente REST
- Tempo real com WebSocket
- Tempo real com gRPC (para consumidores de back-end baseados em Node)

Os contratos se tornam a fonte da integração SDK/cliente.

## 3. Configurar o tempo de execução do serviço

Na configuração do serviço:

- escolha o tipo de serviço (`RESTAPI`, `websocketAPI + RESTAPI`, `grpcAPI + RESTAPI`)
- configurar o tempo de execução e o destino de implantação
- edite chaves de ambiente como `JUMENTIX_HTTP_FRAMEWORK`, `JUMENTIX_REALTIME_API`, `JUMENTIX_REALTIME_API_PROTOCOL`

## 4. Crie um PWA com capacidade offline

Para arquitetura PWA/offline-first:

- use IndexedDB local no frontend
- sincronizar com contratos de back-end de forma assíncrona
- manter as estratégias de conflito explícitas (last-write-wins ou mesclagem específica de domínio)

## 5. Validar a disponibilidade de entrega

- verificações de contrato de OpenAPI/AsyncAPI
- portas CI de back-end
- construção de front-end e verificações de fumaça offline

## 6. Offline com Cana + designs

<DocsPlayground runtime="designer-core" id="getting-started" />

<DocsPlayground runtime="cana" id="getting-started" />

## Próximos passos

1. [Começando](/docs/pt-BR/jumentix/concepts/getting-started)
2. [Cana](/docs/pt-BR/jumentix/packages/cana/usage)
3. [designer-core](/docs/pt-BR/jumentix/packages/designer-core/usage)

## Referências

- Pacotes: [/docs/pt-BR/jumentix/packages](/docs/pt-BR/jumentix/packages)

## Checklist júnior (“Eu consigo …”)

- [ ] Explico o objetivo deste guia em uma frase
- [ ] Completei o primeiro sucesso sem adivinhar jargão
- [ ] Sei a próxima página de docs a abrir
