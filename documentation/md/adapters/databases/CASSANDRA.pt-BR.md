<!--
Arquivo gerado automaticamente a partir de: documentation/md/adapters/databases/CASSANDRA.md
Idioma alvo: Português (Brasil)
-->
# Adaptador Cassandra

## Tecnologia

Perfil do motorista Cassandra.

## Crie serviços com Cassandra

1. Inicie o contêiner:

```bash
bun run docker:up:cassandra
```

2. Definir ambiente:

```bash
AAA_DATABASE_DRIVER=Cassandra
AAA_CASSANDRA_CONTACT_POINTS=127.0.0.1
AAA_CASSANDRA_KEYSPACE=aaa
AAA_CASSANDRA_PORT=9042
```

3. Inicie o adaptador de serviço.


