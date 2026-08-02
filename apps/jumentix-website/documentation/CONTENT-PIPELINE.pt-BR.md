# Pipeline de Conteúdo Markdown

Rastreamento:

- Épico: [#167](https://github.com/XpertMinds/Jumentix/issues/167)
- Tarefa: [#172](https://github.com/XpertMinds/Jumentix/issues/172)

## Propósito

Transformar documentação canônica dos componentes Jumentix em um portal Nextra bilíngue e
hierárquico. O pipeline gera atualmente 110 páginas baseadas em fontes, além de páginas iniciais do
portal e das seções, totalizando 61 rotas em inglês e 61 em português.

## Configuração das Fontes

`config/content-sources.json` suporta dois modelos:

- `entries`: conceitos, guias e referências selecionados, com fontes, títulos, descrições, seções e
  slugs explícitos em inglês e português;
- `collections`: documentação de pacotes ou adaptadores descoberta recursivamente, na qual cada
  fonte `.md` em inglês deve possuir uma tradução `.pt-BR.md`.

Planejamento, migrações, governança e conteúdo exclusivo de mantenedores não fazem parte da
configuração pública.

## Gerador

`scripts/sync-markdown-content.mjs`:

1. valida fontes e pares de tradução;
2. infere títulos e slugs estáveis das coleções;
3. cria árvores equivalentes em `content/jumentix` e `content/pt-BR/jumentix`;
4. gera metadados `_meta.ts` em cada nível;
5. remove comentários HTML incompatíveis com MDX;
6. transforma links entre fontes publicadas em rotas canônicas do site;
7. transforma outros links Markdown resolvíveis em links GitHub `blob/dev`;
8. adiciona frontmatter e rastreabilidade da fonte;
9. gera páginas iniciais e jornadas recomendadas em cada idioma.

## Contrato de Rotas

- Inglês: `/docs/jumentix/<seção>/<slug>`
- Português: `/docs/pt-BR/jumentix/<seção>/<slug>`
- Seções: `concepts`, `guides`, `adapters`, `packages` e `reference`
- Famílias de adaptadores: `http`, `databases` e `realtime`

O loader mantém slugs antigos suportados e os resolve para rotas canônicas.

## Validação

`scripts/content-smoke.mjs` exige:

- ao menos 61 páginas por idioma;
- árvores relativas EN/PT idênticas;
- páginas representativas de conceitos, guias, adaptadores, pacotes e referência;
- frontmatter em todas as páginas;
- ausência de comentários HTML incompatíveis;
- ausência de marcadores de links `undefined`.

`scripts/prepublish-site-checks.mjs` compila e inicia a aplicação de produção, testa rotas canônicas
e de compatibilidade e percorre links internos das superfícies comercial e técnica.

## Comandos

```bash
bun run --filter @jumentix/website content:sync
bun run --filter @jumentix/website content:smoke
bun run --filter @jumentix/website test:prepublish
```

`predev` e `prebuild` regeneram o conteúdo automaticamente. Os arquivos gerados permanecem
versionados para preservar uma saída auditável entre fonte e página publicada.
