# Cana com Vue 3 e Pinia

Construa o sistema de tarefas categorizadas com Vue 3 e Pinia. O Cana possui o
armazenamento durável no browser, enquanto o Pinia possui o estado reativo que
os componentes renderizam.

## 1. Comece do zero

```bash
bun create vite cana-vue-pinia --template vue-ts
cd cana-vue-pinia
bun add @jumentix/cana pinia
```

Registre Pinia em `main.ts`, crie `src/cana.ts` e então defina stores em
`src/stores`.

## 2. Implementação simples

A action simples `init()` abre o Cana, carrega as tabelas atuais e retorna a
função de unsubscribe de `client.subscribe`.

Componentes chamam actions da store:

- `tasks.addTask(title, categoryId)`
- `tasks.toggle(task)`

A store atualiza seus arrays a partir de `CanaChangeEvent`, então todo
componente que usa a store renderiza novamente com o estado confirmado no
storage.

<CanaFrameworkPlayground id="vue-pinia-basic" />

## 3. Implementação avançada

A store avançada mantém `lastCursor` em `localStorage`, assina com
`sinceCursor` e recarrega todas as tabelas quando o cursor de replay não está
mais disponível. Ela também grava categoria e primeira tarefa em uma transação
Cana.

Use `onUnmounted(() => stop())` em componentes ou lógica de teardown para que
views antigas não continuem aplicando eventos depois da navegação.

<CanaFrameworkPlayground id="vue-pinia-advanced" />

## 4. Formato final do app

```text
src/
  cana.ts
  main.ts
  App.vue
  stores/
    tasks.ts
    advancedTasks.ts
  components/
    CategoryColumn.vue
    TaskComposer.vue
```

Getters do Pinia devem conter visões derivadas, como tarefas por categoria, não
cópias duplicadas dos dados do Cana.

## 5. Checklist

- [ ] `createPinia()` é instalado antes dos componentes usarem stores.
- [ ] `init()` abre o Cana, carrega tabelas e então assina eventos.
- [ ] `onUnmounted` cancela listeners.
- [ ] Actions da store escrevem no Cana e estado atualiza por eventos confirmados.
- [ ] Fluxos avançados recarregam tabelas quando replay não está disponível.

## Próximo

Compare o mesmo modelo em [React Context](./react-context) e
[React Redux](./react-redux).
