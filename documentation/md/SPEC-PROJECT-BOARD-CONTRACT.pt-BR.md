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

Pelo menos um rótulo de natureza:

1. `recurso`
2. `bug`
3. `tarefa`
4. `doc`

Os rótulos de fluxo estratégico são aditivos (por exemplo `todo-mvp`, `epic`, `iteration-a`, `iteration-b`).

## Fluxo de trabalho baseado em especificações através do conselho

1. Ingestão:
   - criar problemas com objetivos claros e critérios de aceitação.
2. Planejamento:
   - atribuir prioridade, tamanho, estimativa, datas e rótulos.
3. Elaboração de especificações:
   - liste os recursos de especificações necessários antes da implementação.
4. Entrega:
   - vincular commits/PRs e capturar evidências.
5. Encerramento:
   - defina o status como `Concluído` somente após verificações verdes e sincronização de documentos/agentes.

## Contrato de vinculação de relações públicas

Todo PR deve fazer referência a:

1. questão(ões) relacionada(s)
2. Escopo do item do projeto
3. recursos de especificação alterados
4. resumo de evidências (testes/cobertura/segurança)

E cada questão deve refletir:

1. URL(s) de relações públicas
2. status de mesclagem/fechamento
3. itens residuais de acompanhamento (se houver)

## Regra anti-deriva

Se os instantâneos de tarefas locais e o quadro do projeto divergirem, o quadro do projeto será a fonte da verdade e os documentos locais deverão ser sincronizados no mesmo ciclo.
