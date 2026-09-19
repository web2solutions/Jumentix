<!--
Arquivo gerado automaticamente a partir de: documentation/md/DOMAIN-DESIGNER-MVP-ROADMAP.md
Idioma alvo: Português (Brasil)
-->
# Roteiro MVP do Designer de Domínio

Este documento centraliza o status e as prioridades do Domain Designer MVP.

Fonte canônica do backlog:

- Workspace Linear: <https://linear.app/jumentix>

## Incrementos de MVP entregues

- Tela de domínio visual com blocos de domínio codificados por cores
- Ciclo de vida da entidade (`criar`, `renomear`, `excluir`, `duplicar`, `mover`)
- Ciclo de vida do relacionamento com modo pick-on-canvas
- Ajudantes de produtividade no relacionamento:
  - nomenclatura inteligente
  - geração automática de FK para links cardinais
  - Geração automática de junção N:N
  - ação reversa de relacionamento
  - opção de estilo de roteamento (`curvo` / `ortogonal`)
- Editor de campo compatível com OpenAPI com metadados de restrições
- Modelos de campo (`tenantRef`, `auditTrail`, `softDelete`, `contactPack`)
- Linha de base de exportação/importação JSON + OpenAPI
- Melhorias na experiência do usuário do Canvas:
  - panorâmica/zoom/ajuste/redefinir
  - modo compacto
  - encaixe na grade
  - toque no teclado
  - desfazer/refazer
- Verificações de modelo com foco em problemas acionáveis
- Visualização do endpoint CRUD no inspetor de entidade
- Conectores de relacionamento de arrastar e soltar baseados em âncora
- Editor de metadados de contexto limitado por domínio
- Controles de posicionamento de etiqueta de relacionamento (editor de deslocamento + redefinição)
- Controles avançados de caminho de relacionamento (pontos de curvatura + comportamento de âncora)
- Editor raiz agregado e invariante
- Diferença de esquema e visualização de migração
- Níveis de severidade de validação e porta de qualidade de exportação
- Editor de mapeamento RBAC por entidade/ação
- Designer de contratos de eventos/mensagens vinculados a entidades
- Painel de visualização de geração de código
- Modelos de entidade e pacotes de scaffolding (`crudAggregate`, `eventSourced`, `referenceData`, `tenantOwned`)
- Exportadores conectáveis (JSON, OAS 3.1, Markdown, JSON Schema, AsyncAPI, pacote Boilerplate)
- Construtor avançado de composição OpenAPI (`oneOf`, `allOf`, `anyOf`, `$ref` externo, discriminador)
- Suporte a pacotes de modelos colaborativos (importação/exportação de pacotes de domínio, dependências, objetos de valor compartilhado)
- Gerador de exemplo de solicitação/resposta do esquema da entidade
- Minimapa visual e modo de desempenho em tela grande
- Cobertura inicial de e2e/smoke para fluxos de trabalho do Domain Designer

## Próximas prioridades do MVP

- Roteiro de MVP concluído.

## Melhorias pós-MVP

- Versionamento colaborativo de pacotes e resolução de conflitos de dependência semântica

## Documentação e regras de governança

- Todo recurso do Domain Designer deve ser atualizado:
  - `apps/service-management/README.md`
  - este roteiro (quando o escopo ou a prioridade mudam)
  - links relevantes de índice README/documento
- Cada item MVP recém-identificado deve ser adicionado ao rastreamento do backlog antes ou junto com a implementação.
