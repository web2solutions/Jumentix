# Aurora Adapter

## Technology

Aurora integration path (SQL-compatible profile in external adapter layer).

## Build Services with Aurora

1. Set env:

```bash
JUMENTIX_DATABASE_DRIVER=Aurora
JUMENTIX_DATABASE_CONNECTION_URL=postgres://user:pass@aurora-host:5432/jumentix
```

2. Start service adapter.
3. Validate with smoke command:

```bash
bun run smoke:db:aurora
```

