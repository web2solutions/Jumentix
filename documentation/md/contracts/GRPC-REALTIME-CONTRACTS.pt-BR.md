<!--
Arquivo gerado automaticamente a partir de: documentation/md/contracts/GRPC-REALTIME-CONTRACTS.md
Idioma alvo: Português (Brasil)
-->
# Contratos em tempo real gRPC

Contratos canônicos para transporte em tempo real gRPC.

## Fonte da Verdade

- `spec/asyncapi/async-api.proto` (proto canônico pertencente ao repositório)
- `spec/asyncapi/1.0.0.grpc.yml`
- `apps/backend-template/src/interface/gRPC/gRPCAPI.ts`

## Definição de serviço

```proto
service AsyncApiGateway {
  rpc Request (AsyncApiRequest) returns (AsyncApiResponse);
  rpc Exchange (stream AsyncApiRequest) returns (stream AsyncApiResponse);
}
```

## Contratos de mensagens

```proto
message AsyncApiRequest {
  string version = 1;
  string operationId = 2;
  string authorization = 3;
  string inputJson = 4;
  string paramsJson = 5;
  string queryStringJson = 6;
  string metadataJson = 7;
  string requestId = 8;
  string clientId = 9;
}

message AsyncApiResponse {
  bool ok = 1;
  string version = 2;
  string operationId = 3;
  string resultJson = 4;
  string errorName = 5;
  string errorMessage = 6;
  string requestId = 7;
  string clientId = 8;
  string metadataJson = 9;
}
```

## Regras de serialização

1. `inputJson`, `paramsJson`, `queryStringJson` e `metadataJson` são strings serializadas em JSON.
2. `resultJson` é a carga útil de saída serializada em JSON.
3. `requestId/clientId` pode ser fornecido diretamente e/ou dentro de `metadataJson`.
4. O servidor normaliza e retorna `requestId/clientId` no envelope de resposta.

## Erro no contrato

Quando `ok=false`, a resposta carrega:

```json
{
  "ok": false,
  "operationId": "updateOrganization",
  "errorName": "domain_validation_error",
  "errorMessage": "organization name is required"
}
```

A semântica do erro deve seguir:
- [Contratos e respostas de erro](../ERROR-CONTRACTS-AND-RESPONSES.md)

## Registro de Operação

`operaçãoId` deve ser de:
- `spec/asyncapi/1.0.0.grpc.yml` (`components.schemas.GrpcRequest.properties.operationId.enum`)

## Semântica de fluxo

`Exchange` é um fluxo bidirecional onde cada mensagem de solicitação recebe uma mensagem de resposta com `operationId` e dados de correlação correspondentes.

## Política de Alteração de Contrato

1. Atualize `.proto` e AsyncAPI juntos.
2. Gere novamente ou valide as suposições do SDK/cliente após alterações no contrato.
3. Documente quaisquer adições/remoções de campos neste arquivo e changelog.
