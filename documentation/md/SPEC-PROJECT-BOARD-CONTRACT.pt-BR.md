<!--
Arquivo gerado automaticamente a partir de: documentation/md/SPEC-PROJECT-BOARD-CONTRACT.md
Idioma alvo: Português (Brasil)
-->
# Contrato de diretoria do projeto de especificações (Projeto GitHub Jumentix)

Este documento define como o quadro do projeto GitHub faz parte da execução orientada ao desenvolvimento de especificações.

## Quadro de Projeto Canônico

- Diretoria: [Projeto GitHub - Jumentix](https://github.com/users/web2solutions/projects/1)
- Proprietário: `web2solutions`
- Escopo do repositório: `web2solutions/aaa-typescript-boilerplate`

Linha de base do instantâneo (24/07/2026):

1. O projeto está ativo (`closed: false`).
2. Os campos de governança estão disponíveis e são obrigatórios (`19` campos configurados).
3. Os itens de trabalho são gerenciados como itens de projeto apoiados por problemas (a escala atual no histórico do conselho já está acima do estágio inicial de MVP).

## Campos obrigatórios de planejamento

Cada item deve manter:

1. `Status`
2. `Prioridade`
3. `Tamanho`
4. `Estimativa`
5. `Data de início`
6. `Data de término`
7. `Iteração` (quando disponível no planejamento de ciclo)

## Rótulos necessários para a natureza da tarefa

Cada tarefa executável deve ter exatamente um rótulo de natureza principal:

1. `feature`
2. `bug`
3. `security`
4. `governance`
5. `docs`
6. `refactor`
7. `test`
8. `ci`
9. `release`
10. `chore`

Os rótulos de fluxo estratégico são aditivos (por exemplo `todo-mvp`, `epic`, `iteration-a`, `iteration-b`).

## Contrato de épico focado

1. Toda tarefa executável deve pertencer a exatamente um épico focado.
2. O épico deve descrever um único resultado coeso e não pode ser um backlog genérico.
3. A relação de parentagem deve usar sub-issues do GitHub ou o campo `Parent issue` do projeto
   quando disponível.
4. As tarefas são agrupadas por natureza principal dentro do épico. Trabalho de suporte com
   natureza diferente é rastreado como tarefa filha separada sob o mesmo resultado coeso.
5. O planejamento do épico define prioridade, limites de escopo, datas, estimativa, responsável
   e delegação de agentes.
6. Tarefas filhas mantêm estimativas independentes de no máximo oito pontos, responsáveis,
   branches, commits, pull requests e evidências.
7. Um épico só é concluído quando todas as tarefas filhas obrigatórias e suas evidências estão
   completas.

## Contrato de delegação de agentes

1. A delegação de agentes é decidida e registrada no nível do épico antes da atribuição de
   tarefas filhas.
2. Somente agentes delegados a um épico podem aceitar suas tarefas filhas.
3. Cada tarefa filha possui um agente responsável; múltiplos agentes devem atuar em limites de
   tarefas não sobrepostos.
4. O Agent Registry canônico registra `active_epic` e `assigned_task`.
5. Trabalho entre épicos exige delegação explícita e tarefas filhas separadas para cada épico.

## Fluxo de trabalho baseado em especificações através do conselho

1. Ingestão:
   - criar ou selecionar um épico focado e então criar uma issue filha com objetivo e critérios
     de aceitação claros.
2. Planejamento:
   - atribuir épico pai, natureza principal, prioridade, tamanho, estimativa, datas e rótulos;
   - delegar agentes ao épico antes de atribuir tarefas filhas.
3. Elaboração de especificações:
   - liste os recursos de especificações necessários antes da implementação.
4. Entrega:
   - vincular commits/PRs e capturar evidências.
5. Encerramento:
   - definir a tarefa filha como `Concluído` somente após verificações verdes e sincronização de
     documentos/agentes;
   - encerrar o épico somente após todas as tarefas filhas obrigatórias e evidências estarem
     completas.

## Contrato de vinculação de relações públicas

Todo PR deve fazer referência a:

1. questão(ões) relacionada(s)
2. épico pai focado
3. escopo do item do projeto
4. recursos de especificação alterados
5. resumo de evidências (testes/cobertura/segurança)

E cada questão deve refletir:

1. URL(s) de relações públicas
2. status de mesclagem/fechamento
3. itens residuais de acompanhamento (se houver)

## Regra anti-deriva

Se os instantâneos de tarefas locais e o quadro do projeto divergirem, o quadro do projeto será a fonte da verdade e os documentos locais deverão ser sincronizados no mesmo ciclo.
