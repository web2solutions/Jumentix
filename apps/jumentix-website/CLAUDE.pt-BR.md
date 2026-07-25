<!--
Arquivo gerado automaticamente a partir de: apps/jumentix-website/CLAUDE.md
Idioma alvo: Português (Brasil)
-->
#CLAUDE.md

Este arquivo fornece orientação para Claude Code (claude.ai/code) ao trabalhar com código neste repositório.

## Visão geral do projeto

Este é um modelo **Next.js 16 + Mantine 9 + Nextra 4** usado como base do site de documentação para o ecossistema Mantine Extensions. Ele serve como um iniciador reutilizável para a construção de sites de documentos com componentes Mantine integrados.

## Comandos

| Comando | Finalidade |
|--------|---------|
| `desenvolvimento de fios` | Inicie o servidor de desenvolvimento Next.js |
| `construção de fios` | Construção de produção (Next.js + índice de pesquisa pagefind) |
| `teste de fio` | Suíte completa: typegen, oxfmt, lint, typecheck, jest |
| `brincadeira de fio` | Execute apenas testes Jest |
| `brincadeira do fio:assistir` | Brincadeira no modo relógio |
| `yarn jest -- caminho/para/arquivo` | Execute um único arquivo de teste |
| `verificação de tipo de fio` | Verificação de tipo TypeScript (`tsc --noEmit`) |
| `fiapo de fio` | oxlint + Stylelint |
| `formato do fio:write` | Formatar automaticamente todos os arquivos TS/TSX/CSS (oxfmt) |
| `formato do fio:teste` | Verifique a formatação (oxfmt) |
| `livro de histórias de fios` | Servidor de desenvolvimento do Storybook na porta 6006 |
| `análise de fios` | Análise de pacote com `@next/bundle-analyzer` |

## Arquitetura

### Roteamento e conteúdo

- **App Router** (`app/`): roteador de aplicativo Next.js 16 com integração Nextra
- **Conteúdo do Documentos** (`content/`): arquivos MDX renderizados via Nextra em `/docs/[[...mdxPath]]`
- Nextra está configurado com `contentDirBasePath: '/docs'` — todo o conteúdo MDX é servido em `/docs`
- `content/_meta.ts` controla a ordem e os rótulos de navegação da barra lateral

### Integração de layout e tema

- `app/layout.tsx` envolve todo o aplicativo em `MantineProvider` e `Layout` do Nextra
- A sincronização do modo escuro entre Mantine e Nextra é controlada por `MantineNextraThemeObserver`
- As substituições do tema Mantine vão em `theme.ts` (`createTheme` do lado do cliente)
- A configuração global do site (metadados, API GitHub, pesquisa, layout Nextra) reside em `config/index.ts`

### Componentes principais (`componentes/`)

- `MantineNavBar` / `MantineFooter` — substituições de layout personalizadas do Nextra
- `ColorSchemeControl` / `ColorSchemeToggle` — alternância do modo escuro
- `ReleaseNotes` — busca versões do GitHub via `/api/github-releases`
- `Logo`, `Bem-vindo`, `Conteúdo` — componentes de branding e página de destino

### Rotas de API (`app/api/`)

- `version/` — retorna a versão atual do pacote
- `github-releases/` — proxies API de lançamentos do GitHub (configurada em `config/index.ts`)
- `search/` — endpoint de pesquisa baseado em pagefind

### Procurar

A pesquisa usa [pagefind](https://pagefind.app/). O índice é construído pós-construção (`yarn build:pagefind`) em `public/_pagefind/`. A rota da API de pesquisa lê esse índice.

### Ordem de importação de CSS

Em `app/layout.tsx`, as importações de CSS devem seguir esta ordem:
1. `@mantine/core/styles.css`
2. Estilos de extensão Mantine (por exemplo, letreiro, texto animado)
3. Estilos globais

### Construir pipeline

Cadeias de configuração Next.js (`next.config.mjs`): `nextra()` → `bundleAnalyzer()`. O Turbopack é configurado com carregador SVG embutido para SVGs abaixo de aproximadamente 4 KB.

## Ferramentas

- **Formatador**: oxfmt (`.oxfmtrc.json`)
- **Linter**: oxlint + stylelint
- **TypeScript**: 6.x
- **Gerenciador de Pacotes**: pnpm (padrão de espaço de trabalho). Não use npm ou fio dentro deste monorepo.
