# Firebase Adapter

## Technology

Firebase Admin profile.

## Build Services with Firebase

1. Start local emulator container (if configured):

```bash
bun run docker:up:firebase
```

2. Set env:

```bash
JUMENTIX_DATABASE_DRIVER=Firebase
JUMENTIX_FIREBASE_PROJECT_ID=jumentix-dev
JUMENTIX_FIREBASE_CREDENTIALS_JSON=./path/to/service-account.json
```

3. Start service adapter.

