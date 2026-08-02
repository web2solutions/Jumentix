<!--
Arquivo gerado automaticamente a partir de: documentation/md/adapters/databases/AURORA.md
Idioma alvo: Português (Brasil)
-->
# Adaptador Aurora

## Tecnologia

Caminho de integração do Aurora (perfil compatível com SQL na camada do adaptador externo).

## Crie serviços com Aurora

1. Definir ambiente:

```bash
AAA_DATABASE_DRIVER=Aurora
AAA_DATABASE_CONNECTION_URL=postgres://user:pass@aurora-host:5432/aaa
```

2. Inicie o adaptador de serviço.
3. Valide com comando smoke:

```bash
bun run smoke:db:aurora
```


