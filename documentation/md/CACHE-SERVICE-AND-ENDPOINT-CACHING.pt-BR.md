<!--
Arquivo gerado automaticamente a partir de: documentation/md/CACHE-SERVICE-AND-ENDPOINT-CACHING.md
Idioma alvo: Português (Brasil)
-->
# Serviço de cache e cache de leitura

## Propósito

Forneça uma camada de cache baseada em contrato que possa ser reutilizada por serviços sem acoplar a lógica de domínio a um mecanismo de armazenamento específico.

## Implementação

- Contrato e implementação de cache:
  - `apps/backend-template/src/infra/cache/ICacheService.ts`
  - `apps/backend-template/src/infra/cache/CacheService.ts`
- Dependência do adaptador de armazenamento:
  - `apps/backend-template/src/infra/persistence/KeyValueStorage/IKeyValueStorageClient.ts`

O cache usa envelopes de valores-chave:

```ts
{
  value: any;
  expiresAt?: number;
}
```

`expiresAt` é opcional e é avaliado nas leituras.

## Modelo de invalidação

A implementação usa controle de versão de namespace:

- `cache:versão:usuários`
- `cache:versão:organizações`

As chaves de leitura incluem a versão atual do namespace (`vN`).  
As operações de gravação aumentam a versão do namespace, invalidando as chaves de leitura anteriores sem exclusões de curinga.

## Comportamento de cache de leitura do endpoint

Integração de leitura atual:

- `UserService`
  - `getOneById`
  - `obter tudo`
- `OrganizaçãoServiço`
  - `getOneById`
  - `obter tudo`

Invalidação do gatilho de gravação atual:

- Mutações agregadas do usuário:
  - criar/atualizar/excluir
  - atualizar senha
  - criar/atualizar/excluir documento
  - criar/atualizar/excluir telefone
  - criar/atualizar/excluir e-mail
- Mutações agregadas da organização:
  - criar/atualizar/excluir
  - criar/atualizar/excluir endereço
  - criar/atualizar/excluir telefone
  - criar/atualizar/excluir e-mail

## Fiação de composição

`composeUsersAuthServices` agora compila e injeta `CacheService` quando `keyValueStorageClient` está disponível.

## Testes

- `apps/backend-template/test/unit/infra/cache/CacheService.test.ts`
- `apps/backend-template/test/unit/modules/Users/service/UserService.test.ts`
- `apps/backend-template/test/unit/modules/Users/service/OrganizationService.test.ts`


