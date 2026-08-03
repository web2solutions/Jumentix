<!--
Arquivo gerado automaticamente a partir de: documentation/md/DOMAIN-DESIGNER-FEATURES-AND-USAGE.md
Idioma alvo: Português (Brasil)
-->
# Recursos e uso do designer de domínio

Este documento é o guia técnico para todos os recursos do Domain Designer MVP dentro de:

- `aplicativos/gerenciamento de serviço/`

Abrange o que cada recurso faz e como usá-lo na prática.

## 1) Tela e navegação

Características:

- Retângulos de domínio (codificados por cores)
- Cartões de entidade dentro de domínios
- Panorâmica, zoom, ajuste, redefinição
- Snap-to-grid
- Visualização compacta/completa
- Modo de desempenho em tela grande
- Navegação no minimapa
- Desfazer/refazer

Como usar:

1. Crie domínios e entidades no painel esquerdo.
2. Arraste os cabeçalhos de domínio e de entidade para reposicionar.
3. Uso:
   - `Ctrl/Cmd + roda do mouse` para zoom
   - `Espaço + arrastar` para panorâmica
   - `Fit` e `Reset View` para enquadramento rápido
4. Ative `Large Canvas` para diagramas de alta densidade.
5. Use o minimapa para focar um domínio rapidamente.

## 2) Design de Relacionamento

Características:

- Criação de relacionamento baseado em formulário (`de`, `para`, cardinalidade)
- Modo pick-on-canvas
- Conectores de arrasto âncora a âncora
- Relacionamento reverso
- Geração automática de FK
- Controles de deslocamento de rótulo (`x`, `y`)
- Controles de caminho de curvatura (`bendX`, `bendY`)
- Comportamento da âncora (`auto`, `center`)
- Estilo de roteamento (`curvo`, `ortogonal`)

Como usar:

1. Selecione as entidades de origem e destino e clique em `Conectar`.
2. Ou clique em `Pick On Canvas` e selecione as entidades diretamente.
3. Para conexões com reconhecimento de âncora, arraste das âncoras de borda (`superior/direita/inferior/esquerda`) entre as entidades.
4. Selecione um relacionamento na lista e ajuste:
   - deslocamento da etiqueta
   - pontos de curvatura
   - comportamento âncora
5. Clique em `Salvar relacionamento`.

## 3) Metadados de contexto de domínio

Metadados por domínio:

- Linguagem onipresente
- Equipe proprietária
- Dependências ascendentes
- Dependências a jusante
- Canal de integração
- Dependências de pacotes
- Objetos de valor compartilhado

Como usar:

1. Selecione um domínio.
2. Preencha os valores em `Contexto Limitado`.
3. Clique em `Salvar contexto`.

Esses campos são persistidos no estado do designer e exportados por meio de fluxos JSON/pacote.

## 4) Edição de entidades e modelos

Recursos em nível de entidade:

- Renomear, mover, duplicar, excluir
- Sinalizador raiz agregado
- Editor de invariantes
- Campo CRUD com metadados alinhados ao OpenAPI
- Modelos de campo (`tenantRef`, `auditTrail`, `softDelete`, `contactPack`)
- Modelos de entidade:
  - `crudAgregado`
  - `eventSourced`
  - `referênciaDados`
  - `tenantOwned`

Como usar:

1. Selecione uma entidade.
2. Use o Inspetor de Entidades para renomear/mover/regras.
3. Adicione campos manualmente ou aplique modelos de campo.
4. Aplique modelos de entidade do painel `Entidades`.

## 5) Mapeamento de políticas RBAC

Política de ação por entidade:

- Ações:
  - `lista`
  - `getById`
  - `criar`
  - `atualizar`
  - `excluir`
- Alternância de função:
  - `superadministrador`
  - `administrador`
  - `usuário`
- Sinalizador de escopo do locatário

Como usar:

1. Selecione entidade e ação.
2. Marque as funções permitidas e o escopo do locatário.
3. Clique em `Salvar regra RBAC`.
4. Revise a matriz gerada na lista RBAC.

## 6) Designer de contrato de mensagem

Tipos de contrato suportados:

- `evento`
- `comando`
- `pedido`
- `resposta`

Campos do contrato:

- nome
- digite
- canal/tópico
- versão
- esquema de carga útil (editor JSON)

Como usar:

1. Selecione a entidade.
2. Preencha o nome/tipo/canal/versão do contrato.
3. Clique em `Adicionar contrato`.
4. Use o botão `payload` para editar o esquema JSON.

As exportações incluem esses contratos em:

- Extensão OpenAPI (`x-message-contracts`)
- Exportação AsyncAPI

## 7) Composição Avançada OpenAPI

Controles por entidade:

- `oneOf`, `allOf`, `anyOf`
- lista de referências de esquema
- lista externa `$ref`
- propriedade discriminadora

Como usar:

1. Selecione a entidade.
2. Escolha o modo de composição.
3. Adicione referências de esquema e referências externas opcionais.
4. Defina o discriminador, se necessário.
5. Salve a composição.

## 8) Validação, Portão de Qualidade e Diferença

Características:

- Verificações de modelo com gravidade:
  - `erro`
  - `avisar`
  - `informações`
- Filtro de gravidade mínima configurável
- Bloco de exportação em questões críticas
- Salvar/limpar linha de base do esquema
- Diferença de esquema e dicas de migração

Como usar:

1. Clique em `Validar modelo`.
2. Ajuste o filtro de gravidade, se necessário.
3. Habilite o `bloqueio de exportação em questões críticas` para impor o controle de qualidade.
4. Salve uma linha de base e execute diff para detectar alterações.

## 9) Exemplo e geração de código

Saídas geradas:

- Exemplos de carga útil de solicitação/resposta
- Visualização do esqueleto do código:
  - modelo
  - porta do repositório
  - caso de uso
  - controlador
  - manipulador

Como usar:

1. Selecione uma entidade para saída focada ou mantenha nenhuma selecionada para saída em tela inteira.
2. Clique em:
   - `Gerar Exemplos`
   - `Visualização do código`

## 10) Destinos de exportação e importação

Exportar:

- modelo JSON
-OpenAPI 3.1
- Remarcação
- Esquema JSON
- API assíncrona
- Pacote padrão
- Pacote de domínio

Importar:

- modelo JSON
-OpenAPI 3.1
- Pacote de domínio

Como usar:

1. Use os botões de exportação no painel `Exportar`.
2. Use botões de importação para JSON/OAS/pacote.
3. Para exportação de pacotes, o domínio selecionado é usado como pacote de origem.

## 11) Cobertura de fumaça

Testes de fumaça de gerenciamento de serviços:

- `apps/backend-template/test/integration/ServiceManagement/domainDesigner.smoke.test.ts`
- `apps/backend-template/test/unit/service-management/mvp.roadmap.features.test.ts`

Correr:

```bash
bun run test:integration:service-management
NODE_ENV=dev bun x jest apps/backend-template/test/unit/service-management/mvp.roadmap.features.test.ts --runInBand
```

