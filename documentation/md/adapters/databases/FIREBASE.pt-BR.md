<!--
Arquivo gerado automaticamente a partir de: documentation/md/adapters/databases/FIREBASE.md
Idioma alvo: Português (Brasil)
-->
# Adaptador Firebase

## Tecnologia

Perfil de administrador do Firebase.

## Crie serviços com Firebase

1. Inicie o contêiner do emulador local (se configurado):

```bash
bun run docker:up:firebase
```

2. Definir ambiente:

```bash
JUMENTIX_DATABASE_DRIVER=Firebase
JUMENTIX_FIREBASE_PROJECT_ID=jumentix-dev
JUMENTIX_FIREBASE_CREDENTIALS_JSON=./path/to/service-account.json
```

3. Inicie o adaptador de serviço.


