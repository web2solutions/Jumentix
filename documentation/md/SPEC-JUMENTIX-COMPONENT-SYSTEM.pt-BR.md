<!--
Arquivo gerado automaticamente a partir de: documentation/md/SPEC-JUMENTIX-COMPONENT-SYSTEM.md
Idioma alvo: Português (Brasil)
-->
# Especificação do sistema de componentes Jumentix

Esta especificação define Jumentix como um sistema de produto composto por bibliotecas, ferramentas, modelos e componentes.

É a referência canônica para composição de produtos, limites de propriedade e regras de evolução.

## 1) Modelo de composição do produto

Jumentix é composto por quatro tipos de ativos de primeira classe:

1. Bibliotecas
2. Ferramentas
3. Modelos
4. Componentes (aplicativos/serviços)

Qualquer novo ativo no monorepo deve ser classificado em um desses tipos.

## 2) Bibliotecas (ativos de tempo de execução reutilizáveis)

Localização principal: `packages/*`

Exemplos:

1. Mediação de mensagens
2. Contratos de persistência
3. Infra/bootstrap de tempo de execução
4. Clientes de valor-chave, mutex, SDK
5. Pacotes de configuração compartilhados

Regras:

1. As bibliotecas devem expor contratos de API claros.
2. As bibliotecas devem incluir documentos técnicos e limites de propriedade.
3. Adaptadores reutilizáveis ​​genéricos devem existir como pacotes, não duplicados em aplicativos.

## 3) Ferramentas (ativos de entrega e governança)

Locais principais:

1. `ci-cd/*`
2. `.husky/*`
3. Roteiros de governança de projetos e portas de qualidade

Exemplos:

1. Orquestradores de CI
2. verificações de cobertura/segurança/governança
3. changelog e automação de lançamento

Regras:

1. As ferramentas devem ter intenção de aplicação explícita.
2. Os resultados da ferramenta devem ser auditáveis ​​e reproduzíveis.
3. As alterações no comportamento das ferramentas devem ser documentadas nas especificações.

## 4) Modelos (ativos de andaime e bootstrap)

Locais principais:

1. `apps/backend-template/*`
2. `pacotes/cli-init/*`
3. Documentos orientados a modelos e contratos de inicialização

Regras:

1. Os modelos devem definir o que é o andaime e por quê.
2. Os resultados do modelo devem preservar a arquitetura e as políticas de governação.
3. O desvio do contrato de modelo/tempo de execução deve ser bloqueado por docs+checks.

## 5) Componentes (unidades de produto executáveis)

Locais principais:

1. `apps/backend-template`
2. `aplicativos/gerenciamento de serviços`
3. `apps/jumentix-website`

Regras:

1. Cada componente deve possuir documentação técnica e limites.
2. Os componentes consomem bibliotecas por meio de contratos de pacotes.
3. O comportamento dos componentes deve ser mapeado para artefatos de especificações e portas de qualidade.

## 6) Contratos de tipo cruzado

1. As bibliotecas são importadas por componentes/ferramentas/modelos por meio de contratos de pacotes explícitos.
2. As ferramentas reforçam a qualidade e a governança em todos os tipos de ativos.
3. Os modelos inicializam estruturas de componentes e configuram o uso da biblioteca.
4. As especificações devem indicar as expectativas de propriedade e integração entre os tipos.

## 7) Requisitos de governança orientados por especificações

Para qualquer alteração que afete a composição:

1. atualizar documentos/especificações de composição
2. atualizar os registros de requisitos/NFR se existir impacto na governança
3. atualizar índices e mapas de origem
4. incluir evidências de rastreabilidade na Issue/Project/Project Update do Linear e no PR do
   GitHub

## 8) Referências Primárias

1. `documentação/md/JUMENTIX-WORKSPACE-PACKAGES.md`
2. `documentação/md/PROJECT-OVERVIEW.md`
3. `documentação/md/ARQUITETURA-E-ESTRUTURA.md`
4. `documentação/md/SPEC-OPERATING-MODEL-BY-COMPONENT.md`
5. `documentação/md/SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.md`
