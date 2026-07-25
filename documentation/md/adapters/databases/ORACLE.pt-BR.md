<!--
Arquivo gerado automaticamente a partir de: documentation/md/adapters/databases/ORACLE.md
Idioma alvo: Português (Brasil)
-->
# Adaptador Oracle

## Tecnologia

Sequelize + perfil Oracle.

## Crie serviços com Oracle

1. Inicie o contêiner:

```bash
pnpm run docker:up:oracle
```

2. Definir ambiente:

```bash
AAA_DATABASE_DRIVER=Oracle
AAA_DB_HOST=127.0.0.1
AAA_DB_PORT=1521
AAA_DB_NAME=XE
AAA_DB_USERNAME=system
AAA_DB_PASSWORD=oracle
```

3. Inicie o adaptador de serviço.


