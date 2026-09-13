<!--
Arquivo gerado automaticamente a partir de: apps/jumentix-website/documentation/CHANGELOG-PAGE.md
Idioma alvo: Português (Brasil)
-->
# Página de registro de alterações

O site expõe `/changelog` como uma página de histórico de alterações verificável para Jumentix.

## Fonte de dados

- Snapshot em tempo de build: `content/changelog.json`, gerado por `scripts/sync-changelog.mjs`
- Entrada primária: `git log` do checkout em build (sha, data ISO, autor, assunto)
- Entrada de fallback: o `CHANGELOG.md` gerado na raiz do monorepo (usado quando o histórico git não está disponível, por exemplo em clones rasos)
- A página importa o JSON diretamente, então o Next.js empacota os dados no deploy. Não há dependência em runtime da API do GitHub nem exigência de `GITHUB_TOKEN` — é isso que mantém `/changelog` funcionando em produção, onde o repositório canônico anteriormente privado responderia 404 a chamadas de API não autenticadas.

## Contrato de paginação

- Tamanho da página da UI: até `200` alterações por página
- Páginas fora do intervalo são limitadas à última página

## Comportamento

- Cada entrada vincula ao commit exato no GitHub quando há sha disponível, caso contrário à página de histórico da branch.
- Os controles Anterior/Próximo evitam renderizar todo o histórico de uma só vez.
- O snapshot é atualizado a cada build pelo hook `prebuild` (`content:sync` também o executa).

## Arquivos

- `app/changelog/page.tsx`
- `components/commercial/ChangelogPage.tsx`
- `scripts/sync-changelog.mjs` (gerador do snapshot)
- `content/changelog.json` (dados empacotados)
- `config/index.ts` (repositório + branch padrão para links externos)
- `app/sitemap.ts` (indexação de rota)
- `components/MantineFooter/MantineFooter.tsx` (link de navegação do site)
