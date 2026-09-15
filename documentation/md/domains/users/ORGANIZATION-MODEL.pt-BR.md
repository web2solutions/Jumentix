<!--
Arquivo gerado automaticamente a partir de: documentation/md/domains/users/ORGANIZATION-MODEL.md
Idioma alvo: Português (Brasil)
-->
# Modelo de Domínio de Usuários (`Organização`)

## Objetivo
`Organização` é o agregado do locatário no domínio Usuários. Ele modela a identidade da organização, os canais de comunicação e as referências de associação aos usuários.

## Fonte da verdade
- `apps/backend-template/src/modules/Users/domain/Model/Organization.ts`
- `apps/backend-template/src/modules/Users/domain/Entity/IOrganization.ts`
- `apps/backend-template/src/modules/Users/service/OrganizationService.ts`

## Construção
O construtor aceita `RequestCreateOrganization` + metadados opcionais.

| Campo | Tipo | Padrão | Regra |
|---|---|---|---|
| `id` | `string` (UUID) | gerado por `BaseModel` quando ausente | Analisado/normalizado por `UUID.parse` quando fornecido. |
| `criadoEm` | `Data` | gerado automaticamente | Gerado automaticamente quando a entidade é criada. |
| `atualizadoEm` | `Data` | gerado automaticamente | Gerado automaticamente na criação e atualizado automaticamente pelo adaptador de persistência nas atualizações. |
| `nome` | `string` | nenhum | Obrigatório, `canNotBeEmpty`. |
| `endereço` | `AddressValueObject[]` | `[]` | Cada entrada mapeada para `AddressValueObject`. |
| `telefone` | `PhoneValueObject[]` | `[]` | Cada entrada mapeada para `PhoneValueObject`. |
| `e-mail` | `EmailValueObject[]` | `[]` | Cada entrada mapeada para `EmailValueObject`. |
| `usuários` | `string[]` | `[]` | Referências a IDs de usuários na organização. |
| `somente leitura` | `booleano` | `falso` | Bloqueia setters mutáveis ​​quando habilitado. |

## Relacionamentos

- Os metadados `@hasMany('User')` são declarados para `userEntities` para suportar o mapeamento de relação em nível de adaptador enquanto preserva o contrato de domínio com `users: string[]`. O alvo da relação é referenciado pelo nome da entidade, mantendo `User` e `Organization` desacoplados (sem import circular entre os dois models).

## Invariantes agregados

- `nome` não pode estar vazio.
- As matrizes de objetos de valor devem conter objetos de valor válidos.
- A carga útil do modelo e os metadados do esquema são validados por meio de auxiliares de conformidade OpenAPI 3.1 do `BaseModel`.
- Matrizes de objetos de domínio sofrem mutação apenas por meio de métodos explícitos:
  - `createAddress`, `updateAddress`, `deleteAddress`
  - `createPhone`, `updatePhone`, `deletePhone`
  - `createEmail`, `updateEmail`, `deleteEmail`

## Semântica de locação

- `Organização` é o limite principal do locatário para as funções `admin` e `user`.
- As operações do ciclo de vida do usuário sincronizam as referências de associação da organização na camada de serviço.
