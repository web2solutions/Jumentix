<!--
Arquivo gerado automaticamente a partir de: apps/backend-template/README.md
Idioma alvo: Português (Brasil)
-->
# @jumentix/backend-template

Destino do aplicativo Workspace para migração de modelo de back-end.

Centro técnico:

- [Documentação do modelo de back-end](./documentation/README.md)

## Status atual

- Aplicativo de espaço de trabalho transitório com scripts executáveis ​​mapeados para o tempo de execução raiz atual.
- O tempo de execução de backend canônico ainda permanece na raiz (`src`, `spec`, `test`, `pm2`, `docker`, docs) durante a Onda 5.

## Scripts executáveis ​​atuais

- `construir` -> raiz `construir:dev`
- `build:dev` -> raiz `build:dev`
- `teste` -> raiz `teste:unidade`
- `teste:unidade` -> raiz `teste:unidade`
- `teste:integração` -> raiz `teste:integração`
- `teste:integração:smoke` -> raiz `ci:smoke`
- `lint` -> raiz `lint`
- `cobertura:patch` -> root `cobertura:patch`
- `ci:gate` -> raiz `ci:gate`
- `ci:gate:strict` -> raiz `ci:gate:strict`
- `dev:rest` -> raiz `dev:http`
- `dev:websocket-rest` -> raiz `dev:websocket`
- `dev:grpc-rest` -> raiz `dev:grpc`
- `pm2:start:*` -> iniciadores de perfil PM2 raiz para dev/staging/produção

## Corte planejado (onda 5)

1. Mova os arquivos de tempo de execução de back-end para `apps/backend-template`.
2. Mantenha as importações conectadas aos pacotes compartilhados `@jumentix/*`.
3. Preservar portas CI e limites de cobertura.
4. Mantenha os perfis de processo PM2 funcionais após a realocação.

## Progresso da onda 5

- O aplicativo Service Management já foi realocado para `apps/service-management`.
- O modelo de back-end agora possui uma superfície de script operacional no contexto do espaço de trabalho, para que os pipelines possam chamar comandos no nível do aplicativo enquanto o código ainda reside na raiz.
- A próxima fatia é a movimentação física do tempo de execução (`src/spec/test/pm2`) com reescrita de caminho e validação de paridade PM2.
