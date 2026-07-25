<!--
Arquivo gerado automaticamente a partir de: documentation/md/BOOTSTRAP-CLI-SCAFFOLDING.md
Idioma alvo: Português (Brasil)
-->
# Estrutura CLI Bootstrap

Este modelo agora expõe comandos CLI de bootstrap instaláveis ​​por npm:

- `aaa-bootstrap`
- `jumentix-init`

O comando clona `aaa-typescript-boilerplate` em uma pasta de destino e grava metadados iniciais do perfil de serviço.

Propriedade do espaço de trabalho:

- `packages/cli-init` contém a implementação canônica do bootstrap.
- root `bin/aaa-bootstrap.js` delega para `packages/cli-init` para manter o comportamento consistente durante a migração monorepo.

## Uso

Instale globalmente (ou execute com `pnpm dlx` do registro do pacote):

```bash
pnpm add -g @jumentix/cli-init
jumentix-init
aaa-bootstrap
```

Uso do repositório local:

```bash
pnpm run cli:bootstrap
```

Uso não interativo:

```bash
jumentix-init --service-type=rest --project-name=my-service --git-branch=main --install-deps=false
```

Ajuda CLI:

```bash
jumentix-init --help
```

Sinalizadores suportados:

- `--service-type` (`rest|websocket|grpc|graphql|functions`)
- `--nome do projeto`
- `--git-branch`
- `--install-deps` (`y|n|true|false`)
- `--repo` (substituir URL do repositório de modelo)

## Perfis de andaime suportados

1. Servidor HTTP/REST (OpenAPI/Swagger + ativos estáticos)
2. Servidor WebSocket (+ ativos estáticos)
3. Servidor gRPC (+ ativos estáticos)
4. Servidor GraphQL (+ ativos estáticos)
5. Pacote de funções (AWS/Google/Azure/Vercel/Cloudflare)

## Metadados gerados

Após o scaffolding, a CLI escreve:

- `.aaa/service-profile.json`

Campos de exemplo:

- tipo de serviço selecionado
- sinalizadores de perfil (`interface`, `funções`, `staticAssets`)
- repositório e branch usado para scaffold
- carimbo de data/hora de geração
