# MongoDB Adapter

## Technology

Mongoose profile.

## Build Services with MongoDB

1. Start container:

```bash
bun run docker:up:mongodb
```

2. Set env:

```bash
JUMENTIX_DATABASE_DRIVER=Mongo
JUMENTIX_DATABASE_CONNECTION_URL=mongodb://127.0.0.1:27027/jumentix
```

3. Start service adapter.

