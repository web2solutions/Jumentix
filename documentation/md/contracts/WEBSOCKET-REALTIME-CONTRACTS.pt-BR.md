<!--
Arquivo gerado automaticamente a partir de: documentation/md/contracts/WEBSOCKET-REALTIME-CONTRACTS.md
Idioma alvo: Português (Brasil)
-->
# Contratos em tempo real WebSocket

Contratos canônicos para transporte em tempo real do Socket.IO.

## Fonte da Verdade

- `spec/asyncapi/1.0.0.websocket.yml`
- `apps/backend-template/src/interface/WebSocket/WebSocketAPI.ts`

## Envelope: Solicitação

```ts
interface ApiRequest {
  version?: string;
  operationId: string;
  authorization?: string;
  input?: Record<string, any>;
  params?: Record<string, any>;
  queryString?: Record<string, any>;
  metadata?: {
    requestId?: string;
    correlationId?: string;
    causationId?: string;
    [key: string]: any;
  };
}
```

## Envelope: Resposta

```ts
interface ApiResponse {
  ok: boolean;
  version?: string;
  operationId: string;
  result?: Record<string, any>;
  error?: {
    name?: string;
    message?: string;
  };
  metadata?: {
    requestId?: string;
    clientId?: string;
    channel?: string;
    [key: string]: any;
  };
}
```

## Contratos de canal

```txt
api:request                     -> generic request
api:response                    -> generic response
api:{operationId}:request       -> operation-specific request
api:{operationId}:response      -> operation-specific response
```

## Regras de Correlação

1. O cliente DEVE enviar `metadata.requestId`.
2. O servidor reutiliza o `requestId` fornecido ou gera um.
3. O servidor inclui `metadata.requestId` em resposta.
4. O servidor inclui `metadata.clientId` (ID do soquete) e `metadata.channel`.

## Erro no contrato

Quando `ok=false`, a resposta inclui:

```json
{
  "ok": false,
  "operationId": "createOrganization",
  "error": {
    "name": "validation_error",
    "message": "Invalid input data"
  }
}
```

A semântica do erro deve seguir:
- [Contratos e respostas de erro](../ERROR-CONTRACTS-AND-RESPONSES.md)

## Registro de Operação

`operationId` deve corresponder à lista de operações permitidas em:
- `spec/asyncapi/1.0.0.websocket.yml` (`components.schemas.ApiRequest.properties.operationId.enum`)

## Política de Alteração de Contrato

1. Atualize o arquivo AsyncAPI primeiro.
2. Mantenha a compatibilidade com versões anteriores do formato do envelope, quando possível.
3. Documente novos IDs de operação e formas de resposta neste arquivo.
