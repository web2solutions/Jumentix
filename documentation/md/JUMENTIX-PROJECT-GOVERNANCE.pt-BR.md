<!--
Arquivo gerado automaticamente a partir de: documentation/md/JUMENTIX-PROJECT-GOVERNANCE.md
Idioma alvo: Português (Brasil)
-->
# Governança do Projeto Jumentix

Este projeto usa o Linear como a única fonte de verdade para rastreamento de execução. Issues,
Projects e pull requests do GitHub fornecem evidência de entrega, mas não substituem os dados
atuais do Linear.

## Regras de Fonte Única da Verdade

1. Cada bug, recurso, refatoração e tarefa técnica executada por humanos ou IA deve existir como uma Issue do Linear.
2. Cada épico deve existir como um Project do Linear e cada tarefa deve estar vinculada ao seu Project focado.
3. Os campos do projeto são obrigatórios para itens ativos:
   - `Estado`
   - `Prioridade`
   - `Tamanho`
   - `Estimativa`
   - `Data de início`
   - `Data de término`
   - `Milestone`
4. Nenhum trabalho começa sem um problema e item de projeto vinculados.
5. As atualizações do progresso das tarefas devem ocorrer no status do item do projeto, não apenas nas notas locais.
6. Todas as tarefas executadas devem manter os metadados de governança atualizados (status, prioridade, estimativas, ciclo/iteração, datas de início/término, rótulos, responsável, links PR/commit).

## Ciclo de vida de metadados de planejamento

1. Cada Issue do Linear usada como tarefa e cada Project do Linear usado como épico/projeto deve
   ter status, prioridade, data de início, data-alvo/término, rótulos, milestone e responsável.
2. Campos nativos do Linear são autoritativos. Quando um campo não estiver disponível, registre um
   fallback estruturado no Linear e repita-o na atualização inicial do Project.
3. Cada item possui exatamente um rótulo de natureza principal; rótulos suplementares não podem
   conflitar com ele.
4. Datas de início não podem ser posteriores às datas-alvo. Datas de tarefa e Project devem caber
   nas janelas do Project pai e do milestone compartilhado.
5. Agentes revalidam os metadados antes de aceitação/delegação, criação de branch, revisão,
   handoff, merge e conclusão.
6. Alterações materiais de status, prioridade, data ou rótulo são registradas em Project Updates
   com valores antigo e novo, motivo e impacto de entrega.
7. Metadados ausentes, obsoletos, contraditórios, inválidos, provisórios ou não auditáveis bloqueiam
   execução, revisão, merge, handoff e conclusão.

## Épicos focados e natureza das tarefas

1. Todo épico ativo pertence a exatamente um milestone aberto no GitHub.
2. Toda tarefa executável pertence a exatamente um épico focado por meio de parentagem
   estruturada no Linear e usa o mesmo milestone desse épico.
3. Milestones definem um alvo de entrega e uma data limite. As datas do épico e das tarefas
   permanecem dentro desse prazo.
4. Cada épico representa um único resultado coeso e não pode funcionar como backlog genérico.
5. Cada tarefa filha tem exatamente uma natureza principal: `feature`, `bug`, `security`,
   `governance`, `docs`, `refactor`, `test`, `ci`, `release` ou `chore`.
6. As tarefas são agrupadas por natureza dentro do épico. Naturezas de suporte diferentes usam
   tarefas filhas separadas, vinculadas ao mesmo resultado.
7. Trabalho que cruza resultados não relacionados é dividido entre épicos focados.
8. O milestone é validado antes que a delegação de agentes seja estabelecida no nível do épico.
9. Somente agentes delegados a um épico podem executar suas tarefas filhas, com um agente
   responsável e escopo não sobreposto por tarefa.
10. O Agent Registry canônico registra `active_epic` e `assigned_task` de cada agente executor.
11. Um milestone só é encerrado quando seus épicos estiverem concluídos ou o trabalho restante
    possuir transferência auditável para outro milestone.

## Governança de RP

Cada PR deve incluir:

- Link(s) de problemas relacionados
- Link do épico pai focado
- Milestone associado
- Contexto do item do projeto relacionado (Projeto: `Jumentix`)
- Critérios de aceitação e evidências de validação
- Cobertura e evidências de qualidade
- Nome da branch exclusiva da tarefa e título do PR com prefixo de natureza
- Branches de origem e destino, comprovando que o PR da tarefa tem `dev` como destino
- Resultados da matriz completa de testes para os limites de commit, push e PR
- Evidência de prevenção de falso positivo, incluindo propagação real de falhas

Se um PR não estiver vinculado aos itens de trabalho do projeto, ele estará fora de processo.

### Política de branch e PR exclusivos da tarefa (obrigatória)

