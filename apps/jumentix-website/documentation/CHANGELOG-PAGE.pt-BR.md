<!--
Arquivo gerado automaticamente a partir de: apps/jumentix-website/documentation/CHANGELOG-PAGE.md
Idioma alvo: Português (Brasil)
-->
# Página de registro de alterações

O site expõe `/changelog` como uma página de histórico de alterações apoiada pelo GitHub para Jumentix.

## Fonte de dados

- Repositório GitHub: `web2solutions/aaa-typescript-boilerplate`
- Filial: `dev`
- Família de endpoints: GitHub confirma API

## Contrato de paginação

- Tamanho da página da UI: até `200` alterações por página
- Tamanho da página da API GitHub: `100` commits por solicitação
- Estratégia de implementação:
  - a página do site `N` busca as páginas do GitHub `2N-1` e `2N`
  - os resultados são mesclados e limitados a 200

## Comportamento

- Cada entrada está vinculada ao commit exato no GitHub.
- Os controles Anterior/Próximo evitam carregar todo o histórico de uma só vez.
- Suporta `GITHUB_TOKEN` opcional para acesso à API compatível com limite de taxa, com fallback não autenticado.

## Arquivos

- `app/changelog/page.tsx`
- `config/index.ts` (confirma URL + branch padrão)
- `app/sitemap.ts` (indexação de rota)
- `components/MantineFooter/MantineFooter.tsx` (link de navegação do site)
