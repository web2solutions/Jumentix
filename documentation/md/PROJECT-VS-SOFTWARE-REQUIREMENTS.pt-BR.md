# Requisitos de Projeto vs Requisitos de Software

Os requisitos do Jumentix estão divididos em dois namespaces para que os contribuidores possam identificar rapidamente se uma regra governa *como trabalhamos* (projeto) ou *o que o produto faz* (software).

## Namespaces de requisitos

| Namespace | Localização | Escopo |
|---|---|---|
| **Projeto / Governança** | `.agents/requirements/project/` | Processo, planejamento, política de branch/PR, operações de agentes, workflow Linear/GitHub, processo de documentação, procedimento de compliance. |
| **Software / Produto** | `.agents/requirements/software/` | Arquitetura, runtime, persistência, adapters, APIs, contratos, comportamento do código, mecânica de testes. |

## Por que a separação importa

- **Clareza**: um novo engenheiro pode ler apenas os requisitos de software para entender o produto, e apenas os requisitos de projeto para entender como entregar mudanças.
- **Rastreabilidade**: as verificações de cobertura e rastreabilidade podem reportar separadamente comportamento do produto vs governança de entrega.
- **Evolução**: mudanças no processo de entrega não se misturam com mudanças no comportamento do produto na mesma árvore de arquivos, facilitando diffs e revisões.

## Como decidir onde um novo requisito pertence

Pergunte: *se este requisito fosse removido, o produto ainda construiria e se comportaria da mesma forma?*

- **Sim** — é um requisito de **projeto** (governa entrega, não comportamento).
- **Não** — é um requisito de **software** (governa comportamento do produto).

### Exemplos

| Requisito | Namespace | Motivo |
|---|---|---|
| `001` Node 22 runtime | `software` | Define o runtime usado pelo produto. |
| `015` DDD + EDA + Arquitetura Hexagonal | `software` | Define a arquitetura do produto. |
| `065` Integridade de commit/push | `project` | Define como contribuidores devem usar git hooks e gates de CI. |
| `081` Playbook de registro de agentes | `project` | Define como agentes de IA devem se registrar e operar. |
| `105` Pirâmide de testes hexagonal | `software` | Define como as camadas de teste do produto são organizadas. |
| `114`–`119` Pacote operacional de agentes | `project` | Define worktree, testes, Docker e orquestração API-first para agentes. |

## Nomenclatura de arquivos

Os arquivos mantêm seu prefixo de ID de três dígitos e slug estáveis. O namespace é codificado apenas pelo diretório pai:

```text
.agents/requirements/project/081-agent-registration-and-operating-playbook.md
.agents/requirements/software/015-architecture-nfr-ddd-eda-hexagonal.md
```

## IDs duplicados históricos

Três IDs (`055`, `060`, `079`) tinham anteriormente dois arquivos independentemente vinculantes cada. Eles foram resolvidos renumerando os arquivos secundários:

| ID antigo | Arquivo antigo | Novo ID | Novo arquivo |
|---|---|---|---|
| `055` | `055-wave5-app-rehoming-cutover-governance.md` | `120` | `project/120-wave5-app-rehoming-cutover-governance.md` |
| `060` | `060-monorepo-root-layout-governance.md` | `121` | `project/121-monorepo-root-layout-governance.md` |
| `079` | `079-task-owned-branch-and-pr-naming-governance.md` | `122` | `project/122-task-owned-branch-and-pr-naming-governance.md` |

## Documentos relacionados

- [Índice de requisitos (projeto + software)](../../.agents/README.md)
- [NFR Registry](../../.agents/NFR-REGISTRY.md)
- [Razão de rastreabilidade de requisitos](SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.md)
- [Status de cobertura de requisitos](SPEC-REQUIREMENTS-COVERAGE-STATUS.md)
- [Versão em inglês](PROJECT-VS-SOFTWARE-REQUIREMENTS.md)
