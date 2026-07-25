<!--
Arquivo gerado automaticamente a partir de: documentation/md/domains/users/USER-ENTITY-CONTRACT.md
Idioma alvo: Português (Brasil)
-->
# Contrato de Entidade de Usuários (`IUser`)

## Objetivo
`IUser` define a forma da entidade de domínio usada entre os limites de repositório/serviço/caso de uso para o domínio de Usuários.

## Fonte da verdade
- `apps/backend-template/src/modules/Users/domain/Entity/IUser.ts`

## Campos do contrato

| Campo | Tipo | Obrigatório | Formato/semântica | Proprietário da validação |
|---|---|---|---|---|
| `id` | `string` | Sim | Sequência UUID | Modelo de domínio/BaseModel |
| `criadoEm` | `Data` | Sim | Carimbo de data e hora de criação da entidade | BaseModel/persistência |
| `atualizadoEm` | `Data` | Sim | Carimbo de data e hora da última mutação | BaseModel/persistência |
| `primeiroNome` | `string` | Sim | Texto livre | Modelo de domínio (`canNotBeEmpty`) |
| `sobrenome` | `string` | Sim | Texto livre (pode ser uma string vazia) | Modelo de domínio |
| `avatar` | `string` | Sim | Nome do arquivo/caminho do avatar | Modelo de domínio (`canNotBeEmpty` quando definido) |
| `nome de usuário` | `string` | Sim | Identificador de login | Modelo de domínio (`canNotBeEmpty`), restrições de autenticação/serviço |
| `senha` | `string` | Sim | Hash em repouso | Camadas de serviço/segurança |
| `organização` | `string` | Não (condicional) | UUID da organização | Regra RBAC de domínio (`admin`/`user` requer organização) |
| `e-mails` | `EmailValueObject[]` | Sim | Coleta de e-mails de usuários | `EmailValueObject` |
| `documentos` | `DocumentValueObject[]` | Não | Coleta de documentos do usuário | `DocumentValueObject` |
| `telefones` | `PhoneValueObject[]` | Não | Coleção de telefones de usuários | `PhoneValueObject` |
| `funções` | `string[]` | Sim | Slugs de função de autorização | Camada de autenticação/serviço |

## Notas
- `salt` faz parte interna do modelo `User`, mas intencionalmente não faz parte do contrato `IUser`.
- `organização` permite autorização no escopo do locatário e fluxos de propriedade de dados.
- `documentos` e `telefones` são opcionais no contrato para compatibilidade retroativa com cargas históricas.
- A serialização da API é gerenciada pela higienização da camada de serviço para evitar vazamento de segredos (`senha`, `salt`).
