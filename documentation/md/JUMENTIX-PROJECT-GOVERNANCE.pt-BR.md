<!--
Arquivo gerado automaticamente a partir de: documentation/md/JUMENTIX-PROJECT-GOVERNANCE.md
Idioma alvo: Português (Brasil)
-->
# Governança do Projeto Jumentix

Este projeto usa o Projeto GitHub **Jumentix** (`https://github.com/users/web2solutions/projects/1`) como a única fonte de verdade para rastreamento de execução.

## Regras de Fonte Única da Verdade

1. Cada bug, recurso, refatoração e tarefa técnica executada por humanos ou IA deve existir como um problema do GitHub.
2. Cada problema rastreado deve ser adicionado ao projeto `Jumentix`.
3. Os campos do projeto são obrigatórios para itens ativos:
   - `Estado`
   - `Prioridade`
   - `Tamanho`
   - `Estimativa`
   - `Data de início`
   - `Data de término`
4. Nenhum trabalho começa sem um problema e item de projeto vinculados.
5. As atualizações do progresso das tarefas devem ocorrer no status do item do projeto, não apenas nas notas locais.
6. Todas as tarefas executadas devem manter os metadados de governança atualizados (status, prioridade, estimativas, ciclo/iteração, datas de início/término, rótulos, responsável, links PR/commit).

## Governança de RP

Cada PR deve incluir:

- Link(s) de problemas relacionados
- Contexto do item do projeto relacionado (Projeto: `Jumentix`)
- Critérios de aceitação e evidências de validação
- Cobertura e evidências de qualidade

Se um PR não estiver vinculado aos itens de trabalho do projeto, ele estará fora de processo.

## Governança de Documentação

1. Cada tarefa executada deve atualizar documentos de software, documentos de produto e documentos de especificações quando afetada.
2. A documentação deve ser mantida em sincronia com as mudanças de implementação e governança.
3. A documentação deverá apresentar versões em inglês e português.
4. O conteúdo e a navegação do site Jumentix deverão disponibilizar versões em inglês e português.

### Agrupamento de relações públicas baseado em prioridade (obrigatório)

Os PRs devem ser criados por grupo prioritário:

1. Tarefas `P0` em PR(s) dedicado(s) contendo apenas itens `P0`.
2. Tarefas `P1` em PR(s) dedicado(s) contendo apenas itens `P1`.
3. Tarefas `P2` em PR(s) dedicado(s) contendo apenas itens `P2`.

Não é permitido misturar `P0`, `P1` e `P2` no mesmo PR.

## Backlog e fluxo de entrega

1. Criar/triagem de problema.
2. Adicione o problema ao projeto `Jumentix`.
3. Defina valores de campo e datas de ciclo.
4. Implementar com PR vinculado ao problema/projeto.
5. Mova o status do projeto (`Backlog` -> `Pronto` -> `Em andamento` -> `Em revisão` -> `Concluído`).

## Política de Ciclo e Estimativa

1. Padrão da janela do ciclo: 14 dias (`Data de início` / `Data de término` nos campos do projeto).
2. Toda tarefa ativa deve ter:
   - `Prioridade`
   - `Estimativa` (pontos da história)
   - datas do ciclo
3. Máximo de pontos de história por item de tarefa: **8**.
4. Qualquer item acima de 8 pontos deverá ser dividido em subtarefas.
5. As subtarefas herdam a prioridade e o ciclo pai.
