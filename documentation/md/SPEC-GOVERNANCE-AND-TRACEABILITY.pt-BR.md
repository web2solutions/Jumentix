<!--
Arquivo gerado automaticamente a partir de: documentation/md/SPEC-GOVERNANCE-AND-TRACEABILITY.md
Idioma alvo: Português (Brasil)
-->
# Governança e rastreabilidade de especificações

O desenvolvimento de especificações orientado no Jumentix é aplicado por meio de governança de projetos e links auditáveis.

## Fonte Única da Verdade

Fonte da verdade sobre governança:

- Issues e Projects do Linear
- A chave da API do Linear fica em `../.linear`, um nível acima da raiz do projeto. Agentes podem
  lê-la para autenticação, mas nunca devem expô-la, registrá-la, compartilhá-la ou commitá-la.

Registros de governança obrigatórios:

1. Issue do Linear (item de trabalho)
2. Project do Linear (épico focado) com campos de planejamento
3. RP com questão e evidências vinculadas
4. Artefatos de especificações e documentação
5. Registro canônico de agentes em `XpertMinds/jumentix-agent-registry` com espelho local em `.agents/AGENT-REGISTRY.md`

## Links de rastreabilidade obrigatórios

Cada item de entrega deve expor:

1. `Milestone -> épico focado`
2. `Épico focado -> tarefa filha`
3. `Épico focado -> agente delegado`
4. `Issue do Linear -> Project focado no Linear`
5. `Issue -> arquivos de especificações alterados`
6. `PR -> issue`
7. `PR -> evidência (testes/cobertura/verificações)`
8. `PR -> IDs de requisitos` (quando NFR ou comportamento de governança são afetados)
9. `Tarefa -> branch dedicada -> PR dedicado`
10. `Project de épico no Linear -> Issue dedicada de documentação -> evidências de PR/commit/documentação`
11. `Tarefa/Project -> metadados de planejamento atuais -> histórico de Project Updates`

## Gate de conclusão da documentação do épico

1. No Linear, um épico é um Project e suas tarefas executáveis são Issues.
2. Todo Project de épico deve conter uma Issue dedicada de documentação.
3. O Project não pode ser marcado como `Completed` antes que essa Issue esteja concluída.
4. A evidência de conclusão deve vincular a Issue de documentação, seu PR e commits exclusivos,
   o inventário da documentação alterada, a paridade bilíngue quando aplicável e a validação de
   integridade.
5. Trabalho de documentação ausente, cancelado, sem responsável ou incompleto bloqueia a
   conclusão do épico.

## Campos obrigatórios do projeto

- `Estado`
- `Prioridade`
- `Tamanho`
- `Estimativa`
- `Data de início`
- `Data de término`
- `Parent issue`
- `Milestone`
- um rótulo de natureza principal
- agente responsável ou líder do Project

Os campos obrigatórios permanecem atuais durante toda a entrega. Quando o Linear não expõe um
campo nativo obrigatório para uma entidade, seu fallback estruturado no Linear e o Project Update
inicial são autoritativos até que um campo nativo ou personalizado esteja disponível.

## Ciclo de vida de metadados de planejamento

1. Agentes validam status, prioridade, datas, rótulos, milestone e responsável da tarefa e do
   Project antes da aceitação ou delegação.
2. Datas de início não podem ser posteriores às datas-alvo/fim; datas da tarefa cabem no Project
   pai e milestone compartilhado, e datas do Project cabem no milestone.
3. Status reflete o estágio real. Prioridade reflete impacto, urgência, risco, dependências e
   sequenciamento atuais.
4. Cada item possui exatamente um rótulo de natureza principal; rótulos suplementares não podem
   contradizê-lo.
5. Alterações materiais de metadados entram no próximo Project Update com valores anterior e novo,
   motivo e impacto na entrega.
6. Agentes revalidam metadados na criação da branch, prontidão para revisão, handoff, merge e
   conclusão.
7. Metadados ausentes, obsoletos, contraditórios, inválidos, provisórios ou não auditáveis
   reprovam a governança de forma fechada e bloqueiam a progressão.

## Planejamento e delegação orientados por épico

1. Todo épico ativo possui exatamente um milestone aberto com alvo e data limite de entrega.
2. Toda tarefa executável possui exatamente um épico pai focado e herda seu milestone.
3. As datas finais do épico e das tarefas permanecem dentro da data limite do milestone.
4. Cada tarefa possui uma natureza principal e é agrupada com tarefas da mesma natureza dentro
   do épico.
5. Trabalho de suporte com natureza diferente é representado por tarefa filha separada sob o
   mesmo épico coeso.
6. A validade do milestone é verificada antes da delegação de agentes no nível do épico.
7. Somente agentes delegados a um épico podem executar suas tarefas.
8. Cada tarefa possui um agente responsável e agentes paralelos atuam em escopos não sobrepostos.
9. O Agent Registry canônico registra `active_epic` e `assigned_task`.
10. Um milestone só fecha depois que seus épicos forem concluídos ou o trabalho restante for
    formalmente transferido.

## Requisitos de governança de relações públicas

Cada PR deve conter:

