<!--
Arquivo gerado automaticamente a partir de: documentation/md/adapters/databases/INMEMORY.md
Idioma alvo: Português (Brasil)
-->
# Adaptador de banco de dados InMemory

## Propósito

Adaptador oficial padrão para desenvolvimento local e testes determinísticos.

## Pontos de entrada

- `apps/backend-template/src/infra/persistence/InMemoryDatabase/InMemoryDbClient.ts`
- `apps/backend-template/src/infra/persistence/compileDatabaseClient.ts`

## Crie serviços com InMemory

1. Definir ambiente:

```bash
AAA_DATABASE_DRIVER=InMemory
```

2. Inicie o adaptador API.
3. Os repositórios usarão o contrato `dbClient.stores`.


