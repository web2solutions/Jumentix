# Experiência da Documentação

Rastreamento:

- Épico: [#167](https://github.com/web2solutions/Jumentix/issues/167)
- Tarefa: [#172](https://github.com/web2solutions/Jumentix/issues/172)

## Objetivo do Produto

O portal de documentação do Jumentix é a superfície técnica para engenheiros avaliarem, criarem e
operarem aplicações. Ele combina a capacidade de descoberta esperada de um framework open source
maduro com rastreabilidade até os arquivos canônicos do monorepo.

## Arquitetura da Informação

| Seção | Pergunta do leitor | Conteúdo típico |
| --- | --- | --- |
| Conceitos | Por que o Jumentix funciona assim? | Arquitetura, domínios, contratos e Event-Driven Design |
| Guias | Como construo um produto? | REST, realtime, SPA/PWA, monólito e microsserviços |
| Adaptadores | Qual runtime ou infraestrutura devo usar? | HTTP, bancos de dados e realtime |
| Pacotes | Qual biblioteca reutilizável devo instalar? | Message Mediator, runtime bootstrap e SDKs |
| Referência | Qual é o comportamento exato? | Contratos, comandos, segurança, entidades e eventos |

As rotas em inglês começam em `/docs/jumentix`. As páginas em português preservam a mesma
hierarquia sob `/docs/pt-BR/jumentix`.

## Contrato de Navegação

O shell da documentação inclui:

- cabeçalho do produto com acesso direto a Conceitos, Guias, Adaptadores e Pacotes;
- sidebar hierárquica e responsiva;
- busca de texto;
- índice da página e retorno ao topo;
- navegação anterior e próxima;
- links para editar ou relatar um problema no GitHub;
- tema claro/escuro;
- troca de idioma preservando o documento atual;
- footer compartilhado com jornadas de produto e comunidade.

Rotas antigas continuam compatíveis e são resolvidas para páginas canônicas.

## Código e Evidência Técnica

Blocos Markdown são exibidos como widgets de código com syntax highlighting. Exemplos públicos
devem usar pacotes, scripts, variáveis de ambiente, contratos e formatos de API reais do Jumentix.

## Modelo Bilíngue

Guias e conceitos explícitos definem fontes EN/PT em `config/content-sources.json`. Coleções
descobrem documentação de componentes recursivamente e exigem um arquivo `.pt-BR.md` para cada
fonte `.md` em inglês.

```text
content/
├── jumentix/
│   ├── concepts/
│   ├── guides/
│   ├── adapters/
│   ├── packages/
│   └── reference/
└── pt-BR/jumentix/
    └── <mesma hierarquia>
```

## Público e Proveniência de Mantenedor

A árvore publicada atende quem integra o Jumentix (matriz de público do Requisito 066). As fontes em
`documentation/md/**` são documentos de contribuidor e podem citar issues do Linear e números de
requisito como proveniência. O sync separa os dois:

- `stripMaintainerProvenance` (`scripts/content-leaks.mjs`) remove parênteses que só citam issues,
  requisitos ou PRs — `(JUM-468)`, `([JUM-493](…))`, `(Requisito \`059\`)`,
  `(entregue pelo JUM-460; Requisito 126 §3)` — e definições de link de referência para o Linear.
  Escreva a proveniência entre parênteses para que a doc de contribuidor a mantenha e o site a remova.
- Proveniência citada no meio da prosa não é reescrita; `bun run docs:check-audience` a aponta na
  página gerada e a fonte é corrigida.
- Registros de design de mantenedor não são publicados. A cadeia E1–E8 do Service Management
  (arquitetura de módulos, paridade de contratos, console de operações, adoção do Cana, design
  system e PWA, colaboração e empacotamento) saiu de `config/content-sources.json` no JUM-895; as
  URLs antigas `/docs/…/reference/service-management-*` resolvem para o guia do Service Manager.

## Gates de Publicação

```bash
bun run --filter @jumentix/website content:sync
bun run --filter @jumentix/website content:smoke
bun run --filter @jumentix/website storybook:build
bun run --filter @jumentix/website storybook:smoke
bun run --filter @jumentix/website test:prepublish
```

`content:smoke` valida paridade de idiomas, rotas obrigatórias, frontmatter, MDX e links gerados.
`test:prepublish` compila a aplicação de produção e testa rotas comerciais, documentação canônica,
compatibilidade, APIs e links internos no servidor real.

## Adicionando Documentação

1. Escreva o documento em inglês junto ao componente responsável.
2. Adicione a tradução `.pt-BR.md` no mesmo local relativo.
3. Configure uma entrada ou coleção em `config/content-sources.json`.
4. Execute os gates de conteúdo e publicação.
5. Atualize o Storybook ao introduzir um novo estado reutilizável de interface.
6. Associe a mudança à tarefa, épico, milestone, commit e PR no GitHub.
