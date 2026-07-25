<!--
Arquivo gerado automaticamente a partir de: documentation/md/domains/users/USER-MODEL.md
Idioma alvo: Português (Brasil)
-->
# Modelo de Domínio de Usuários (`Usuário`)

## Objetivo
`User` é a raiz agregada do domínio Usuários. Ele encapsula identidade, dados de perfil, credenciais, funções, vinculação de organização de locatário e objetos de valor filho (`emails`, `documentos`, `telefones`) e é responsável por impor regras de mutação.

## Fonte da verdade
- `apps/backend-template/src/modules/Users/domain/Model/User.ts`
- `apps/backend-template/src/modules/Users/domain/Entity/IUser.ts`
- `apps/backend-template/src/modules/port/BaseModel.ts`

## Construção
O construtor aceita `UserFactory` (tipo interno que estende `RequestCreateUser`) e aplica padrões:

| Campo | Tipo | Padrão | Regra |
|---|---|---|---|
| `id` | `string` (UUID) | gerado por `BaseModel` quando ausente | Analisado/normalizado por `UUID.parse` quando fornecido. |
| `criadoEm` | `Data` | gerado automaticamente | Gerado automaticamente quando a entidade é criada. |
| `atualizadoEm` | `Data` | gerado automaticamente | Gerado automaticamente na criação e atualizado automaticamente pelo adaptador de persistência nas atualizações. |
| `primeiroNome` | `string` | nenhum | Obrigatório, `canNotBeEmpty`. |
| `sobrenome` | `string` | `''` | Opcional. |
| `avatar` | `string` | `'avatar.png'` | Não deve estar vazio quando definido. |
| `nome de usuário` | `string` | nenhum | Obrigatório, `canNotBeEmpty`. |
| `organização` | `string` (UUID) | `''` | Opcional para `superadmin`, obrigatório para `admin` e `user`. |
| `senha` | `string` | `''` | Armazenado como hash por camada de serviço. |
| `sal` | `string` | `''` | Sal criptográfico interno. |
| `e-mails` | `EmailValueObject[]` | `[]` | Adicionado via `createEmail`. |
| `documentos` | `DocumentValueObject[]` | `[]` | Adicionado via `createDocument`. |
| `telefones` | `PhoneValueObject[]` | `[]` | Adicionado via `createPhone`. |
| `funções` | `string[]` | `[]` | Somente leitura após a construção. |
| `somente leitura` | `booleano` | `falso` | Bloqueia todos os setters/métodos mutantes quando `true`. |
| `ativo` | `booleano` | `verdadeiro` | Sinalizador de atividade interna. |

## Métodos de comportamento

### Mutação de perfil/credencial
- `firstName`, `lastName`, `avatar`, `username`, `password`, `salt` setters.
- Todos os setters impõem `throwIfReadOnly` quando agregado é somente leitura.

### Mutação de objeto aninhado
- `createPhone`, `updatePhone`, `deletePhone`
- `createDocument`, `updateDocument`, `deleteDocument`
- `createEmail`, `updateEmail`, `deleteEmail`

Cada operação `update*` substitui o item de destino por uma nova instância de objeto de valor (`new ...ValueObject({...old, ...payload})`) para manter as regras aninhadas centralizadas em construtores de objetos de valor.

## Leia o acesso ao modelo
Getters expõem arrays copiados:
- `funções`
- `e-mails`
- `documentos`
- `telefones`

Isso evita a mutação externa direta da matriz.

## Invariantes agregados
- O modo somente leitura evita qualquer mutação (`throwIfReadOnly`).
- Os campos obrigatórios de identidade do usuário (`firstName`, `username`) não podem estar vazios.
- Entidades aninhadas devem passar por suas próprias validações de objetos de valor no momento da criação/atualização.
- Invariante de locação RBAC: as funções `admin` e `user` exigem que `organização` esteja presente.
- O modelo de domínio não expõe preocupações de serviço (HTTP, persistência, adaptadores de infraestrutura).
