# Repositorio Canonico

`web2solutions/Jumentix` e o repositorio publico canonico para codigo de
produto, requisitos, especificacoes, documentacao, CI e releases. Firestore e
o armazenamento canonico de coordenacao de agentes pelo Requisito `089`.

## Configuracao

```bash
git clone git@github.com:web2solutions/Jumentix.git
cd Jumentix
git switch dev
bun install --frozen-lockfile
```

## Politica de Entrega

- Branches de tarefa partem de `dev` e tem `dev` como destino.
- Titulos de PR iniciam com o ID Linear correspondente: `[JUM-XXXX][Nature]`.
- CI, qualidade, cobertura, seguranca, governanca, rastreabilidade e resolucao
  de comentarios validos permanecem obrigatorios.
- Checks ausentes, com falha, ignorados, cancelados, expirados ou incompletos
  nao sao evidencia de aprovacao e nao podem receber bypass.

Evidencias historicas de migracao de repositorios estao resumidas em
`documentation/md/HISTORICAL-TRANSITIONS.pt-BR.md`.
