<!--
Arquivo gerado automaticamente a partir de: packages/sdk-grpc-client/README.md
Idioma alvo: Português (Brasil)
-->
# @jumentix/sdk-grpc-client

Cliente gRPC SDK para o gateway em tempo real, conduzido pela especificação AsyncAPI gRPC (`/spec/asyncapi/1.0.0.grpc.yml`).

## O que faz

- Carrega metadados do servidor AsyncAPI gRPC.
- Carrega `async-api.proto`.
- Cria cliente gRPC para `realtime.AsyncApiGateway`.
- Envia envelope de solicitação padronizado.

## Uso rápido

```ts
import { GrpcApiClient } from '@jumentix/sdk-grpc-client';

const client = new GrpcApiClient('localhost:3002');

const response = await client.request({
  operationId: 'createUser',
  input: {
    username: 'john',
    password: 'StrongPass#123'
  }
});
```

## Construir

```bash
pnpm --filter @jumentix/sdk-grpc-client build
```

