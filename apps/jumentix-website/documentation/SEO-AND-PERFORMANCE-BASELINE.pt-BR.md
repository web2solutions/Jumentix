<!--
Arquivo gerado automaticamente a partir de: apps/jumentix-website/documentation/SEO-AND-PERFORMANCE-BASELINE.md
Idioma alvo: Português (Brasil)
-->
# SEO e linha de base de desempenho

Rastreamento de problemas:

- Épico: [#124](https://github.com/XpertMinds/Jumentix/issues/124)
- Tarefa: [#129](https://github.com/XpertMinds/Jumentix/issues/129)

## Linha de base de SEO implementada

- Metadados globais configurados em `config/index.ts`:
  - modelo de título
  - descrição
  - palavras-chave
  - Metadados e imagem do Open Graph
  - Metadados do cartão do Twitter
- Ponto final dos robôs:
  - `app/robots.ts`
- Ponto final do mapa do site:
  - `app/sitemap.ts` com principais rotas comerciais e de documentos

## Estratégia de base de desempenho

- Design estático de primeira página para rotas comerciais.
- Conteúdo Markdown gerado antes do tempo de execução via `content:sync`.
- Interatividade mínima apenas do cliente em páginas comerciais.
- Mantenha as páginas com poucos componentes e evite grandes dependências de tempo de execução por rota.

## Etapas de validação de acompanhamento

1. Execute o Lighthouse para rotas principais:
   - `/`
   - `/produto`
   - `/casos de uso`
   - `/contato`
2. Capture a linha de base para:
   - Desempenho
   - SEO
   - Acessibilidade
3. Armazene evidências básicas na descrição do PR para marcos de lançamento do site.
