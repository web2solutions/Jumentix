# MySQL Adapter

## Technology

Sequelize + mysql2 profile.

## Build Services with MySQL

1. Start container:

```bash
bun run docker:up:mysql
```

2. Set env:

```bash
JUMENTIX_DATABASE_DRIVER=MySQL
JUMENTIX_DB_HOST=127.0.0.1
JUMENTIX_DB_PORT=3306
JUMENTIX_DB_NAME=jumentix
JUMENTIX_DB_USERNAME=root
JUMENTIX_DB_PASSWORD=root
```

3. Start your API adapter.

