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
4. Crie a branch exclusiva da tarefa com prefixo de natureza.
5. Implemente com um PR dedicado tendo `dev` como destino e vinculado à issue e ao projeto.
6. Promova `dev` para `main` somente por meio de um PR de promoção de release após a aprovação da matriz completa.
7. Mova o status do projeto (`Backlog` -> `Pronto` -> `Em andamento` -> `Em revisão` -> `Concluído`).

## Política de Ciclo e Estimativa

1. Padrão da janela do ciclo: 14 dias (`Data de início` / `Data de término` nos campos do projeto).
2. Toda tarefa ativa deve ter:
   - `Prioridade`
   - `Estimativa` (pontos da história)
   - datas do ciclo
3. Máximo de pontos de história por item de tarefa: **8**.
4. Qualquer item acima de 8 pontos deverá ser dividido em subtarefas.
5. As subtarefas herdam a prioridade e o ciclo pai.