1. Cada tarefa deve ter sua própria branch e seu próprio PR.
2. Uma branch ou PR não pode combinar tarefas rastreadas separadamente.
3. Branches do Codex usam `codex/<natureza>/<id-da-issue>-<slug-curto>`.
4. Títulos de PR usam `[<Natureza>] <resultado conciso>`.
5. As naturezas permitidas são `feature`, `fix`, `security`, `governance`, `docs`, `refactor`, `test`, `ci`, `release` e `chore`.
6. A natureza declarada pela branch e pelo título do PR deve coincidir.
7. Toda exceção deve ser explicitamente aprovada e registrada na issue e no PR vinculados.
8. Todo PR de tarefa deve ter `dev` como branch de destino.
9. Somente um PR de promoção de release cuja branch de origem seja `dev` pode ter `main` como destino.
10. Um PR de promoção de `dev` para `main` não introduz mudanças não revisadas e referencia os PRs de tarefas e issues já integrados em `dev`.
11. Pushes diretos, merges ou PRs de tarefa/tópico para `main` são proibidos.
12. Cada commit, push e PR deve executar a matriz completa de testes declarada pelo repositório.
13. Células obrigatórias ausentes, ignoradas, vazias, canceladas, expiradas, abortadas ou não reportadas reprovam o gate.
14. Falhas de teste e de descoberta devem propagar status diferente de zero; fallbacks de falso positivo são proibidos.

### Evidência do Agent Registry canônico

1. O repositório independente do Agent Registry e sua branch `main` continuam sendo a fonte de
   verdade para coordenação.
2. Cada espelho consumidor registra a revisão imutável do commit canônico que o originou.
3. O comando de sincronização resolve a `main` canônica e atualiza o espelho e a revisão em
   conjunto.
4. Os gates de commit, push e PR comparam o espelho com sua revisão imutável registrada, mantendo
   o resultado reproduzível quando outro agente atualiza a `main` canônica durante a execução.
<<<<<<< HEAD
=======
5. A leitura da revisão imutável usa o endpoint raw do GitHub fixado por SHA, sem consumir a cota
   anônima da API de conteúdo.
6. Somente a sincronização explícita resolve uma branch pela API do GitHub; quando disponível, ela
   pode usar `GITHUB_TOKEN` ou `GH_TOKEN`.
7. SHA inválido, caminho inseguro, erro HTTP, falha de transporte, resposta inválida ou divergência
   entre o conteúdo canônico e o espelho local reprovam o gate sem expor credenciais.
>>>>>>> origin/dev

## Governança de Documentação

1. Cada tarefa executada deve atualizar documentos de software, documentos de produto e documentos de especificações quando afetada.
2. A documentação deve ser mantida em sincronia com as mudanças de implementação e governança.
3. A documentação deverá apresentar versões em inglês e português.
4. O conteúdo e a navegação do site Jumentix deverão disponibilizar versões em inglês e português.
5. No Linear, um épico é um Project e uma tarefa executável é uma Issue.
6. Todo Project de épico deve conter uma Issue dedicada de documentação cujo único resultado sob
   responsabilidade seja sincronizar toda a documentação afetada.
7. Um Project de épico não pode ser marcado como `Completed` até que sua Issue dedicada de
   documentação esteja concluída e vincule o PR, os commits, a documentação alterada e as
   evidências de validação.
8. Uma Issue de documentação ausente, cancelada, sem responsável ou incompleta bloqueia a
   conclusão do épico.

### Agrupamento de relações públicas baseado em prioridade (obrigatório)

Os PRs devem ser criados por grupo prioritário:

1. Tarefas `P0` em PR(s) dedicado(s) contendo apenas itens `P0`.
2. Tarefas `P1` em PR(s) dedicado(s) contendo apenas itens `P1`.
3. Tarefas `P2` em PR(s) dedicado(s) contendo apenas itens `P2`.

Não é permitido misturar `P0`, `P1` e `P2` no mesmo PR.

## Backlog e fluxo de entrega

1. Criar/triagem de problema.
2. Criar ou selecionar um milestone aberto.
3. Criar ou selecionar o épico pai focado, associá-lo ao milestone e estabelecer a parentagem
   estruturada.
4. Vincular a Issue do Linear ao seu Project focado e atribuir o milestone compartilhado.
5. Definir natureza, valores dos campos e datas do ciclo dentro da data limite do milestone.
6. Validar status, prioridade, datas, rótulos e responsável da tarefa e do Project.
7. Delegar agentes disponíveis ao épico e então atribuir suas tarefas filhas não sobrepostas.
8. Criar a branch exclusiva da tarefa com prefixo de natureza.
9. Implementar com um PR dedicado tendo `dev` como destino e vinculado ao milestone, ao épico,
   à issue e ao projeto.
10. Promover `dev` para `main` somente por meio de um PR de promoção de release após a aprovação
   da matriz completa.
11. Verificar que a Issue dedicada de documentação e suas evidências estão concluídas.
12. Mover o status do projeto (`Backlog` -> `Pronto` -> `Em andamento` -> `Em revisão` ->
   `Concluído`) somente quando o estado real e todos os metadados obrigatórios concordarem.

## Política de Ciclo e Estimativa

1. Padrão da janela do ciclo: 14 dias (`Data de início` / `Data de término` nos campos do projeto).
2. Toda tarefa ativa deve ter:
   - `Prioridade`
   - `Estimativa` (pontos da história)
   - datas do ciclo
3. Máximo de pontos de história por item de tarefa: **8**.
4. Qualquer item acima de 8 pontos deverá ser dividido em subtarefas.
5. As subtarefas herdam a prioridade e o ciclo pai.
