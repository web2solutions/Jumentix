<!--
Arquivo gerado automaticamente a partir de: documentation/md/SPEC-LIFECYCLE-AND-WORKFLOW.md
Idioma alvo: Português (Brasil)
-->
# Ciclo de vida e fluxo de trabalho de especificações

Este ciclo de vida é obrigatório para entrega do Jumentix.

## Fase 1 - Ingestão

Entradas:

- Intenção comercial (recurso, correção de bug, refatoração, conformidade)
- Escopo e risco
- Domínios/interfaces/tempos de execução afetados

Saídas necessárias:

1. Problema do GitHub criado
2. Problema adicionado ao Linear Project Jumentix
3. Campos do projeto preenchidos (`Status`, `Prioridade`, `Tamanho`, `Estimativa`, `Data de início`, `Data de término`)
4. Critérios iniciais de aceitação

## Fase 2 - Elaboração de especificações

Crie ou atualize artefatos de especificação antes da codificação:

- Especificações do contrato (OpenAPI/AsyncAPI)
- Nota sobre o impacto da arquitetura (se os limites, o fluxo ou as dependências mudarem)
- Atualizações de contratos de domínio/dados (entidades, modelos, objetos de valor)
- Referências de governança e NFR (IDs de requisitos afetados)

Saídas necessárias:

1. Lista de alterações de especificações documentada
2. Lista de rastreabilidade (`problema -> arquivos de especificações`)
3. Notas de risco e compatibilidade

## Fase 3 - Validação do Projeto

Valide o design das especificações em relação aos princípios básicos:

- DDD + orientado a eventos + limites hexagonais
- Ordem de chamada de camada
- Sem reintrodução de dependência circular
- Comportamento da interface que prioriza o contrato
- Requisitos de segurança e locação

Saídas necessárias:

1. Declaração de impacto limite
2. Declaração de compatibilidade (tempo de execução/adaptadores/SDKs)
3. Estratégia de teste alinhada ao risco de mudança

## Fase 4 - Implementação

Codifique apenas o que a especificação aprovada exige.  
Não expanda o escopo sem atualizar as especificações.

Regras de implementação:

1. Mantenha as alterações orientadas por recursos e locais de camada.
2. Reutilize contratos estabelecidos e abstrações de pacotes.
3. Para alterações de comportamento do adaptador, mantenha os padrões nativos do tempo de execução.
4. Mantenha a sincronização de documentos/especificações no mesmo ciclo de entrega.

## Fase 5 - Verificação

Evidência de verificação obrigatória:

1. Verificações de lint e arquitetura
2. Unidade/integração/cobertura de fumaça para mudança de comportamento
3. Verificações de resolução de contrato (`oas:check-routes`, mapeamentos assíncronos quando relevante)
4. Verificações de segurança e conformidade
5. Porta limite de cobertura de patch

Saídas necessárias:

- Evidência de CI mostrando que os cheques são verdes
- Política de limite de cumprimento de evidências de cobertura

## Fase 6 - Encerramento da Governança

Antes de mesclar:

1. O PR vincula a Issue do Linear, o Project focado, o milestone e o Project Update obrigatório
2. PR inclui artefatos de especificações alterados
3. PR inclui evidências de critérios de aceitação
4. A Issue do Linear permanece no estado verdadeiro de revisão até o merge e então passa para
   `Done`
5. Os documentos de requisitos/NFR são atualizados quando o comportamento não é funcional

## Definição de Concluído (orientado por especificações)

Uma mudança é feita somente quando todas são verdadeiras:

1. A intenção comercial é representada por uma Issue do Linear rastreada em seu Project focado.
2. As especificações são atualizadas e versionadas.
3. O código corresponde às especificações atualizadas.
4. Testes e portões de qualidade são aprovados.
5. Documentação e registros de agentes são sincronizados.
6. A rastreabilidade da Issue e do Project Update no Linear até o PR e os arquivos de
   especificação é explícita.

