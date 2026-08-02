<!--
Arquivo gerado automaticamente a partir de: documentation/md/adapters/databases/RDS.md
Idioma alvo: Português (Brasil)
-->
# Adaptador RDS

## Tecnologia

Caminho de integração do Amazon RDS (perfil SQL na camada do adaptador externo).

## Crie serviços com RDS

1. Definir ambiente:

```bash
JUMENTIX_DATABASE_DRIVER=RDS
JUMENTIX_DATABASE_CONNECTION_URL=postgres://user:pass@rds-host:5432/jumentix
```

2. Inicie o adaptador de serviço.
3. Valide com comando smoke:

```bash
bun run smoke:db:rds
```


