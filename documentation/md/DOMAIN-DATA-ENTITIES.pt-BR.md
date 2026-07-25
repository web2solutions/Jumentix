<!--
Arquivo gerado automaticamente a partir de: documentation/md/DOMAIN-DATA-ENTITIES.md
Idioma alvo: Português (Brasil)
-->
# Entidades de dados de domínio

Este documento define entidades de dados por domínio com detalhes em nível de campo:

- nome do campo
- tipo de dados
- formato esperado
- expectativas de validação
- fonte da verdade (modelo de domínio vs contrato OpenAPI)

Arquivos detalhados por domínio:

- `documentação/md/domínios/usuários/USER-MODEL.md`
- `documentação/md/domínios/usuários/USER-ENTITY-CONTRACT.md`
- `documentação/md/domínios/usuários/USER-VALUE-OBJECTS.md`
- `documentação/md/domínios/usuários/ORGANIZATION-MODEL.md`

## Domínio: Usuários

### Entidade: `Usuário`

Referências de código:

- `apps/backend-template/src/modules/Users/domain/Model/User.ts`
- `apps/backend-template/src/modules/Users/domain/Entity/IUser.ts`
- `spec/1.0.0.yml` (`componentes.schemas.User`)

| Campo | Tipo (TS) | Formato/Valores permitidos | Obrigatório | Validação esperada |
|---|---|---|---|---|
| `id` | `string` | Sequência UUID | Ler modelo | Gerado por `BaseModel` (`UUID.create/parse`). |
| `primeiroNome` | `string` | texto livre, comprimento mínimo 2 na OEA | Criar/Ler | Domínio: `canNotBeEmpty`. OEA: `minLength: 2`. |
| `sobrenome` | `string` | texto livre, anulável na OEA | Opcional | O domínio aceita o padrão de string vazia. |
| `avatar` | `string` | string semelhante a arquivo/caminho | Opcional | Domínio: `canNotBeEmpty` quando definido. Padrão: `avatar.png`. |
| `nome de usuário` | `string` | formato de e-mail na OEA, comprimento mínimo 8 | Criar/Ler | Domínio: `canNotBeEmpty`. OEA: `formato: email`, `minLength: 8`. |
| `senha` | `string` | formato de senha na OEA | Criar/Leitura (higienizado nas respostas de serviço) | O domínio armazena hash. O serviço impõe `mustBePassword` nos caminhos de criação/atualização de senha. |
| `sal` | `string` | texto livre (interno) | Interno | Sal criptográfico interno. Nunca deve vazar na resposta externa. |
| `e-mails` | `EmailValueObject[]` | veja `EmailValueObject` | Criar/Ler | OEA para criação requer no mínimo 1 item. O domínio é criado via `createEmail`. |
| `documentos` | `DocumentValueObject[]` | veja `DocumentValueObject` | Opcional | Gerenciado via `create/update/deleteDocument`. |
| `telefones` | `PhoneValueObject[]` | veja `PhoneValueObject` | Opcional | Gerenciado via `create/update/deletePhone`. |
| `funções` | `string[]` | lesmas de papel | Opcional/Criar/Ler | Usado por verificações de autorização de autenticação. |
| `organização` | `string` | Sequência UUID | Opcional para `superadmin`; necessário para `admin`/`user` | A regra de locação RBAC do domínio impõe a organização necessária para funções de locatário. |
| `criadoEm` | `Data` (`string serializada`) | data-hora | Ler modelo | Gerenciado por `BaseModel` (gerado automaticamente na criação). |
| `atualizadoEm` | `Data` (`string serializada`) | data-hora | Ler modelo | Gerenciado por `BaseModel` + camada de persistência (atualizado automaticamente em caso de alterações). |
| `_readOnly` | `booleano` (interno) | `verdadeiro/falso` | Interno | Se for verdade, os setters mutantes são lançados via `throwIfReadOnly`. |
| `_ativo` | `booleano` (interno) | `verdadeiro/falso` | Interno | Padrão verdadeiro. |

### Objeto de valor: `EmailValueObject`

Referências de código:

- `apps/backend-template/src/modules/ddd/valueObjects/EmailValueObject.ts`
- `spec/1.0.0.yml` (`components.schemas.Email`, `RequestCreateEmail`, `RequestUpdateEmail`)

| Campo | Tipo (TS) | Formato/Valores permitidos | Obrigatório | Validação esperada |
|---|---|---|---|---|
| `id` | `string` | Sequência UUID | Ler/Atualizar | Gerado automaticamente se não for fornecido. |
| `e-mail` | `string` | texto semelhante a e-mail (a OEA não impõe formato) | Criar | Domínio: `canNotBeEmpty('email')`. |
| `tipo` | `EEmailType` | `trabalhar` \| `pessoal` | Criar | Domínio: `canNotBeEmpty('type')`. Enum da OAS aplicada no limite da API. |
| `isPrimário` | `booleano` | `verdadeiro/falso` | Opcional | O padrão é `falso`. |

### Objeto de valor: `DocumentValueObject`

Referências de código:

- `apps/backend-template/src/modules/ddd/valueObjects/DocumentValueObject.ts`
- `apps/backend-template/src/modules/ddd/valueObjects/EDocumentType.ts`
- `spec/1.0.0.yml` (`components.schemas.Document`, `RequestCreateDocument`, `RequestUpdateDocument`)

| Campo | Tipo (TS) | Formato/Valores permitidos | Obrigatório | Validação esperada |
|---|---|---|---|---|
| `id` | `string` | Sequência UUID | Ler/Atualizar | Gerado automaticamente se não for fornecido. |
| `tipo` | `EDocumentType` | `CPF` \| `RG` \| `SSN` \| `passaporte` (enumeração de domínio) | Criar | Domínio: obrigatório + normalizado + validação de enumeração estrita (o alias `PASSPORT` é mapeado para `passaporte`). |
| `paísIssue` | `string` | valor do código do país (`BR`, `US`, etc.) | Criar | Domínio: obrigatório + aparado + maiúsculo. |
| `dados` | `string` | string de carga útil do documento | Criar | Domínio: obrigatório + cortado. |

