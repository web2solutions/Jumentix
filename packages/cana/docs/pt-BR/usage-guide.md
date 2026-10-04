# Cana — Guia de uso

Hub focado para `@jumentix/cana`.

O Cana é um cliente IndexedDB agnóstico de framework para qualquer frontend no
navegador. Use quando a aplicação precisa de dados offline duráveis, transações
IndexedDB explícitas, eventos de mudança, isolamento opcional por worker e uma
ponte clara para a store de UI que você já usa (estado vanilla, React Context,
Redux, Pinia ou outra biblioteca).

Foi feito para o Jumentix, mas a API pública não depende de nenhum framework —
só do browser.

Esta página é intencionalmente curta. O guia completo foi dividido em páginas
menores para cada assunto mostrar código completo sem virar uma parede única.

## Escolha o próximo passo

1. [Primeiros passos](./getting-started.md) — instale o Cana, crie as tabelas
   `categories` e `tasks`, grave dados iniciais e leia tudo de volta.
2. [Integrar com qualquer framework](./any-framework.md) — padrão de wiring para qualquer store de UI.
3. [Vanilla TypeScript](./vanilla-typescript.md) — o mesmo app de tarefas sem framework.
4. [Schema e chaves](./schema-keys.md) — mudanças versionadas de schema, chaves
   inbound, chaves geradas, chaves outbound e validação.
5. [Leitura, escrita e operações em lote](./crud-bulk.md) — `get`, `add`, `put`,
   `update`, `delete`, `clear`, `bulkAdd`, `bulkPut` e tratamento previsível de
   falhas.
6. [Queries e planos](./querying.md) — índices, `equals`, `limit`, `offset`,
   `count`, `explain()` e complexidade.
7. [Transações e eventos de mudança](./transactions-events.md) — escritas
   atômicas, `CanaChangeEvent`, janelas de replay e sincronização com stores de
   UI.
8. [Hooks e erros](./hooks-errors.md) — `beforeWrite`, `afterCommit`, guards de
   `CanaError` e ramos comuns de recuperação.
9. [Storage e recuperação de crash](./storage-recovery.md) — avaliação de storage,
   avaliação de durabilidade, export/import e `resolveWrite()`.
10. [Workers e testes](./workers-testing.md) — `createWorkerHost()`,
    `createRouter()`, `createWorkerClient()` e estratégia de testes.
11. [Referência de API](./api-reference.md) — mapa compacto de métodos e glossário.

## O exemplo contínuo

Todas as páginas usam o mesmo sistema simples de tarefas. Existem duas stores:

| Store        | Propósito                      | Campos principais                                                              |
| ------------ | ------------------------------ | ------------------------------------------------------------------------------ |
| `categories` | Agrupa tarefas por área.       | `id`, `name`, `color`, `createdAt`, `updatedAt`                                |
| `tasks`      | Registros duráveis de tarefas. | `id`, `title`, `categoryId`, `completed`, `priority`, `createdAt`, `updatedAt` |

Os exemplos mantêm o estado de framework fora do Cana. O Cana controla
persistência e eventos commitados; sua store de UI (`Map` vanilla, Context,
Redux, Pinia, …) controla o estado renderizado.

## Política de código completo

Os blocos de código destas páginas são escritos como unidades de implementação
copiáveis. Quando um snippet pode executar no site, a página inclui um
playground com Run. Quando um snippet precisa de uma fronteira real de
aplicação, como um arquivo dedicado de Worker, a página mostra todos os arquivos
envolvidos em vez de esconder partes faltantes atrás de placeholders.

## Use com qualquer framework de UI

1. [Integrar com qualquer framework](./any-framework.md) — contrato estável e padrão de wiring em cinco passos.
2. [Tutorial Vanilla TypeScript](./vanilla-typescript.md) — sem helpers de framework; estado em DOM/`Map`.
3. [React Context API](/docs/pt-BR/jumentix/packages/cana/react-context)
4. [React Redux](/docs/pt-BR/jumentix/packages/cana/react-redux)
5. [Vue 3 e Pinia](/docs/pt-BR/jumentix/packages/cana/vue-pinia)

Os helpers opcionais (`@jumentix/cana-react`, `@jumentix/cana-vue`) só atualizam o estado do framework por você; não são obrigatórios.

## Integrações de pacote

Use os pequenos pacotes de integração quando quiser que eventos do Cana
atualizem o estado do framework diretamente:

```bash
bun add @jumentix/cana @jumentix/cana-react
bun add @jumentix/cana @jumentix/cana-vue
```