1. Resumo do escopo vinculado à intenção do problema
2. Vínculo com o milestone, o Project pai focado, a Issue filha e o Project Update no Linear
3. Lista de arquivos de especificações alterada
4. Critérios de aceitação e evidências
5. Cobertura e resultados de entrada
6. Notas de risco/reversão quando necessário
7. Nome da branch exclusiva da tarefa e título do PR prefixado pela Issue do Linear e pela natureza
8. Evidência das branches de origem e destino
9. Formatação markdown limpa com quebra de linhas reais; não usar tokens literais `\n` no corpo do PR.

Política de isolamento e nomenclatura:

- Uma tarefa corresponde exatamente a uma branch de entrega e a um PR.
- Formato de branch do Codex: `codex/<natureza>/<id-da-issue>-<slug-curto>`.
- Formato do título do PR: `[JUM-XXXX][<Natureza>] <resultado conciso>`; o identificador deve
  coincidir com a branch e com a única Issue do Linear vinculada.
- Naturezas permitidas: `feature`, `fix`, `security`, `governance`, `docs`, `refactor`, `test`, `ci`, `release`, `chore`.
- Compartilhar uma branch ou PR entre tarefas rastreadas separadamente exige exceção explícita registrada na issue e no PR.
- Todo PR de tarefa tem `dev` como destino.
- Somente um PR de promoção de release originado em `dev` pode ter `main` como destino.
- Uma promoção de `dev` para `main` referencia os PRs de tarefa e Issues do Linear já
  representados em `dev` e não introduz mudanças adicionais de tarefa.
- PRs diretos de tarefa/tópico, pushes e merges para `main` são proibidos.
- Os gates são orientados ao destino: branches de tarefa executam testes alterados ou
  relacionados, `dev` executa a suíte unitária completa e `main` executa a matriz completa.
- PRs destinados a `dev` executam a suíte unitária; promoções de `dev` para `main` executam a
  matriz completa.
- A evidência da matriz de `main` deve listar cada célula obrigatória e seu resultado terminal.
- Uma matriz de `main` incompleta é evidência com falha; nunca pode ser interpretada como verde.
- Review de PR é opcional. Branch protection e rulesets não devem exigir quantidade de
  aprovações.
- Isolamento da tarefa, promoção primeiro para `dev`, resolução de conversas e todos os
  requisitos de CI, cobertura, segurança, governança e matriz completa apropriados ao destino
  permanecem obrigatórios e terminalmente verdes.

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

Contrato de execução por branch:

1. Branches de tarefa executam `ci:gate:task` sobre o diff pertencente à tarefa.
2. `dev` e pull requests destinados a `dev` executam `test:unit`.
3. `main` e pull requests de promoção destinados a `main` executam `ci:gate:strict`.
4. O CircleCI aceita somente `dev` e `main`.
5. `.github/workflows/website.yml` é o responsável pelos checks do Storybook e é selecionado
   somente por caminhos pertencentes ao website; o workflow global e a matriz completa não
   executam Storybook.
6. Todo gate selecionado emite evidência auditável e falha de forma fechada quando um comando
   não retorna status, quebra ou termina com código diferente de zero.

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
4. OpenCode (`OPENCODE.md`)

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
8. O milestone do épico e da tarefa deve ser validado antes do planejamento ou execução sob o
   Requisito `090`.
9. Os agentes devem verificar a Issue dedicada de documentação antes de concluir um Project de
   épico no Linear sob o Requisito `094`.
10. As verificações fixadas do registro devem buscar conteúdo imutável por SHA completo de
    commit e caminho seguro codificado. Registros públicos usam conteúdo raw sem cota anônima da
    API de conteúdo; quando houver token, o acesso autenticado pela Contents API pode ser usado
    e deve fazer fallback para raw público em HTTP 401/403/404 nesse caminho com token.
11. Somente a sincronização explícita do registro pode resolver uma branch mutável pela API do
    GitHub, opcionalmente autenticada por `GITHUB_TOKEN` ou `GH_TOKEN`.
12. Revisões ou caminhos inválidos, falhas HTTP e de transporte, respostas malformadas, acesso
    não autorizado e divergência do espelho local devem reprovar de forma fechada com diagnósticos
    acionáveis que nunca exponham credenciais (raw 404 após Contents 401/403 → orientação de
    token; demais 404 → deriva de pin/caminho; 401/403 isolado → acesso privado com token).
13. O repositório canônico do Agent Registry é privado na organização `XpertMinds`. Somente a
    conta proprietária `web2solutions` (`web2solucoes@gmail.com`) e identidades explicitamente
    autorizadas no Linear podem ler, fazer push ou publicar nele.
14. O Requisito `103` torna `XpertMinds/Jumentix` e
    `XpertMinds/jumentix-agent-registry` canônicos. As duas origens anteriores em
    `web2solutions` estão obsoletas, são somente leitura, não aceitam novas modificações e
    permanecem arquivadas.
15. O Requisito `104` exige inventário e rebind de toda integração aplicável da origem
    depreciada para `XpertMinds/Jumentix`, com instalações incompletas registradas como
    bloqueios owner-auth e validadas por `integration-migration:check`.

## Expectativas de evidências de auditoria

Conjunto mínimo de evidências:

1. Milestone + Project focado + Issue filha + Project Update obrigatório vinculados no Linear
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
12. Testes de transporte do Agent Registry cobrindo construção da URL raw imutável, codificação
   segura do caminho, autenticação opcional da resolução de branch, falhas de transporte e
   divergência do espelho
13. Status, prioridade, datas, rótulos, responsável, alinhamento de milestone e histórico de
    Project Updates atuais da tarefa/Project