### Objeto de valor: `PhoneValueObject`

Referências de código:

- `apps/backend-template/src/modules/ddd/valueObjects/PhoneValueObject.ts`
- `spec/1.0.0.yml` (`components.schemas.Phone`, `RequestCreatePhone`, `RequestUpdatePhone`)

| Campo | Tipo (TS) | Formato/Valores permitidos | Obrigatório | Validação esperada |
|---|---|---|---|---|
| `id` | `string` | Sequência UUID | Ler/Atualizar | Gerado automaticamente se não for fornecido. |
| `códigodopaís` | `string` no modelo de domínio | indicativo do país | Criar | Domínio: `canNotBeEmpty('countryCode')`. A OAS atualmente define número inteiro. |
| `localCode` | `string` no modelo de domínio | código de discagem de área/local | Criar | Domínio: `canNotBeEmpty('localCode')`. A OAS atualmente define número inteiro. |
| `número` | `string` | número de assinante | Criar | Domínio: `canNotBeEmpty('número')`. |
| `isPrimário` | `booleano` | `verdadeiro/falso` | Opcional | O padrão é `falso`. |

### Objeto de valor: `AddressValueObject`

Referências de código:

- `apps/backend-template/src/modules/ddd/valueObjects/AddressValueObject.ts`
- `apps/backend-template/src/modules/ddd/valueObjects/EAddressType.ts`
- `spec/1.0.0.yml` (`componentes.schemas.Address`)

| Campo | Tipo (TS) | Formato/Valores permitidos | Obrigatório | Validação esperada |
|---|---|---|---|---|
| `id` | `string` | Sequência UUID | Ler/Atualizar | Gerado automaticamente se não for fornecido. |
| `e-mail` | `string` | string de carga útil da linha de endereço (nome do campo do projeto preservado conforme solicitado) | Criar | Domínio: `canNotBeEmpty('email')`. |
| `tipo` | `EAddressType` | `trabalhar` \| `casa` \| `férias` | Criar | Validação de enum de domínio no construtor. |
| `isPrimário` | `booleano` | `verdadeiro/falso` | Opcional | O padrão é `falso`. |

### Entidade: `Organização`

Referências de código:

- `apps/backend-template/src/modules/Users/domain/Model/Organization.ts`
- `apps/backend-template/src/modules/Users/domain/Entity/IOrganization.ts`
- `spec/1.0.0.yml` (`components.schemas.Organization`)

| Campo | Tipo (TS) | Formato/Valores permitidos | Obrigatório | Validação esperada |
|---|---|---|---|---|
| `id` | `string` | Sequência UUID | Ler modelo | Gerado por `BaseModel`. |
| `criadoEm` | `Data` (`string serializada`) | data-hora | Ler modelo | Gerenciado por `BaseModel` (gerado automaticamente na criação). |
| `atualizadoEm` | `Data` (`string serializada`) | data-hora | Ler modelo | Gerenciado por `BaseModel` + camada de persistência (atualizado automaticamente em caso de alterações). |
| `nome` | `string` | texto livre | Criar/Ler | Domínio: `canNotBeEmpty('nome')`. |
| `endereço` | `AddressValueObject[]` | veja `AddressValueObject` | Opcional | O construtor mapeia cada item para o objeto de valor. |
| `telefone` | `PhoneValueObject[]` | veja `PhoneValueObject` | Opcional | O construtor mapeia cada item para o objeto de valor. |
| `e-mail` | `EmailValueObject[]` | veja `EmailValueObject` | Opcional | O construtor mapeia cada item para o objeto de valor. |
| `usuários` | `string[]` | IDs de usuário (lista UUID) | Opcional | Gerenciado pela sincronização de serviço entre usuário e organização. |
| `createAddress / updateAddress / deleteAddress` | métodos | N/A | Comportamento | API de mutação de domínio explícita para objetos de valor `address`. |
| `createPhone / updatePhone / deletePhone` | métodos | N/A | Comportamento | API de mutação de domínio explícita para objetos de valor `phone`. |
| `createEmail / updateEmail / deleteEmail` | métodos | N/A | Comportamento | API de mutação de domínio explícita para objetos de valor `email`. |

## Regras de validação de domínio (entre entidades)

Validadores compartilhados em `apps/backend-template/src/shared/validators/index.ts` aplicam regras usadas em entidades/casos de uso:

- `canNotBeEmpty`
- `throwIfReadOnly`
- `mustBePassword`
- `throwIfPreUpdateValidationFails`
- `throwIfNotFound`

## Notas sobre diferenças entre contrato e tipo de domínio

Alguns campos passam intencionalmente pelos tipos de limites da API e são normalizados em construtores de domínio. Diferenças atuais conhecidas:

- `Phone.countryCode` e `Phone.localCode` são `inteiros` no OpenAPI, mas são armazenados como `string` no objeto de valor de domínio.
- `Document.type` inclui `passport` no domínio enum, mas os esquemas de documentos OpenAPI listam apenas `CPF`, `RG`, `SSN`.
- `AddressValueObject.email` atualmente armazena a carga útil do endereço de acordo com a nomenclatura do contrato solicitada.

Ao alterar esses contratos, atualize ambos:

1. Definições de tipo de entidade de domínio/objeto de valor
2. Esquemas OpenAPI (`spec/1.0.0.yml`)
3. testes cobrindo caminhos de criação/atualização
