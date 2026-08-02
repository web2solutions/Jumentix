<!--
Arquivo gerado automaticamente a partir de: documentation/md/adapters/databases/POSTGRESQL.md
Idioma alvo: Português (Brasil)
-->
# Adaptador PostgreSQL

## Tecnologia

Perfil de cliente SQL baseado em sequencial.

## Crie serviços com PostgreSQL

1. Inicie o contêiner:

```bash
bun run docker:up:postgresql
```

2. Definir ambiente:

```bash
AAA_DATABASE_DRIVER=PostgreSQL
AAA_DB_HOST=127.0.0.1
AAA_DB_PORT=5432
AAA_DB_NAME=aaa
AAA_DB_USERNAME=postgres
AAA_DB_PASSWORD=postgres
```

3. Inicie o adaptador de serviço (comando `dev:*`).


