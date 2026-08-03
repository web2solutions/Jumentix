<!--
Arquivo gerado automaticamente a partir de: documentation/md/EVENTS-AND-MESSAGES-MAP.md
Idioma alvo: Português (Brasil)
-->
# Mapa de eventos e mensagens

Este documento mapeia os contratos de integração atuais usados pelo Jumentix, incluindo publicação/assinatura de eventos e contratos de mensagens de solicitação/resposta através do `MessageMediator`.

## 1) Envelope de Evento de Integração

Publicado através de `IEventBus.publish(event)` (e portanto também através de `IMessageMediator`, uma vez que estende `IEventBus`):

```ts
interface IIntegrationEvent {
  name: string;
  payload: Record<string, any>;
  occurredAt?: string;
}
```

## 2) Envelope de mensagem de solicitação/resposta

Usado através de `IMessageMediator.request(message, options)` e `registerHandler(contract, handler, options)`:

```ts
interface IMessage<TPayload = any> {
  contract: string;
  version?: string;
  payload: TPayload;
  metadata?: {
    requestId?: string;
    correlationId?: string;
    causationId?: string;
    replyTo?: string;
    timestamp?: string;
    headers?: Record<string, string>;
  };
}

interface IMessageResponse<TResult = any> {
  contract: string;
  version?: string;
  metadata?: IMessageMetadata;
  result?: TResult;
  error?: Error | Record<string, any>;
}
```

## 3) Adaptadores Mediadores de Mensagens

- `inmemory` (padrão): envio síncrono em processo com tempo limite opcional.
- `rabbitmq`: solicitação/resposta baseada em fila + publicação de troca de tópicos.
- `bullmq`: solicitação/resposta baseada em fila Redis + filas de eventos.

A seleção é feita por `JUMENTIX_MESSAGE_MEDIATOR_ADAPTER` em `apps/backend-template/src/infra/messages/compileMessageMediator.ts`.

## 4) Mapa de eventos de domínio atual (usuários)

Produtor: `UserService` (`apps/backend-template/src/modules/Users/service/UserService.ts`)

| Nome do Evento | Publicado por | Gatilho |
|---|---|---|
| `users.user.created` | `UserService.create` | usuário criado |
| `usuários.usuário.atualizado` | `UserService.update` | usuário atualizado |
| `usuários.usuário.deletado` | `UserService.delete` | usuário excluído |
| `users.user.credentialsUpdated` | `UserService.updatePassword` | senha/credenciais atualizadas |

Os ouvintes são registrados em `registerUserEventListeners` (`apps/backend-template/src/modules/Users/events/listeners/registerUserEventListeners.ts`) por meio de:
- `onUserCreated`
- `onUserUpdated`
- `onUserDeleted`
- `onUserPasswordUpdated`

## 5) Mapa atual do contrato de solicitação/resposta (usuários/autenticação)

Registrado em `registerUserMessageHandlers` (`apps/backend-template/src/modules/Users/events/listeners/registerUserMessageHandlers.ts`):

| Contrato | Proprietário do manipulador | Carga útil de entrada | Resultado/Erro |
|---|---|---|---|
| `users.auth.authorize` | Serviço de autenticação de usuários | `{ autorização: string }` | carga útil ou erro do usuário autenticado |
| `users.auth.ensure-access` | Serviço de autenticação de usuários | `{ autorização: string, esquemaOAS: Record<string, any> }` | carga útil do usuário autorizado ou erro se proibido/não autorizado |

## 6) Onde os contratos são consumidos

- Chamadas do decorador `Authorize` (`apps/backend-template/src/shared/decorators/guard/Authorize.ts`):
  - `users.auth.ensure-access`
- A raiz de composição (`composeUsersAuthServices`) registra contratos de domínio quando existe um mediador.

Isso mantém a autorização de solicitação/resposta baseada em contrato e dissociada da injeção direta de serviço.

## 7) Topologia de tempo de execução (atual)

1. Adaptador HTTP recebe solicitação.
2. O controlador/caso de uso emite eventos de domínio ou solicita ao `MessageMediator` verificações de serviço cruzado.
3. O mediador é despachado por adaptador selecionado (`inmemory` / `rabbitmq` / `bullmq`).
4. O manipulador retorna uma resposta do contrato (`resultado` ou `erro`).

## 8) Diretrizes de extensão para novos domínios

Ao adicionar um novo domínio:

1. Defina nomes de eventos de integração (`<domínio>.<entidade>.<ação>`).
2. Publique eventos de serviços após transições de estado bem-sucedidas.
3. Defina contratos de solicitação/resposta (`<domínio>.<capacidade>.<verbo>`).
4. Registre manipuladores na composição do domínio.
5. Mantenha as cargas controláveis ​​(`versão` + metadados).
6. Documente novos contratos neste arquivo e nos documentos do domínio.

## 9) Referências de contrato de interface em tempo real

- Contratos de transporte WebSocket:
  - `documentation/md/contracts/WEBSOCKET-REALTIME-CONTRACTS.md`
- contratos de transporte gRPC:
  - `documentação/md/contratos/GRPC-REALTIME-CONTRACTS.md`

Esses documentos de transporte definem os envelopes externos de solicitação/resposta e a semântica de canal/serviço usados ​​por clientes em tempo real.
