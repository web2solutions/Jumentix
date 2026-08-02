<!--
Arquivo gerado automaticamente a partir de: documentation/md/adapters/databases/MONGODB.md
Idioma alvo: Português (Brasil)
-->
# Adaptador MongoDB

## Tecnologia

Perfil do mangusto.

## Construa serviços com MongoDB

1. Inicie o contêiner:

```bash
bun run docker:up:mongodb
```

2. Definir ambiente:

```bash
AAA_DATABASE_DRIVER=Mongo
AAA_DATABASE_CONNECTION_URL=mongodb://127.0.0.1:27027/aaa
```

3. Inicie o adaptador de serviço.


