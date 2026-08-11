# @jumentix/message-mediator — usage guide

The mediator decouples publishers from handlers. Use the **in-memory** adapter
in the browser and unit tests; Rabbit/Bull stay on Node servers.

## Install

```bash
bun add @jumentix/message-mediator
```

## Try it

<DocsPlayground runtime="message-mediator" id="getting-started" />

```js
const seen = [];
const mediator = api.createInMemory();
await mediator.subscribe('demo.ping', async (msg) => { seen.push(msg); });
await mediator.publish('demo.ping', { hello: true });
```

## When not to use in-memory

- Multi-process workers
- Durable queues across deploys

Those need broker adapters — keep them out of the browser bundle.

## Next steps

- [REST guide](/docs/jumentix/guides/rest-api)
- [Realtime guide](/docs/jumentix/guides/realtime-api)
- [Getting started](/docs/jumentix/concepts/getting-started)
