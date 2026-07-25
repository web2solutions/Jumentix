<!--
Arquivo gerado automaticamente a partir de: documentation/md/adapters/http/AWS-LAMBDA.md
Idioma alvo: Português (Brasil)
-->
# Adaptador AWS Lambda

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
pnpm run dev:serverless
```

## Notas

- Mantenha o substituto RESTAPI disponível para documentação/substituição operacional.


