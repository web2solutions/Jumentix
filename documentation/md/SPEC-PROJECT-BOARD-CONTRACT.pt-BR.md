<!--
Arquivo gerado automaticamente a partir de: documentation/md/SPEC-PROJECT-BOARD-CONTRACT.md
Idioma alvo: Português (Brasil)
-->
# Contrato de diretoria do projeto de especificações (Projeto Linear Jumentix)

Este documento define como o quadro do projeto Linear faz parte da execução orientada ao desenvolvimento de especificações.

## Quadro de Projeto Canônico

- Diretoria: [Projeto Linear - Jumentix](https://linear.app/jumentix)
- Proprietário: `web2solutions`
- Escopo do repositório: `web2solutions/Jumentix`
- A chave da API do Linear fica em `../.linear`, um nível acima da raiz do projeto. Agentes podem
  lê-la para autenticação, mas nunca devem expô-la, registrá-la ou commitá-la.

## Campos obrigatórios de planejamento

Cada item deve manter:

1. `Status`
2. `Prioridade`
3. `Tamanho`
4. `Estimativa`
5. `Data de início`
6. `Data de término`
7. `Iteração` (quando disponível no planejamento de ciclo)
8. `Milestone`

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
2. Todo épico ativo deve estar associado a exatamente um milestone aberto no Linear.
3. O épico e todas as tarefas filhas usam o mesmo milestone, salvo exceção explícita registrada.
4. O milestone define alvo de entrega, descrição, data limite e estado do ciclo de vida.
5. As datas finais do épico e das tarefas não podem ultrapassar a data limite do milestone sem
   replanejamento formal.
6. Um milestone pode conter múltiplos épicos focados somente quando atendem ao mesmo alvo de
   entrega.
7. O épico deve descrever um único resultado coeso e não pode ser um backlog genérico.
8. A parentagem deve usar a associação da tarefa ao Project do Linear e os campos de
   parent/sub-issue do Linear quando disponíveis.
9. A associação ao milestone deve usar os metadados de milestone da Issue e do Project no Linear.
10. As tarefas são agrupadas por natureza principal dentro do épico. Trabalho de suporte com
   natureza diferente é rastreado como tarefa filha separada sob o mesmo resultado coeso.
11. O planejamento do épico define milestone, prioridade, limites de escopo, datas, estimativa,
    responsável e delegação de agentes.
12. Tarefas filhas mantêm estimativas independentes de no máximo oito pontos, responsáveis,
   branches, commits, pull requests e evidências.
13. Um épico só é concluído quando todas as tarefas filhas obrigatórias e suas evidências estão
   completas.
14. Um milestone só é encerrado depois que seus épicos forem concluídos ou o trabalho incompleto
    for formalmente transferido para outro milestone aberto.

## Contrato de delegação de agentes

1. O milestone e as datas de entrega do épico são validados antes da delegação de agentes.
2. A delegação de agentes é decidida e registrada no nível do épico antes da atribuição de
   tarefas filhas.
3. Somente agentes delegados a um épico podem aceitar suas tarefas filhas.
4. Cada tarefa filha possui um agente responsável; múltiplos agentes devem atuar em limites de
   tarefas não sobrepostos.
5. Issues e Projects/Epics no Linear identificam o `agent_identifier` ativo para cada escopo
   executável, sincronizado com o Agent Registry canônico.
6. O Agent Registry canônico registra `active_epic`, `assigned_task` e contexto de coordenação
   quando trabalho de agentes irmãos puder se sobrepor.
7. Trabalho entre épicos exige delegação explícita e tarefas filhas separadas para cada épico.

## Fluxo de trabalho baseado em especificações através do conselho

1. Ingestão:
   - criar ou selecionar um milestone aberto e um épico focado e então criar uma issue filha com
     objetivo e critérios de aceitação claros.
2. Planejamento:
   - atribuir milestone, épico pai, natureza principal, prioridade, tamanho, estimativa, datas e
     rótulos;
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
3. milestone associado
4. escopo do Project focado no Linear
5. Project Update obrigatório
6. recursos de especificação alterados
7. resumo de evidências (testes/cobertura/segurança)

E cada questão deve refletir:

1. URL(s) de relações públicas
2. status de mesclagem/fechamento
3. itens residuais de acompanhamento (se houver)

## Regra anti-deriva

Se os instantâneos de tarefas locais e o quadro do projeto divergirem, o quadro do projeto será a fonte da verdade e os documentos locais deverão ser sincronizados no mesmo ciclo.
