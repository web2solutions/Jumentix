<!--
Arquivo gerado automaticamente a partir de: documentation/md/HEXAGONAL-FEATURE-DRIVEN-MIGRATION.md
Idioma alvo: Português (Brasil)
-->
# Plano de migração hexagonal + DDD + baseado em recursos

## Meta
Mova a base de código para uma arquitetura hexagonal alinhada a DDD e orientada a recursos, com separação clara entre domínio e infraestrutura, minimizando o raio de mudança por correção de bug/recurso.

## Estrutura de destino aprovada

```txt
apps/backend-template/src/
  app/
  shared/
  modules/
    <feature>/
      domain/
      application/
      adapters/
        in/
        out/
      composition/
      tests/
  platform/
```

## Mapeamento atual para destino (módulo Usuários)

- `apps/backend-template/src/modules/Users/domain/*` atual -> destino `apps/backend-template/src/modules/users/domain/*`
- Atual `apps/backend-template/src/modules/Users/service/*` -> divisão:
  - orquestração de aplicativos -> `aplicativo/casos de uso/*`
  - lógica de domínio -> `domain/*` (quando aplicável)
- `apps/backend-template/src/modules/Users/interface/controller/*` atual -> `adapters/in/http/controllers/*`
- `apps/backend-template/src/modules/Users/interface/restapi/frameworks/*` atual -> `adapters/in/http/handlers/<framework>/*`
- `apps/backend-template/src/modules/Users/infra/repository/*` atual -> `adapters/out/persistence/*`
- `apps/backend-template/src/modules/Users/composition/*` atual -> `composition/*`

## Princípios de Migração

1. Nenhuma reescrita radical.
2. Mantenha o comportamento do tempo de execução inalterado em cada fase.
3. Use exportações de compatibilidade durante as transições.
4. Imponha limites na CI antes de grandes movimentos.
5. Prefira edições em nível de recurso local em vez de edições entre repositórios.

## Fases

### Fase 1 - Guardrails e namespaces canônicos
- Mantenha o comportamento atual.
- Introduzir pastas canônicas dentro de cada módulo:
  - `aplicação/casos de uso`
  - `adaptadores/in/http/controladores`
  - `adaptadores/saída/persistência`
- Adicione exportações de ponte para evitar quebrar as importações.
- Mantenha verificações de CI:
  - resolução de rota
  - verificações do ciclo principal
  - verificações de limites

Critérios concluídos:
- O módulo Usuários possui pastas canônicas e exportações de ponte.
- Sem alterações de tempo de execução.
- `ci:gate` verde.

### Fase 2 - Consolidação de entrada de aplicativos
- Mover dependências do controlador apenas para portas/casos de uso de aplicativos.
- Remova as importações diretas de implementação de serviço dos adaptadores de entrada.
- Mantenha a composição como ponto de ligação único.

Critérios concluídos:
- Os controladores chamam apenas contratos de aplicativos.
- Nenhum controlador faz referência a implementações de repositório/serviço.

### Fase 3 - Normalização da porta de saída
- Renomear interfaces de repositório para portas explícitas (nomeação `*Port`).
- Mover implementações de infra para `adapters/out/*`.
- Manter domínio/aplicação dependendo apenas das portas.

Critérios concluídos:
- As dependências de saída são orientadas pela interface.
- O infra é separado física e semanticamente.

### Fase 4 - Implementação módulo por módulo
- Repita a mesma estrutura para cada contexto limitado.
- Aplicar regras de nomenclatura e dependência de maneira uniforme.

Critérios concluídos:
- Todos os módulos seguem o mesmo layout hexagonal baseado em recursos.

## Critérios de aceitação não funcionais

- O escopo da correção de bugs deve permanecer principalmente dentro de:
  - um módulo de recursos,
  - um par de camadas (geralmente aplicativo + adaptador ou domínio + aplicativo),
  - uma pasta de teste local.
- Novos recursos não devem exigir refatoradores globais na fiação de infraestrutura/estrutura.
- O CI deve falhar rapidamente em:
  - violações de limites,
  - quebras de resolução de rota,
  - regressões de ciclo.

## Plano de Execução Imediata (próximos passos)

1. Crie pastas de adaptadores canônicos de usuários e exporte pontes.
2. Mova a implementação de `interface/controller` para `adapters/in/http/controllers` mantendo as reexportações compatíveis com versões anteriores.
3. Mova `infra/repository` para `adapters/out/persistence` mantendo as reexportações compatíveis com versões anteriores.
4. Atualize as importações de forma incremental e mantenha `ci:gate` verde após cada etapa.

## Instantâneo do progresso

- Concluído:
  - Namespaces canônicos criados para usuários (`adapters/in`, `adapters/out`, `application/use-cases`).
  - A fiação de tempo de execução agora resolve controladores do namespace do adaptador canônico em `RestAPI`.
  - A composição de usuários e as exportações de módulos agora usam namespaces canônicos de aplicativos/repositórios.
  - Os usuários do Lambda criam manipulador agora importa o controlador do caminho do adaptador canônico.
  - Implementação de `UserDataRepository` movida fisicamente para `adapters/out/persistence` com ponte de compatibilidade no caminho legado.
  - Arquivos de implementação do controlador movidos fisicamente de `interface/controller` para `adapters/in/http/controllers`.
  - Caminho de fallback do controlador legado `RestAPI` removido; o caminho do adaptador canônico agora é necessário.
- Restante:
  - Nenhum para o escopo da base de código atual (os usuários são totalmente migrados neste plano).
