<!--
Arquivo gerado automaticamente a partir de: packages/cli-init/README.md
Idioma alvo: Português (Brasil)
-->
# @jumentix/cli-init

Pacote Bootstrap CLI para andaimes do projeto JumentiX.

## Comandos

- `jumentix-init`
- `aaa-bootstrap` (alias de compatibilidade)

## Comportamento

- Solicita tipo/perfil de serviço.
- Modelo de repositório de clones.
- Gera `.aaa/service-profile.json`.
- Opcionalmente, instala dependências no projeto de destino.
- Suporta automação não interativa por meio de sinalizadores CLI.

## Uso não interativo

```bash
node ./packages/cli-init/bin/jumentix-init.js \
  --service-type=rest \
  --project-name=my-service \
  --git-branch=main \
  --install-deps=false
```

## Ajuda

```bash
node ./packages/cli-init/bin/jumentix-init.js --help
```

## Execute o ponto de entrada do pacote local

```bash
node ./packages/cli-init/bin/jumentix-init.js
```

