<!--
Arquivo gerado automaticamente a partir de: documentation/md/adapters/http/AWS-LAMBDA.md
Idioma alvo: Português (Brasil)
-->
# Adaptador AWS Lambda

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

Adapter AWS LAMBDA para interfaces http do Jumentix — monta use-cases sem vazar tipos de framework no domínio.

## Propósito

Implante manipuladores como serviços baseados em funções com Serverless.

## Pontos de entrada

- `apps/backend-template/src/interface/aws/lambda/handlers/`
- `apps/backend-template/src/interface/HTTP/adapters/serverless/*`

## Crie um serviço com Lambda

1. Implementar métodos de controlador/caso de uso.
2. Crie uma solicitação de mapeamento de manipuladores Lambda para a operação do controlador.
3. Configure a implantação em arquivos `sem servidor`.
4. Execute o modo local:

```bash
bun run dev:serverless
```

## Notas

- Mantenha o substituto RESTAPI disponível para documentação/substituição operacional.

## Checklist júnior (“Eu consigo …”)

- [ ] Sei quando escolher este adapter
- [ ] Consigo iniciá-lo pelo script documentado
- [ ] Sei o próximo guia/pacote

## Próximo passo

Volte para [Começando](/docs/pt-BR/jumentix/concepts/getting-started) ou o guia correspondente.
