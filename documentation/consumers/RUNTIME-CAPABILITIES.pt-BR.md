# Capacidades de Runtime (Visão do Consumidor)

O Jumentix permite que times consumidores escolham protocolos e frameworks de runtime sem reescrever a lógica de domínio.

## Interfaces de serviço

- API REST
- API WebSocket (+ fallback REST)
- API gRPC (+ fallback REST)

## Controle de runtime

O comportamento de runtime é configurado por contratos de ambiente, permitindo inicialização determinística e deploy previsível entre ambientes.

## Modos de deploy

- Serviços em VM gerenciados com PM2
- Serviços orientados a funções (estratégias de runtime em nuvem)
- Cenários híbridos combinando deploy de API e funções

## Confiabilidade e escala

- Adaptadores realtime suportam estratégias de escala para múltiplas instâncias
- Comunicação baseada em contratos reduz acoplamento e melhora flexibilidade de migração
