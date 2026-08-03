<!--
Arquivo gerado automaticamente a partir de: apps/backend-template/documentation/guides/CREATING-REALTIME-API-WITH-JUMENTIX.md
Idioma alvo: Português (Brasil)
-->
# Criando API em tempo real com Jumentix

Este guia aborda a configuração de serviços em tempo real usando WebSocket ou gRPC com REST substituto.

## 1. Habilitar tempo de execução em tempo real

Definir perfil de ambiente:

- `JUMENTIX_REALTIME_API = sim`
- `JUMENTIX_REALTIME_API_PROTOCOL=websocket` ou `grpc`
- `JUMENTIX_HTTP_FRAMEWORK=express` para documentação REST substituta e fallback operacional

Iniciar perfil de tempo de execução:

```bash
bun run dev:websocket
# or
bun run dev:grpc
```

## 2. Definir contratos assíncronos

1. Defina canais/mensagens em arquivos AsyncAPI em `spec/`.
2. Mantenha os contratos de carga alinhados com modelos de domínio e assinaturas de métodos de controlador.
3. Referência a contratos de resposta/erro em implementações de manipuladores.

## 3. Implementar manipuladores de mensagens

- Os manipuladores WebSocket recebem mensagens, invocam métodos de controlador e respondem à mesma correlação cliente/mensagem.
- Os manipuladores gRPC recebem solicitações, invocam métodos de controlador e retornam respostas nativas do protocolo.

## 4. Mantenha o substituto REST disponível

Os serviços em tempo real são executados com REST como interface secundária. Use documentos REST e endpoints se o canal em tempo real estiver degradado.

## 5. Valide a estabilidade em tempo real

```bash
bun run test:integration:realtime
bun run test:smoke:realtime
```

## Referências

- [API WebSocket em tempo real](../../../../documentation/md/adapters/realtime/WEBSOCKET-API.md)
- [API gRPC em tempo real](../../../../documentation/md/adapters/realtime/GRPC-API.md)
- [Contratos em tempo real WebSocket](../../../../documentation/md/contracts/WEBSOCKET-REALTIME-CONTRACTS.md)
- [Contratos em tempo real gRPC](../../../../documentation/md/contracts/GRPC-REALTIME-CONTRACTS.md)
