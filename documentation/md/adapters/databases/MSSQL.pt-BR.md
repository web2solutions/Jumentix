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
pnpm run docker:up:mssql
```

2. Definir ambiente:

```bash
AAA_DATABASE_DRIVER=MSSQL
AAA_DB_HOST=127.0.0.1
AAA_DB_PORT=1433
AAA_DB_NAME=aaa
AAA_DB_USERNAME=sa
AAA_DB_PASSWORD=YourStrong!Passw0rd
```

3. Inicie o adaptador de serviço.


