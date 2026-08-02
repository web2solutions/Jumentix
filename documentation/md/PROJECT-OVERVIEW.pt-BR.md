<!--
Arquivo gerado automaticamente a partir de: documentation/md/PROJECT-OVERVIEW.md
Idioma alvo: Português (Brasil)
-->
# Visão geral do projeto

## Objetivo deste projeto

Este padrão fornece um ponto de partida orientado à produção para equipes de back-end que precisam entregar rapidamente sem sacrificar a qualidade da arquitetura.

É construído sobre uma interpretação pragmática de:

- Arquitetura Hexagonal
- Design Orientado a Domínio (DDD)
- Arquitetura Orientada a Eventos (EDA)

Seu objetivo é permanecer independente da estrutura e pode ser usado para:

- monólitos modulares
- microsserviços
- primeiros serviços lambda

## Vantagens e exemplos de aplicações

### Por que este padrão é útil

1. Consistência arquitetônica:
   as equipes começam com limites claros (manipuladores, controladores, casos de uso de aplicativos, serviços, repositórios, adaptadores) em vez de inventar uma estrutura por projeto.
2. Flexibilidade de tempo de execução:
   o mesmo domínio pode ser executado com Express/Fastify/Restify, alvos HTTP serverless ou Lambda.
3. Evolução mais fácil:
   os projetos podem começar como um monólito modular e ser divididos posteriormente com menor custo de refatoração.
4. Linha de base de qualidade:
   lint, testes, verificações OpenAPI, verificações de resolução de rota e porta CI estão integrados.
5. Melhor integração:
   os engenheiros seguem as convenções e proteções existentes desde o primeiro dia.

### Exemplos de aplicações

- Serviços de usuário e identidade (registro, login, autorização, ciclo de vida do perfil).
- APIs de cobrança/assinaturas com políticas e eventos de domínio.
- APIs internas de backoffice com rigorosa validação de contrato OpenAPI.
- Serviços orientados a eventos que expõem terminais HTTP operacionais.
- Cargas de trabalho híbridas de API/Lambda compartilhando a mesma lógica de domínio.

## Como este projeto acelera o desenvolvimento de novos aplicativos

- A arquitetura já está definida e evoluindo com guarda-corpos explícitos.
- A estratégia do adaptador está pronta, portanto a alternância do tempo de execução é incremental.
- Os fluxos de trabalho de autenticação/validação/OpenAPI são padronizados.
- Abstrações de repositório permitem início na memória e posterior migração de banco de dados.
- As verificações de CI bloqueiam regressões comuns antes da mesclagem.

Fluxo sugerido:

1. Clone/bifurque o projeto.
2. Defina seu domínio + contrato OpenAPI.
3. Implementar/ampliar casos de uso e repositórios.
4. Expor endpoints por meio de controladores/manipuladores.
5. Execute `ci:gate` localmente antes do PR.
6. Implante como servidor, lambda ou ambos.

## Integrando ferramentas de IA e modelagem de dados (Moon Modeler)

Este projeto pode ser combinado com desenvolvimento assistido por IA e ferramentas como [Moon Modeler](https://www.datensen.com/products/moon-modeler/).

### Possibilidades assistidas por IA

- Gerar rascunhos iniciais do OpenAPI a partir dos requisitos do produto.
- Propor DTOs, regras de validação e modelos de teste.
- Auxiliar na migração de adaptadores na memória para adaptadores SQL/NoSQL.
- Gerar cenários de regressão a partir de incidentes.
- Sugira refatoradores seguros para arquitetura.

### Possibilidades de integração do Moon Modeler

1. Modele entidades e relacionamentos no Moon Modeler.
2. Exporte artefatos de esquema.
3. Mapeie modelos para entidades de domínio e portas de repositório.
4. Implemente adaptadores de banco de dados.
5. Mantenha os esquemas OpenAPI alinhados aos contratos de domínio.
6. Valide com verificações e testes de CI.

### Combinação de IA + Modelador Lunar + Fluxo de trabalho padrão

1. Requisitos e restrições do produto.
2. Modelação de domínio/dados.
3. Contratos e esqueletos de primeira passagem assistidos por IA.
4. Implementação de engenharia com restrições de arquitetura.
5. Validação e liberação de CI.
