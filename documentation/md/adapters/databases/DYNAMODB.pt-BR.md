<!--
Arquivo gerado automaticamente a partir de: documentation/md/adapters/databases/DYNAMODB.md
Idioma alvo: Português (Brasil)
-->
# Adaptador DynamoDB

## Tecnologia

Perfil do cliente AWS SDK DynamoDB.

## Crie serviços com DynamoDB

1. Inicie o contêiner local:

```bash
bun run docker:up:dynamodb
```

2. Definir ambiente:

```bash
AAA_DATABASE_DRIVER=DynamoDB
AAA_DYNAMODB_ENDPOINT=http://127.0.0.1:8000
AAA_AWS_REGION=us-east-1
```

3. Inicie o adaptador de serviço.


