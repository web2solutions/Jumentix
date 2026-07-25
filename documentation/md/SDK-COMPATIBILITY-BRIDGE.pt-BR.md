<!--
Arquivo gerado automaticamente a partir de: documentation/md/SDK-COMPATIBILITY-BRIDGE.md
Idioma alvo: Português (Brasil)
-->
# Ponte de compatibilidade SDK

Atualmente, este projeto expõe dois caminhos de acesso do SDK durante a migração monorepo:

1. Novos pacotes canônicos de espaço de trabalho:
   - `@jumentix/sdk-rest-client`
   - `@jumentix/sdk-websocket-client`
   - `@jumentix/sdk-grpc-client`
2. Caminho de compatibilidade legado:
   - `sdk-clientes/*`

## Por que esta ponte existe

- Evite interromper as importações existentes enquanto a migração estiver em andamento.
- Mantenha o Wave 3 (divisão do pacote SDK) incremental e de baixo risco.
- Permitir a adoção paralela sem uma refatoração forçada do big bang.

## Contrato ponte

- Arquivos legados em `sdk-clients/` só devem reexportar implementações de pacotes.
- Novos recursos do SDK devem ser implementados apenas em `packages/sdk-*`.
- Documentação e exemplos devem priorizar as importações `@jumentix/sdk-*`.

## Critérios de desativação

A ponte de compatibilidade pode ser removida quando:

1. todas as importações internas são migradas para `@jumentix/sdk-*`,
2. consumidores externos confirmam que não há dependência de `sdk-clients/*`,
3. A lista de verificação de aceitação da onda de migração marca a divisão do SDK como concluída.
