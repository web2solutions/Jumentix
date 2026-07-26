<!--
Arquivo gerado automaticamente a partir de: documentation/md/SPEC-GOVERNANCE-AND-TRACEABILITY.md
Idioma alvo: Português (Brasil)
-->
# Governança e rastreabilidade de especificações

O desenvolvimento de especificações orientado no Jumentix é aplicado por meio de governança de projetos e links auditáveis.

## Fonte Única da Verdade

Fonte da verdade sobre governança:

- Projeto GitHub Jumentix: `https://github.com/users/web2solutions/projects/1`

Registros de governança obrigatórios:

1. Problema do GitHub (item de trabalho)
2. Item de projeto com campos de planejamento
3. RP com questão e evidências vinculadas
4. Artefatos de especificações e documentação
5. Registro no Agent Registry em `.agents/AGENT-REGISTRY.md`

## Links de rastreabilidade obrigatórios

Cada item de entrega deve expor:

1. `Problema -> Item do projeto`
2. `Problema -> Arquivos de especificações alterados`
3. `PR -> Problema`
4. `PR -> Evidência (testes/cobertura/verificações)`
5. `PR -> IDs de requisitos` (quando NFR ou comportamento de governança são afetados)

## Campos obrigatórios do projeto

- `Estado`
- `Prioridade`
- `Tamanho`
- `Estimativa`
- `Data de início`
- `Data de término`

## Requisitos de governança de relações públicas

Cada PR deve conter:

1. Resumo do escopo vinculado à intenção do problema
2. Lista de arquivos de especificações alterada
3. Critérios de aceitação e evidências
4. Cobertura e resultados de entrada
5. Notas de risco/reversão quando necessário

Política de agrupamento prioritário:

- Os trabalhos `P0`, `P1` e `P2` não devem ser misturados no mesmo PR, a menos que sejam explicitamente aprovados como exceção.

## CI e aplicação da qualidade como governança

A conformidade com as especificações é imposta pela política executável:

- Verificações de limites de arquitetura
- Verificações do ciclo de importação
- Verificações de resolução de rota de contrato
- Verificações de limite de cobertura
- Verificações de fumaça de segurança/conformidade

Se alguma porta falhar, a conformidade com as especificações será considerada não comprovada e a alteração não estará pronta para mesclagem.

## NFR e rastreabilidade de requisitos

Quando o comportamento afeta requisitos não funcionais:

1. Adicione ou atualize o arquivo de requisitos em `.agents/requirements/`
2. Atualize o índice `.agents/README.md`
3. Atualize `.agents/NFR-REGISTRY.md`
4. ID(s) de requisitos de referência no contexto de PR

## Suporte oficial a agentes de IA

O Jumentix oferece suporte oficial aos seguintes agentes de engenharia:

1. Codex (`AGENTS.md`)
2. Claude Code (`CLAUDE.md`)
3. Grok (`GROK.md`)

As instruções desses agentes devem permanecer equivalentes para governança, rastreabilidade, sincronização de documentação e gates de CI/cobertura.

## Agent Registry e sincronização de branches

Antes de qualquer execução de tarefa:

1. O agente atuante deve estar registrado em `.agents/AGENT-REGISTRY.md`.
2. O planejamento deve atribuir tarefas apenas para agentes com status `available`.
3. O agente deve checar os refs mais recentes de `main` e `dev` e atualizar os campos de verificação no registro.
4. As entradas do registro devem incluir identidade da máquina (`machine_id`, `machine_name`, `machine_os`) e identidade de runtime (`agent_runtime`, `agent_version`) para permitir múltiplos agentes no mesmo host com rastreabilidade completa.
5. Os agentes devem seguir o playbook operacional (Requisito `081`) cobrindo registro, sincronização de branches, execução governada e evidências de fechamento.

## Expectativas de evidências de auditoria

Conjunto mínimo de evidências:

1. Problema vinculado + item do projeto
2. Arquivos de especificações e documentos alterados
3. Saída CI verde para portas necessárias
4. Limite de cumprimento da evidência de cobertura
5. Atualizações de registro de requisitos (se o NFR for afetado)
