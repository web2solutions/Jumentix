<!--
Arquivo gerado automaticamente a partir de: documentation/md/SPEC-ARCHITECTURE-CODING-STANDARDS.md
Idioma alvo: Português (Brasil)
-->
# Arquitetura de especificações e padrões de codificação

Este documento vincula a execução orientada ao desenvolvimento de especificações à arquitetura e aos padrões de engenharia Jumentix.

## Princípios de Arquitetura (Não negociáveis)

1. Design baseado em domínio
2. Design orientado a eventos
3. Arquitetura Hexagonal
4. Entrega baseada em recursos com propagação mínima de camadas
5. Interfaces que priorizam o contrato (OpenAPI/AsyncAPI + contratos de mensagens)

## Modelo de camada

Fluxo necessário:

`Handler -> Controller -> Application Use Case -> Domain -> Repository Port -> Adapter`

Padrões proibidos:

- Controlador orquestrando diretamente a infra
- Lógica específica do adaptador vazando no núcleo do domínio/aplicativo
- Importações circulares entre módulos principais

## Padrões de domínio e dados

1. Os modelos de domínio impõem invariantes.
2. Os objetos de valor são explícitos e validados.
3. As entidades de dados mantêm os campos de ciclo de vida obrigatórios (`createdAt`, `updatedAt`) quando obrigatórios.
4. O comportamento do modelo deve permanecer alinhado com as restrições do OpenAPI 3.1 para tipos, formatos e validações.

## Padrões de contrato

1. Cada operação de endpoint deve ser resolvida para um método manipulador + controlador real.
2. Os objetos de porta para entrada/saída devem ser descritos em contratos OpenAPI.
3. Canais/eventos em tempo real devem estar alinhados com contratos AsyncAPI e manipuladores de tempo de execução.
4. Os contratos de eventos e erros devem ser documentados e rastreáveis.

## Padrões de tempo de execução e adaptador

1. A seleção do adaptador de tempo de execução é orientada pelo ambiente.
2. Cada implementação de interface deve usar semântica de tempo de execução nativa para sua estrutura/protocolo.
3. Adaptadores compartilhados/genéricos devem evoluir para pacotes de espaço de trabalho distribuíveis.
4. A política de orquestração de processos PM2 se aplica a ambientes estilo VM.

## Padrões de segurança e conformidade

1. O escopo do locatário e a aplicação do RBAC são responsabilidades do domínio/aplicativo.
2. Os campos sensíveis não devem ultrapassar os limites do serviço.
3. Política de exposição a erros:
   - detalhado em dev/staging
   - mascarado na produção
4. Portões de segurança e testes de fumaça de conformidade são obrigatórios no CI.

## Padrões de codificação

1. Preservar os padrões de base de código existentes antes de introduzir novas abstrações.
2. Prefira APIs/analisadores estruturados em vez de análise de string ad-hoc.
3. Mantenha o escopo dos refatoradores de acordo com o comportamento solicitado e os limites relacionados.
4. Combine a profundidade do teste com o risco:
   - mudança restrita -> testes focados
   - mudança compartilhada/entre módulos -> cobertura de teste mais ampla

## Padrões de Documentação

1. Cada recurso/mudança deve incluir atualizações de documentos.
2. Qualquer contrato ou mudança de comportamento deve atualizar os arquivos de especificações relevantes.
3. As alterações que impactam o NFR devem atualizar `.agents/requirements` e o registro NFR.
4. A documentação deve incluir detalhes operacionais suficientes para reutilização de engenharia.


