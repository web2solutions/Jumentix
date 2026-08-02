<!--
Arquivo gerado automaticamente a partir de: apps/service-management/documentation/README.md
Idioma alvo: Português (Brasil)
-->
# Hub de documentação de gerenciamento de serviços

`apps/service-management` é a UI do espaço de trabalho de engenharia para projetar domínios, interfaces, configuração de tempo de execução e destinos de implantação.

## Índice

- Guias
  - [Criando SPA/PWA com Jumentix](./guides/CREATING-SPA-PWA-WITH-JUMENTIX.md)
- Referências principais
  - [Aplicativo de gerenciamento de serviços](../../../documentation/md/SERVICE-MANAGEMENT-APPLICATION.md)
  - [Recursos e uso do designer de domínio](../../../documentation/md/DOMAIN-DESIGNER-FEATURES-AND-USAGE.md)
  - [Entidades de dados de domínio](../../../documentation/md/DOMAIN-DATA-ENTITIES.md)
  - [Contratos de ambiente de tempo de execução](../../../documentation/md/RUNTIME-ENVIRONMENT-CONTRACTS.md)

## O que este componente oferece

- Modelagem de domínio visual e ER com organização de contexto limitado.
- Planejamento de interface de comunicação (REST/realtime/gRPC/SSE).
- Configuração de runtime de serviços e edição de ambiente.
- Planejamento de metas de implantação para plataformas baseadas em VM/funções.

## Instantâneo da arquitetura

- Espaço de trabalho front-end com ferramentas com guias para design de domínio, planejamento de interface e configuração de tempo de execução/implantação.
- Lê e atualiza perfis `.env` ativos por meio de endpoints de back-end do Service Management.
- Mantém os artefatos de modelagem gerados alinhados com as expectativas do contrato de back-end.

## Exemplos de integração

Execute o Service Management como uma ferramenta autônoma:

```bash
bun run dev:service-management
```

Execute o perfil local completo (Gerenciamento de Serviços + perfil REST via PM2):

```bash
bun run dev
```

## Correr

```bash
bun run dev:service-management
```

ou perfil de desenvolvimento completo:

```bash
bun run dev
```

