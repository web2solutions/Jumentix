# Interfaces GUI (inbound)

Este diretório é o **slot de GUI inbound** do backend-template na arquitetura
hexagonal. GUIs ficam no **lado driving**: são clientes que chamam a aplicação
por contratos (HTTP, WebSocket, gRPC e pontes locais futuras). Elas não devem
possuir regras de domínio.

## Layout

```txt
interface/GUI/
  web/       # SPA, PWA, sites — React, Vue, Next, Nuxt, …
  desktop/   # Shells desktop — Electron, GTK, …
```

Ambas as pastas são **placeholders** por enquanto. Implementações entram como
tarefas de feature com adapters, testes e docs (EN + PT-BR).

## Posição hexagonal

| Asset | Camada |
| --- | --- |
| `GUI/web/*`, `GUI/desktop/*` | Inbound / driving (clientes de apresentação) |
| `interface/HTTP|WebSocket|gRPC|…` | Adapters inbound que as GUIs tipicamente chamam |
| `modules/*/application` + `domain` | Núcleo — nunca importado pelo código de UI |
| `infra/*` | Outbound — não usado diretamente pela GUI |

Ordem de chamada:

`GUI → adapter/handler de transporte → controller → caso de uso → domínio → port → adapter outbound`

## Docs relacionadas

- [Arquitetura e Estrutura](../../../../../documentation/md/ARCHITECTURE-AND-STRUCTURE.pt-BR.md)
- Mapa comercial: `/pt-BR/architecture` no site Jumentix
