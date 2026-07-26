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
5. Registro canônico de agentes em `web2solutions/jumentix-agent-registry` com espelho local em `.agents/AGENT-REGISTRY.md`

## Links de rastreabilidade obrigatórios

Cada item de entrega deve expor:

1. `Épico focado -> tarefa filha`
2. `Épico focado -> agente delegado`
3. `Issue -> item do projeto`
4. `Issue -> arquivos de especificações alterados`
5. `PR -> issue`
6. `PR -> evidência (testes/cobertura/verificações)`
7. `PR -> IDs de requisitos` (quando NFR ou comportamento de governança são afetados)
8. `Tarefa -> branch dedicada -> PR dedicado`

## Campos obrigatórios do projeto

- `Estado`
- `Prioridade`
- `Tamanho`
- `Estimativa`
- `Data de início`
- `Data de término`
- `Parent issue`
- um rótulo de natureza principal

## Planejamento e delegação orientados por épico

1. Toda tarefa executável possui exatamente um épico pai focado.
2. Cada tarefa possui uma natureza principal e é agrupada com tarefas da mesma natureza dentro
   do épico.
3. Trabalho de suporte com natureza diferente é representado por tarefa filha separada sob o
   mesmo épico coeso.
4. A delegação de agentes é registrada no nível do épico antes da atribuição de tarefas filhas.
5. Somente agentes delegados a um épico podem executar suas tarefas.
6. Cada tarefa possui um agente responsável e agentes paralelos atuam em escopos não sobrepostos.
7. O Agent Registry canônico registra `active_epic` e `assigned_task`.

## Requisitos de governança de relações públicas

Cada PR deve conter:

1. Resumo do escopo vinculado à intenção do problema
2. Vínculo com o épico pai focado e o item do projeto
3. Lista de arquivos de especificações alterada
4. Critérios de aceitação e evidências
5. Cobertura e resultados de entrada
6. Notas de risco/reversão quando necessário
7. Nome da branch exclusiva da tarefa e título do PR com prefixo de natureza correspondente
8. Evidência das branches de origem e destino
9. Formatação markdown limpa com quebra de linhas reais; não usar tokens literais `\n` no corpo do PR.

Política de isolamento e nomenclatura:

- Uma tarefa corresponde exatamente a uma branch de entrega e a um PR.
- Formato de branch do Codex: `codex/<natureza>/<id-da-issue>-<slug-curto>`.
- Formato do título do PR: `[<Natureza>] <resultado conciso>`.
- Naturezas permitidas: `feature`, `fix`, `security`, `governance`, `docs`, `refactor`, `test`, `ci`, `release`, `chore`.
- Compartilhar uma branch ou PR entre tarefas rastreadas separadamente exige exceção explícita registrada na issue e no PR.
- Todo PR de tarefa tem `dev` como destino.
- Somente um PR de promoção de release originado em `dev` pode ter `main` como destino.
- Uma promoção de `dev` para `main` referencia os PRs/issues de tarefas já integrados em `dev` e não introduz mudanças não revisadas.
- PRs diretos de tarefa/tópico, pushes e merges para `main` são proibidos.
- Os gates de commit, push e PR devem executar a matriz completa de testes declarada pelo repositório.
- A evidência da matriz deve listar cada célula obrigatória e seu resultado terminal.
- Uma matriz incompleta é evidência com falha; nunca pode ser interpretada como verde.

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
6. As atualizações canônicas do registro devem ser feitas primeiro no repositório externo e depois espelhadas localmente sob o Requisito `089`.
7. A delegação no nível do épico e a atribuição da tarefa filha devem ser registradas sob o
   Requisito `090`.

## Expectativas de evidências de auditoria

Conjunto mínimo de evidências:

1. Épico focado + issue filha + item do projeto vinculados
2. Delegação do agente no nível do épico e atribuição no nível da tarefa
3. Arquivos de especificações e documentos alterados
4. Saída CI verde para gates obrigatórios
5. Evidência de cobertura atendendo ao limite
6. Atualizações de registro de requisitos (se o NFR for afetado)
7. Evidência de isolamento e nomenclatura da branch/PR da tarefa
8. Proveniência do PR da tarefa para `dev`, ou da promoção de release de `dev` para `main`
9. Evidência do gate por branch para commit, push, merge e PR
10. Manifesto e resultados da matriz completa para promoção a `main`
11. Prova de propagação mostrando que teste obrigatório ausente ou com falha não pode produzir
    resultado verde
