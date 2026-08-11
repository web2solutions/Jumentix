<!--
Arquivo gerado automaticamente a partir de: documentation/md/guides/CREATING-SAAS-MICROSERVICES-WITH-JUMENTIX.md
Idioma alvo: Português (Brasil)
-->
# Criando microsserviços SaaS com Jumentix

Utilize este caminho quando a escala de domínio, a autonomia da equipa e os perfis de tráfego exigirem a decomposição do nível de serviço.

## Estratégia recomendada

1. Comece modular e contrate primeiro desde o primeiro dia.
2. Identificar candidatos à extração por propriedade de domínio e perfil operacional.
3. Mova adaptadores/contratos genéricos para pacotes de espaço de trabalho reutilizáveis.
4. Manter a comunicação baseada em contrato (mediador de mensagens/eventos/solicitações-respostas).

## Caminho de evolução do Monolith

1. Estabilize os limites do domínio no monólito modular.
2. Extraia um contexto limitado por vez.
3. Mantenha os contratos de API compatíveis com versões anteriores durante a migração.
4. Isole gradualmente os pipelines de persistência e implantação por serviço.

## Padrão Operacional

- Interfaces REST + em tempo real baseadas em responsabilidades de serviço.
- Portas de CI independentes e suítes de testes por pacote/aplicativo de serviço.
- PM2/contêineres/funções de acordo com necessidades de tempo de execução.

## Benefícios de produto e engenharia

- Cadência de lançamento independente por domínio.
- Dimensionamento horizontal em serviços de hotspot.
- Melhor propriedade e limites de equipe mais claros.

## Documentos relacionados

- [Contratos de mensagens e eventos](/docs/jumentix/reference/events-messages)
- [Pacotes do workspace Jumentix](/docs/jumentix/packages)
- [Arquitetura e estrutura](/docs/jumentix/concepts/architecture)


## Próximos passos

1. [Começando](/docs/pt-BR/jumentix/concepts/getting-started)
2. [REST](/docs/pt-BR/jumentix/guides/rest-api)
