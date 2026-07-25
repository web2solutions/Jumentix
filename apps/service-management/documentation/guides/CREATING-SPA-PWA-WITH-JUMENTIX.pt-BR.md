<!--
Arquivo gerado automaticamente a partir de: apps/service-management/documentation/guides/CREATING-SPA-PWA-WITH-JUMENTIX.md
Idioma alvo: Português (Brasil)
-->
# Criando SPA/PWA com Jumentix

Este guia descreve como usar Jumentix para planejar e entregar aplicativos frontend (SPA/PWA) integrados com serviços backend.

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
- edite chaves de ambiente como `AAA_HTTP_FRAMEWORK`, `AAA_REALTIME_API`, `AAA_REALTIME_API_PROTOCOL`

## 4. Crie um PWA com capacidade offline

Para arquitetura PWA/offline-first:

- use IndexedDB local no frontend
- sincronizar com contratos de back-end de forma assíncrona
- manter as estratégias de conflito explícitas (last-write-wins ou mesclagem específica de domínio)

## 5. Validar a disponibilidade de entrega

- verificações de contrato de OpenAPI/AsyncAPI
- portas CI de back-end
- construção de front-end e verificações de fumaça offline

## Referências

- [README do aplicativo de gerenciamento de serviços](../../README.md)
- [Pacotes do SDK do Workspace](../../../../packages/README.md)
- [Matriz de capacidades da fábrica de serviços Jumentix](../../../../documentation/md/JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX.md)
