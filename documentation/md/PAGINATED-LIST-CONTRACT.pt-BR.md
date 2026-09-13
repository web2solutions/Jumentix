# Contrato de Listagem Paginada (`page`, `size`, `filter`, `sort`, `q`)

Linear: [JUM-777](https://linear.app/jumentix/issue/JUM-777) · Épico `[EPIC][Frontend] Frontend seed and X-CRUD kit hardening` · Requisitos `036`, `115`, `118`, `126` (estilo de erro), `136`.

The English version is at [PAGINATED-LIST-CONTRACT.md](./PAGINATED-LIST-CONTRACT.md).

## Por quê

`GET /users` e `GET /organizations` declaravam um único parâmetro `page` (`in: path`, string que
nunca era validada) e respondiam um array puro. O backend já paginava e filtrava internamente; o
contrato não dizia isso, então todo consumidor carregava a coleção inteira e ordenava, buscava e
paginava em memória. O kit X-CRUD mira domínios gerados (pagamentos, estoque, CRM) onde isso não
escala. JUM-777 torna o comportamento de listagem parte do documento OpenAPI.

## Requisição

| Parâmetro | Em | Tipo | Significado |
| --- | --- | --- | --- |
| `page` | query | inteiro ≥ 1, padrão 1 | número da página (base 1) |
| `size` | query | inteiro 1…`maxSize`, padrão `defaultSize` | tamanho da página |
| `filter` | query | string | base64 de um objeto JSON com chaves em campos **filterable** |
| `sort` | query | string | pares `campo:asc\|desc` separados por vírgula sobre campos **sortable** |
| `q` | query | string (≤ 200) | texto livre, sem distinção de caixa, sobre os campos **searchable** |

Valores de `filter`: escalar significa igualdade (`{ "roles": "admin" }` casa com um campo array que
contém o valor); objeto aplica um operador:

```json
{ "firstName": { "operator": "contains", "value": "an" },
  "createdAt": { "operator": "between", "value": ["2026-01-01", "2026-01-31T23:59:59.999Z"] } }
```

Operadores aceitos: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `nin`, `contains`, `ilike`, `like`,
`between`, `exists`. Strings ISO-8601 comparam como instantes; números numericamente; texto sem
distinção de caixa (`contains`).

Query strings são convertidas antes da validação: `page=2` satisfaz `type: integer`; `page=two`
responde 400.

## `x-list-capabilities`

Cada operação de listagem declara o que o cliente pode fazer — o frontend renderiza os controles a
partir disso e o servidor rejeita tudo fora dele:

```yaml
x-list-capabilities:
  sortable: [firstName, lastName, username, organization, createdAt, updatedAt]
  filterable: { firstName: text, lastName: text, username: text, organization: uuid,
                roles: enum, createdAt: date, updatedAt: date }
  searchable: [firstName, lastName, username]
  defaultSize: 30
  maxSize: 100
```

Uma operação **sem** a extensão mantém o comportamento legado (paginação + filtro base64, sem
validação, sem `sort`/`q`); os clientes a tratam como "carregar tudo".

## Resposta

`UserArrayOf` / `OrganizationArrayOf` são o envelope de página:

```json
{ "result": [ …User ], "page": 1, "size": 30, "total": 6 }
```

`total` conta todos os registros que casam com `filter` e `q`, em todas as páginas.

## Erros (400, `GENERIC.INVALID_INPUT`)

Toda rejeição nomeia os valores aceitos, no estilo que o Requisito `126` usa para enums:

- `The sort field "password" is not sortable. Accepted: firstName, lastName, username, organization, createdAt, updatedAt.`
- `The filter field "password" is not filterable. Accepted: firstName, roles, createdAt.`
- `The filter operator "regex" on "firstName" is not accepted. Accepted: …`
- `The parameter size must be between 1 and 100; received 101.`
- `page number must be smaller than the number of total pages` — página além da última é requisição
  malformada, não página vazia (um cliente paginando com `total` antigo após um delete recua uma página).
- `The parameter q is not supported by this operation: it declares no x-list-capabilities.searchable.`

## Implementação

- `packages/persistence-contracts/src/listQuery.ts` — uma implementação de filtros, busca,
  ordenação e paginação (`runListQuery`), compartilhada por `InMemoryRelationalStore` e
  `ExternalStoreProxy` (todos os drivers SQL/NoSQL), para nenhum driver divergir do documento.
  `IPagingRequest` carrega `sort`, `q` e `searchFields`.
- `apps/backend-template/src/modules/port/setListQuery.ts` — analisa e valida a query contra
  `x-list-capabilities` de `event.schemaOAS`; usado por `UserController.getAll` e
  `OrganizationController.getAll`.
- `apps/backend-template/src/interface/HTTP/validators/validateRequestParams.ts` — coerção de
  query string para schemas `integer`/`number`/`boolean`.

## Evidência

- `bun test packages/persistence-contracts/test` — `listQuery.test.ts` fixa operadores, busca,
  ordenação (nulos por último, instantes ISO), limites de paginação.
- `bun test apps/backend-template/test/unit/modules/port/setListQuery.test.ts` — erros com lista
  aceita, defaults, operações legadas.
- `bun test apps/backend-template/test/integration/Express/Users/getAll.test.ts` — servidor Express
  real: paginação + total, ordenação nas duas direções, `roles=admin`, `contains`, `q`, os 400.
- `bun run oas:check-routes` — o Requisito `036` continua válido para os schemas de envelope.
