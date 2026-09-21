<!--
Arquivo gerado automaticamente a partir de: documentation/md/DEVELOPER-AUTOMATION-CLI.md
Idioma alvo: Português (Brasil)
-->
# CLI de automação do desenvolvedor

Este projeto inclui um wrapper CLI voltado para o desenvolvedor para acelerar fluxos de trabalho de configuração de domínio e modelo de dados.

Ele foi projetado para reduzir a estrutura manual e manter as definições de domínio mais próximas da intenção de implementação durante a descoberta inicial de recursos.

## Propósito

A CLI fornece um menu interativo com subaplicativos para:

1. Gerenciar Domínios (CRUD)
2. Gerenciar entidades e modelos de dados (CRUD + gerenciamento de campo)

Isto suporta iteração mais rápida ao criar novos contextos, agregações, entidades e contratos de campo limitados.

## Comandos

Use qualquer um dos seguintes comandos:

```bash
bun run cli
bun run dev:cli
bun run start:cli
```

Todos os comandos iniciam o mesmo ponto de entrada da CLI:

- `apps/backend-template/src/interface/CLI/index.ts`

Geradora de fábrica / bootstrap (workspace enxuto, não clone do monorepo):

```bash
npx @jumentix/cli-init init
# aliases ainda funcionam:
jumentix-bootstrap
bun run cli:bootstrap
```

Superfície normativa de comandos:
[`BOOTSTRAP-CLI-SCAFFOLDING.pt-BR.md`](./BOOTSTRAP-CLI-SCAFFOLDING.pt-BR.md).
Modos da fábrica:
[`JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX.pt-BR.md`](./JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX.pt-BR.md).

O fluxo também é exposto como bins instaláveis:

```bash
jumentix
jumentix-init
jumentix-bootstrap
```

## Subaplicativos atuais

### 1) Domínios CRUD

Operações:

- Listar domínios
- Pesquisar domínios
- Criar domínio
- Atualizar domínio
- Excluir domínio

A definição de domínio inclui:

- `id`
- `nome`
- `descrição`
- `boundedContext`
- `status` (`rascunho | ativo | obsoleto`)
- `etiquetas`
- `criadoEm`
- `atualizadoEm`

### 2) Entidades de dados e modelos CRUD

Operações:

- Listar entidades/modelos
- Pesquisar entidades/modelos
- Criar entidade/modelo
- Atualizar entidade/modelo
- Excluir entidade/modelo
- Gerenciar campos

Capacidades do gerenciador de campo:

- Listar campos para a entidade/modelo selecionado
- Visualize informações detalhadas do campo (nome, tipo, obrigatório, formato, padrão, validações, comportamento)
- Adicionar novos campos
- Atualizar definição completa do campo
- Edite apenas comportamento/notas de campo para um campo selecionado
- Excluir campos

Comportamento de conformidade com OpenAPI 3.1:

- A seleção do campo `type` é restrita aos tipos de esquema primitivo/de dados OpenAPI 3.1 suportados pelo projeto:
  - `string`
  - `número`
  - `inteiro`
  - `booleano`
  - `matriz`
  - `objeto`
- As opções de `formato` dos campos são apresentadas de acordo com o tipo selecionado.
- As palavras-chave de validação são apresentadas de acordo com o tipo selecionado.
- Conjuntos de campos de entidade novos e atualizados são validados antes da persistência.
- Combinações de esquema inválidas são rejeitadas pelo fluxo CLI.

A definição de entidade/modelo inclui:

- `id`
- `nome`
- `domínio`
- `tipo` (`entidade | objetodevalor | agregado | modelo`)
- `descrição`
- `campos`
- `comportamentos`
- `criadoEm`
- `atualizadoEm`

A definição do campo inclui:

- `nome`
- `tipo`
- `obrigatório`
- `formato`
- `valorpadrão`
- `validações`
- `comportamento`

## Regras de esquema OpenAPI 3.1 no código

Auxiliares e registros de validação central:

- `apps/backend-template/src/shared/openapi/OpenApi31DataEntity.ts`

Aplicação do modelo de domínio:

- `apps/backend-template/src/modules/port/BaseModel.ts`
  - `throwIfFieldSchemaIsNotOpenApi31Compliant(...)`
  - `throwIfDataEntitySchemaIsNotOpenApi31Compliant(...)`

Exemplo de esquema de domínio implementado:

- `apps/backend-template/src/modules/Users/domain/Model/User.ts`
  - `dataEntitySchema` estático

## Persistência

Os dados CLI são persistidos em:

- `.aaa-cli/workspace-catalog.json`

O arquivo é gerenciado por:

- `apps/backend-template/src/interface/CLI/core/catalogStorage.ts`

## Notas arquitetônicas

- A CLI é uma ferramenta de desenvolvedor e não substitui a implementação de casos de uso de domínio.
- Ajuda a capturar metadados estruturados para evolução de domínio/entidade.
- Pode ser estendido com subaplicativos adicionais para cenários de automação.

## Qualidade

O comportamento da CLI é abordado por testes de unidade em:

- `apps/backend-template/test/unit/interface/CLI/`

Isso garante que os novos recursos e fluxos da CLI permaneçam estáveis ​​e em conformidade com a cobertura.

## IU de gerenciamento de serviços relacionados

A superfície de design visual mudou para:

- `aplicativos/gerenciamento de serviço/`

Ver:

- `documentation/md/SERVICE-MANAGEMENT-APPLICATION.md`
