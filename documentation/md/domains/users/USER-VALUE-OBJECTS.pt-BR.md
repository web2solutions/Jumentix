<!--
Arquivo gerado automaticamente a partir de: documentation/md/domains/users/USER-VALUE-OBJECTS.md
Idioma alvo: Português (Brasil)
-->
# Objetos de valor de domínio de usuários

## Escopo
Objetos de valor usados pelo domínio Usuários:
- `EmailValueObject`
- `DocumentValueObject`
- `PhoneValueObject`
- `AddressValueObject` (usado por `Organização`)

## Fonte da verdade
- `apps/backend-template/src/modules/ddd/valueObjects/EmailValueObject.ts`
- `apps/backend-template/src/modules/ddd/valueObjects/DocumentValueObject.ts`
- `apps/backend-template/src/modules/ddd/valueObjects/PhoneValueObject.ts`
- `apps/backend-template/src/modules/ddd/valueObjects/AddressValueObject.ts`
- `apps/backend-template/src/modules/ddd/valueObjects/EEmailType.ts`
- `apps/backend-template/src/modules/ddd/valueObjects/EDocumentType.ts`
- `apps/backend-template/src/modules/ddd/valueObjects/EAddressType.ts`

---

## `DocumentValueObject`

### Intenção
Representa uma carga útil de documento do usuário com atributos imutáveis e normalizados e invariantes em nível de construtor.

### Carga útil do construtor
`IDocumentValueObjectPayload`:

| Campo | Tipo | Obrigatório | Normalização | Validação |
|---|---|---|---|---|
| `id` | `string` | Não | Análise UUID se fornecida, gerada se ausente | Análise/geração de UUID |
| `tipo` | `EDocumentType \| string` | Sim | aparado; suporta valores enum e alias `'PASSPORT'` | deve ser um entre `CPF`, `RG`, `SSN`, `passaporte` |
| `paísIssue` | `string` | Sim | aparado + maiúsculo | não deve estar vazio |
| `dados` | `string` | Sim | aparado | não deve estar vazio |

### Semântica comportamental
- Atributos imutáveis (`readonly`).
- Normalização em nível de construtor + validação invariante centralizam a consistência do objeto de valor.

### Nota DDD
Este projeto mantém um `id` técnico para operações de atualização/exclusão de lista de documentos. O valor comercial ainda depende de `type/countryIssue/data` normalizado.

---

## `EmailValueObject`

| Campo | Tipo | Obrigatório | Normalização | Validação |
|---|---|---|---|---|
| `id` | `string` | Não | Análise/geração de UUID | Análise/geração de UUID |
| `e-mail` | `string` | Sim | nenhum | `canNotBeEmpty('email')` |
| `tipo` | `EEmailType` | Sim | nenhum | `canNotBeEmpty('tipo')` |
| `isPrimário` | `booleano` | Não | coerção com `!!isPrimary` | o padrão é `falso` |

---

## `PhoneValueObject`

| Campo | Tipo | Obrigatório | Normalização | Validação |
|---|---|---|---|---|
| `id` | `string` | Não | Análise/geração de UUID | Análise/geração de UUID |
| `códigodopaís` | `string` | Sim | nenhum | `canNotBeEmpty('countryCode')` |
| `localCode` | `string` | Sim | nenhum | `canNotBeEmpty('localCode')` |
| `número` | `string` | Sim | nenhum | `canNotBeEmpty('número')` |
| `isPrimário` | `booleano` | Não | coerção com `!!isPrimary` | o padrão é `falso` |

---

## `AddressValueObject`

| Campo | Tipo | Obrigatório | Normalização | Validação |
|---|---|---|---|---|
| `id` | `string` | Não | Análise/geração de UUID | Análise/geração de UUID |
| `e-mail` | `string` | Sim | nenhum | `canNotBeEmpty('email')` |
| `tipo` | `EAddressType` | Sim | nenhum | deve ser `trabalho`, `casa`, `férias` |
| `isPrimário` | `booleano` | Não | coerção com `!!isPrimary` | o padrão é `falso` |

## Notas de alinhamento OpenAPI
- O OpenAPI modela `countryCode` e `localCode` como strings, de acordo com o objeto de valor do domínio.
- O OpenAPI aceita os tipos de documento do domínio `CPF`, `RG`, `SSN` e `passport`.
- O OpenAPI aceita `countryIssue` como string não vazia; o domínio normaliza o valor para maiúsculas.
- O nome do campo `AddressValueObject.email` é preservado pelos requisitos do projeto e atualmente carrega a semântica da string de carga útil do endereço.
