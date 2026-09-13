# Experiência do site comercial do Jumentix

Rastreamento:

- Épico: [#167](https://github.com/web2solutions/Jumentix/issues/167)
- Implementação: [#171](https://github.com/web2solutions/Jumentix/issues/171)

## Propósito

O site público apresenta o Jumentix como fábrica de software open source e entrega evidências
técnicas para validar o produto dentro da jornada comercial. Ele atende donos de produto, líderes
de engenharia, engenheiros, equipes de plataforma, avaliadores de segurança e contribuidores.

A experiência aprende com a profundidade e a comunicação orientada a código de sites de frameworks
open source estabelecidos, preservando a linguagem, os recursos e a identidade do Jumentix.

## Arquitetura de informação

| Rota | Responsabilidade |
| --- | --- |
| `/` | Posicionamento, provas, visão real do Domain Designer e entrada por código |
| `/product` | Capacidades completas e ciclo de entrega |
| `/use-cases` e filhas | Blueprints REST, realtime, SaaS modular, microsserviços e PWA offline |
| `/integrations` | Inventário HTTP, realtime, persistência, mensageria e deploy |
| `/architecture` | DDD, Hexagonal, Event-Driven, SOLID e limites contratuais, mais o mapa hexagonal interativo do backend-template (incluindo `interface/GUI`) |
| `/security-compliance` | RBAC, controles PCI, segredos e evidências |
| `/pricing-or-engagement` | Caminhos open source, piloto e adoção como plataforma |
| `/community` | Fluxo de contribuição e governança |
| `/roadmap` | Direção do produto conectada ao roadmap do Linear |
| `/changelog` | Histórico do GitHub com até 200 mudanças por página |
| `/contact` | Discussions, issues e contato enterprise |
| `/docs/jumentix` | Entrada da documentação técnica |

Cada rota comercial também existe sob `/pt-BR`. O controle de idioma preserva a rota atual.

## Navegação

No desktop ficam visíveis Produto, Casos de uso, Integrações, Arquitetura e Docs. GitHub e idioma
permanecem ações diretas. Em telas compactas, a navegação vira um menu nomeado que também inclui
Comunidade e Roadmap. O rodapé agrupa construção, aprendizado e comunidade.

## Evidência por código

`CodeShowcase` apresenta exemplos reais em abas acessíveis com ação de cópia nomeada:

- instalação Bun e inicialização local;
- contratos TypeScript e Message Mediator;
- definições OpenAPI 3.1 e AsyncAPI;
- clientes Fetch, Socket.IO e gRPC;
- seleção de driver, relacionamentos e testes com Docker;
- PM2, Serverless e gates de qualidade.

Os exemplos devem acompanhar scripts, contratos e variáveis reais. Exemplos fictícios sem
correspondência no repositório são proibidos.

## Prova do produto

A homepage usa o canvas real do Domain Designer como mídia full-bleed na primeira viewport. A
página de produto usa o mascote como sinal imediato da marca. A captura está em
`public/product/domain-designer.png`.

## Implementação

```text
components/commercial/
  ChangelogPage.tsx
  CommercialChrome.tsx
  CommercialPages.module.css
  CommercialPages.stories.tsx
  CommercialPages.tsx
```

As rotas são wrappers finos. As páginas em português são despachadas por
`app/pt-BR/[[...slug]]/page.tsx`, que rejeita caminhos desconhecidos com `notFound()`. O Nextra
continua responsável pelo shell de `/docs`.

## Storybook e release

As histórias cobrem os dois idiomas, páginas principais, jornadas REST/realtime e produto mobile.
Com o design system, o catálogo possui 42 entradas.

```bash
bun run website:storybook
bun run website:storybook:build
bun run website:storybook:smoke
bun run --filter @jumentix/website test:prepublish
```

O gate gera o build de produção, inicia localmente, valida rotas comerciais EN/PT, paginação do
changelog e documentação e encerra o servidor.
