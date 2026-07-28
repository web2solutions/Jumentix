<!--
Arquivo gerado automaticamente a partir de: documentation/md/SPEC-DELIVERY-GATES-AND-EVIDENCE.md
Idioma alvo: Português (Brasil)
-->
# Portas de entrega de especificações e evidências

Este documento converte regras orientadas ao desenvolvimento de especificações em portas executáveis ​​e evidências de auditoria.

## Modelo de portão

Todas as entregas da Jumentix passam por cinco tipos de portões.

## Gate 1 - Especificação completa

Critérios de aprovação:

1. Os contratos afetados são atualizados (`OpenAPI`, `AsyncAPI`, mensagens/erros conforme aplicável).
2. Os documentos de domínio/dados afetados são atualizados.
3. Os documentos de tempo de execução/governança afetados são atualizados.

Evidência:

1. A lista de arquivos PR faz referência a arquivos spec/doc.
2. A seção de rastreabilidade mapeia o escopo da mudança para recursos de especificações atualizados.

## Portão 2 - Conformidade da Arquitetura

Critérios de aprovação:

1. Os limites DDD, orientados a eventos e hexagonais são preservados.
2. A ordem de chamada da camada permanece compatível.
3. Não foram introduzidas importações circulares/de acoplamento proibidas.

Evidência:

1. Verificações de arquitetura em CI (scripts de limite/ciclo/espaço de trabalho).
2. Revise as notas para alterações sensíveis aos limites.

## Portão 3 – Verificação Comportamental

Critérios de aprovação:

1. Os testes unitários cobrem a lógica alterada.
2. Os testes de integração cobrem alterações no comportamento da interface.
3. Os testes de fumaça validam os caminhos de tempo de execução quando os adaptadores/infra mudam.

Evidência:

1. Conjuntos de testes verdes em CI.
2. Adicionados testes para novos comportamentos incluídos no escopo PR.

Política de execução:

1. `ci:gate` permanece como a linha de base rápida definida pelo requisito `011`, incluindo o smoke de integração representativo.
2. `ci:gate:strict` é o gate canônico da matriz completa para os limites de commit, push e pull request.
3. Seu manifesto cobre lint, arquitetura, contratos, governança, testes unitários, segurança, smoke, builds, todos os workspaces, a matriz completa de 15 alvos de integração HTTP/Lambda/realtime/Service Management e cobertura do patch.
4. Cada executor da matriz deve rejeitar manifesto vazio, duplicado, malformado ou com script ausente.
5. A execução continua após a falha de uma célula individual e retorna um único resultado agregado diferente de zero listando todas as células com falha.
6. Planos somente de documentação ou outras otimizações por escopo não podem omitir a matriz canônica em um limite de entrega.
7. Os alvos de integração executam com cobertura desabilitada para não sobrescrever o artefato de cobertura dos testes unitários governado pelo requisito `014`.
8. A CI remota publica a evidência JSON por célula gerada por `AAA_CI_MATRIX_RESULT_FILE`.

## Portão 4 – Qualidade e Segurança

Critérios de aprovação:

1. Os limites de cobertura atendem à política.
2. As verificações de segurança/conformidade são verdes.
3. O tratamento de erros/segredos permanece em conformidade com a política.

Evidência:

1. Relatórios de cobertura e registros de portão.
2. Saídas de varredura/verificação de segurança.

## Portão 5 – Rastreabilidade da Governança

Critérios de aprovação:

1. O problema, o item do projeto e o PR estão vinculados.
2. Os campos de prioridade/tamanho/estimativa do ciclo de vida são preenchidos.
3. Referências de requisitos/NFR são incluídas quando aplicável.
4. Todo Project do Linear usado como épico possui uma Issue dedicada de documentação.
5. A Issue de documentação do épico está concluída antes de o Project ser marcado como
   `Completed`.
6. Todo agente executor publica os Project Updates obrigatórios específicos da tarefa no Linear.
7. Toda tarefa concluída possui um Project Update final sem bloqueio não resolvido ou gate
   obrigatório incompleto.

Evidência:

1. Links cruzados de problemas/projetos/RP do GitHub.
2. Registro `.agents` atualizado quando a governança ou NFR mudou.
3. Link do Project do Linear mais a Issue de documentação concluída, links de PR/commit,
   inventário dos documentos alterados, evidência de paridade bilíngue quando aplicável e
   resultados de integridade da documentação.
4. Feed de Project Updates do Linear com tarefa, agente, status, resultado, artefatos de entrega,
   estados exatos dos gates, bloqueios ou riscos e próxima ação.

## Padrão de empacotamento de evidências para PRs

Cada PR deve incluir:

1. Resumo do escopo
2. IDs de requisitos afetados
3. Arquivos de especificações atualizados
4. Resumo de testes/cobertura/evidências de segurança
5. Notas de risco e reversão (para alterações de infra/tempo de execução/dados)

## Política de bloqueio

Um PR não está pronto para mesclagem quando algum destes está faltando:

1. Atualizações de especificações para comportamento alterado.
2. Verificações exigidas ou limite de cobertura.
3. Links de rastreabilidade da governança.
4. Atualizações necessárias de `.agents` para impacto de NFR/governança.
5. Uma Issue dedicada de documentação ausente ou incompleta para um épico em conclusão.
6. Um Project Update obrigatório ausente, desatualizado, enganoso ou incompleto para uma tarefa
   ativa ou concluída.
