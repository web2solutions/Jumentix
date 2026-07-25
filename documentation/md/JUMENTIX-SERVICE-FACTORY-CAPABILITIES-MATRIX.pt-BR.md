<!--
Arquivo gerado automaticamente a partir de: documentation/md/JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX.md
Idioma alvo: Português (Brasil)
-->
# Matriz de capacidades da fábrica de serviços JumentiX

## Objetivo

Defina os modos de fábrica de software suportados para JumentiX para que a engenharia e o produto possam escolher um formato de entrega com arquitetura e operações previsíveis.

## Matriz de Capacidade

| Modo de fábrica | Resultado primário | Interfaces suportadas | Padrão de Comunicação | Estratégia de Persistência | Uso típico |
|---|---|---|---|---|---|
| Monólito Modular (Backend) | Serviço de back-end único com vários domínios | REST, substituto WebSocket + REST, substituto gRPC + REST, funções | Solicitação/resposta do MessageMediator em processo + pub/sub | Na memória, SQL, NoSQL via seleção de driver env | Produtos e equipes em estágio inicial otimizando velocidade com caminho de dissociação futuro |
| Grupo de back-end multisserviço | Vários serviços de back-end em um espaço de trabalho | REST, WebSocket, gRPC, Funções | Mediador baseado em contrato e contratos de eventos por limite de serviço | Seleção de adaptador de banco de dados por serviço | Isolamento de domínio e escalonamento independente por contexto limitado |
| Back-end híbrido + front-end | Serviços de back-end mais aplicativos SPA/PWA/SSR | Contratos REST + em tempo real consumidos por clientes SDK | Contratos de API (OpenAPI/AsyncAPI) e integração primeiro do evento | Adaptador de backend mais estratégia de armazenamento local/offline de frontend | Entrega de produto ponta a ponta a partir de um monorepo |
| SPA/PWA off-line somente front-end | Pacote de aplicativos frontend com compatibilidade de contrato API | Aplicativo local + consumo remoto opcional de API | Integração do SDK do cliente com foco no contrato | Armazenamento IndexedDB/local para fluxos offline | Aplicativos de campo e operações com capacidade off-line |

## Garantias Não Funcionais

- DDD + Limites hexagonais são obrigatórios para módulos backend.
- A integração orientada a eventos é priorizada para evitar acoplamentos rígidos e dependências circulares.
- Cada serviço gerado deve manter CI, cobertura, verificações de contrato e verificações de arquitetura habilitadas por padrão.
- A inicialização do tempo de execução deve ser orientada pelo ambiente e orquestrada por PM2 para contextos de VM.

## Contratos necessários por modo de fábrica

| Contrato | Monólito Modular | Back-end multisserviço | Híbrido | Somente front-end |
|---|---:|---:|---:|---:|
| Contratos de endpoint OpenAPI 3.1 | obrigatório | obrigatório | obrigatório (backend) | opcional (lado do consumidor) |
| Contratos em tempo real AsyncAPI | necessário quando o tempo real estiver ativado | necessário quando o tempo real estiver ativado | necessário quando o tempo real estiver ativado | opcional |
| Documentação do mapa de mensagens/eventos | obrigatório | obrigatório | obrigatório | opcional |
| Mapa de contrato de erro | obrigatório | obrigatório | obrigatório | recomendado |
| Documentos de entidade/modelo de dados | obrigatório | obrigatório | obrigatório | opcional |

## Critérios de aceitação

- A seleção do perfil de serviço é mapeada para um dos modos de fábrica acima.
- Os andaimes gerados incluem arquivos de contrato necessários e scripts de qualidade padrão.
- O índice de documentação faz referência a esta matriz como a fonte canônica de capacidade do produto.
