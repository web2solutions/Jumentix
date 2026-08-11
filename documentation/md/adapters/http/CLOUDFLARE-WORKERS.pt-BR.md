<!--
Arquivo gerado automaticamente a partir de: documentation/md/adapters/http/CLOUDFLARE-WORKERS.md
Idioma alvo: Português (Brasil)
-->
# Adaptador de trabalhadores Cloudflare

## Glossário

- **Adapter de entrada** — aceita chamadas de protocolo externo e traduz para use-cases.

## Responsabilidade no escopo

- **Camada:** adapter / http
- **Responsável por:** wiring específico deste framework/tecnologia
- **Usado com:** composição do backend-template, pacotes de persistência/SDK, guia correspondente
- **Não responsável por:** regras de domínio, autoría OpenAPI ou storage offline no browser

## Por que existe

A escolha de framework fica na borda. Este adapter mantém detalhes Express/Fastify/DB/realtime substituíveis.

## O que é

Adapter CLOUDFLARE WORKERS para interfaces http do Jumentix — monta use-cases sem vazar tipos de framework no domínio.

## Propósito

Execute APIs HTTP no estilo Cloudflare Workers (contrato `fetch`), sem tempo de execução Express.

## Pontos de entrada

- `apps/backend-template/src/interface/HTTP/adapters/cloudflare-workers/cloudflare-workers.ts`

## Crie um serviço com trabalhadores da Cloudflare

1. Implemente manipuladores de operações para esta estrutura.
2. Mantenha as camadas de domínio e de caso de uso compartilhadas com outros adaptadores.
3. Use o despachante de busca de trabalhadores.
4. Execute:

```bash
bun run dev:cloudflare-workers
```

## Checklist júnior (“Eu consigo …”)

- [ ] Sei quando escolher este adapter
- [ ] Consigo iniciá-lo pelo script documentado
- [ ] Sei o próximo guia/pacote

## Próximo passo

Volte para [Começando](/docs/pt-BR/jumentix/concepts/getting-started) ou o guia correspondente.
