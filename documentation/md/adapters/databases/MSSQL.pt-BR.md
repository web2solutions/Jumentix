<!--
Arquivo gerado automaticamente a partir de: documentation/md/adapters/databases/MSSQL.md
Idioma alvo: Português (Brasil)
-->
# Adaptador SQL Server

## Tecnologia

Sequelize + perfil tedioso.

## Construa serviços com SQL Server

1. Inicie o contêiner:

```bash
bun run docker:up:mssql
```

2. Definir ambiente:

```bash
JUMENTIX_DATABASE_DRIVER=MSSQL
JUMENTIX_DB_HOST=127.0.0.1
JUMENTIX_DB_PORT=1433
JUMENTIX_DB_NAME=jumentix
JUMENTIX_DB_USERNAME=sa
JUMENTIX_DB_PASSWORD=YourStrong!Passw0rd
```

3. Inicie o adaptador de serviço.


