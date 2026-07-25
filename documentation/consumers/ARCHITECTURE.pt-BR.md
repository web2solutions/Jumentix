# Arquitetura para Consumidores

Jumentix entrega uma base arquitetural prática para software em produção:

- Domain Driven Design (DDD)
- Arquitetura Hexagonal
- Padrões de comunicação Event-Driven

## Impacto para consumidores

- Limites de módulos consistentes para manutenção de serviços
- Onboarding mais simples para times de engenharia
- Crescimento seguro de serviço único para ecossistemas de serviços
- Menor custo de refatoração ao introduzir novas interfaces ou tecnologias de dados

## Opções de interface

- Adaptadores HTTP/REST para múltiplos frameworks Node.js
- Adaptadores realtime para WebSocket e gRPC
- Caminhos de runtime orientados a funções para provedores de nuvem

## Opções de dados e integração

- Adaptador oficial in-memory para desenvolvimento e testes rápidos
- Caminhos SQL e NoSQL por meio de adaptadores de dados reutilizáveis
- Padrão Message Mediator para comunicação desacoplada entre domínios/serviços
