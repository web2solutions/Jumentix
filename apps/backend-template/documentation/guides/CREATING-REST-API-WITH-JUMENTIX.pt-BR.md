<!--
Arquivo gerado automaticamente a partir de: apps/backend-template/documentation/guides/CREATING-REST-API-WITH-JUMENTIX.md
Idioma alvo: Português (Brasil)
-->
# Criando API REST com Jumentix

Este guia mostra como inicializar e executar um serviço REST usando o modelo de back-end.

## 1. Selecione o perfil de tempo de execução

Defina variáveis ​​de ambiente:

- `AAA_HTTP_FRAMEWORK=express` (ou qualquer adaptador suportado)
- `AAA_REALTIME_API = não`

Então comece:

```bash
bun run dev:http
```

## 2. Modelo de Domínio e Contratos

1. Desenhar entidades e relacionamentos em Gestão de Serviços (Designer de Domínio).
2. Gere ou atualize definições OpenAPI em `spec/1.0.0.yml`.
3. Mantenha os objetos do contrato de solicitação/resposta alinhados com as entradas/saídas do controlador.

## 3. Implementar fluxo de domínio

Use o padrão de camadas do projeto:

1. modelo/entidade/objetos de valor
2. portas/adaptadores de repositório
3. serviços/casos de uso
4. controladores
5. manipuladores de estrutura

## 4. Vincular ao adaptador HTTP

Escolha o adaptador por env (`AAA_HTTP_FRAMEWORK`) e use o carregador de inicialização REST.
Os endpoints REST são expostos por meio de manipuladores nativos da estrutura nas interfaces do módulo.

## 5. Validar

Execute portões de qualidade:

```bash
bun run lint
bun run test:unit
bun run oas:check-routes
bun run test:integration:express
```

## Referências

- [Índice de adaptadores HTTP](../../../../documentation/md/adapters/http/README.md)
- [Especificações OpenAPI](../../../../spec/1.0.0.yml)
- [Configurar tempo de execução e API](../../../../documentation/md/SETUP-RUNTIME-AND-API.md)
