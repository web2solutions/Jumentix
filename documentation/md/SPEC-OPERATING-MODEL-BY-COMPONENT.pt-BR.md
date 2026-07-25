<!--
Arquivo gerado automaticamente a partir de: documentation/md/SPEC-OPERATING-MODEL-BY-COMPONENT.md
Idioma alvo: Português (Brasil)
-->
# Especificação do modelo operacional por componente

Este documento define como cada componente Jumentix participa da execução orientada ao desenvolvimento de especificações.

## Raiz Monorepo

Responsabilidades:

1. Forneça índice canônico (`README.md`, `documentation/README.md`).
2. Definir regras de governação e políticas de qualidade.
3. Execute verificações de orquestração e liberação de CI em nível monorepo.

Obrigações de especificações:

1. Mantenha os documentos globais de fluxo de trabalho/governança atualizados.
2. Mantenha as políticas raiz alinhadas com os scripts do espaço de trabalho e CI.

## `apps/backend-template`

Responsabilidades:

1. Implementação de referência de arquitetura de back-end.
2. Implementação de domínio/caso de uso/controlador/adaptador.
3. Atendimento e validação de contrato OpenAPI/AsyncAPI.

Obrigações de especificações:

1. Atualize as especificações `spec/1.0.0.yml` e AsyncAPI para alterações na interface.
2. Atualize os documentos de domínio/entidade/objeto de valor para alterações no comportamento dos dados.
3. Atualize os documentos do adaptador para alterações de tempo de execução/protocolo.

## `apps/gerenciamento de serviços`

Responsabilidades:

1. UX para fluxos de trabalho de design de serviços e domínios.
2. Fluxos de configuração de ambiente/tempo de execução.
3. Suporte à configuração do perfil de implantação.

Obrigações de especificações:

1. Mantenha os documentos do fluxo de trabalho sincronizados com recursos reais da interface do usuário.
2. Mantenha os contratos de configuração de serviço explícitos e testáveis.

## `apps/jumentix-website`

Responsabilidades:

1. Posicionamento comercial e comunicação de produto.
2. Funil de descoberta e conversão de documentação.

Obrigações de especificações:

1. Mantenha as declarações do produto alinhadas com os documentos de capacidade técnica.
2. Certifique-se de que os links e as declarações de recursos sejam rastreáveis ​​de acordo com as especificações técnicas canônicas.

## `pacotes/*`

Responsabilidades:

1. Contratos/adaptadores/ferramentas de tempo de execução reutilizáveis ​​compartilhados.
2. Fundamentos da interoperabilidade entre serviços.

Obrigações de especificações:

1. Mantenha os contratos README e API do pacote sincronizados com o comportamento exportado.
2. Mantenha declarações explícitas de propriedade e compatibilidade.
3. Mantenha os testes e os metadados de lançamento alinhados com os contratos declarados.

## `.agentes/*`

Responsabilidades:

1. Requisito e registro NFR.
2. Memória de governação e restrições de decisão.

Obrigações de especificações:

1. Capture todas as regras NFR/governança solicitadas pelo usuário como artefato de requisito.
2. Mantenha os índices e o registro sincronizados.

## Projeto e problemas do GitHub

Responsabilidades:

1. Planejamento de execução e ciclo de vida de status.
2. Governança de prioridade, estimativa e iteração.
3. Rastreabilidade entre tarefas e PRs.

Obrigações de especificações:

1. Cada implementação é mapeada para o contexto do problema/projeto.
2. PR inclui mapeamento de tarefas e links de evidências.

## Contrato de sincronização

Uma alteração de componente é compatível somente quando:

1. Os documentos locais dos componentes são atualizados.
2. Os documentos canônicos compartilhados são atualizados quando o comportamento dos componentes cruzados muda.
3. O registro de requisitos é atualizado quando as restrições não funcionais mudam.
