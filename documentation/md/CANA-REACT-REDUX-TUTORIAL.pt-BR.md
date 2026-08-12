# Cana com React Redux

Construa o mesmo sistema de tarefas categorizadas com Redux Toolkit. O Cana
continua sendo a fonte offline durável, e o Redux vira o cache de renderização
que recebe eventos confirmados do Cana.

## 1. Comece do zero

```bash
bun create vite cana-react-redux --template react-ts
cd cana-react-redux
bun add @jumentix/cana @jumentix/cana-react @reduxjs/toolkit react-redux
```

O schema é o mesmo do tutorial com Context: `categorias` e `tarefas`, com indexes
por nome, categoria, estado concluído e atualização.

## 2. Implementação simples

Crie slices para `categories`, `tasks` e `events`. As actions de escrita ainda
gravam no Cana. O listener é quem mantém o Redux atualizado:

```ts
const stop = client.subscribe((event) => {
  store.dispatch(applyCanaEvent(event));
});
```

Assim a regra fica simples: Redux renderiza o que o Cana confirmou. Cliques em
botões não mudam a store diretamente, a menos que você adicione UI otimista de
propósito.

<CanaFrameworkPlayground id="react-redux-basic" />

## 3. Implementação avançada

A versão avançada com Redux adiciona:

- um thunk que grava categoria e primeira tarefa em uma transação Cana;
- um listener que dispara `applyCanaEvent`;
- um `lastCursor` armazenado;
- replay com `subscribe(..., { sinceCursor })`;
- fallback de reload quando o Cana retorna `NotFound` para cursor antigo;
- um slice de erro que guarda dados planos de `CanaError`.

Esse padrão escala bem porque reducers continuam determinísticos enquanto thunks
controlam efeitos colaterais.

<CanaFrameworkPlayground id="react-redux-advanced" />

## 4. Formato final do app

```text
src/
  cana.ts
  store.ts
  App.tsx
```

Use selectors para visões derivadas:

- tarefas por categoria;
- tarefas pendentes;
- alterações recentes vindas de `events`.

Baixe o app Vite completo usado pelo exemplo avançado:
[cana-react-redux.zip](/downloads/cana/cana-react-redux.zip).

## 5. Checklist

- [ ] Inicialização da store carrega as tabelas Cana uma vez.
- [ ] `client.subscribe` dispara updates por registro.
- [ ] Thunks escrevem no Cana, reducers atualizam por eventos confirmados.
- [ ] Resultados de transação são verificados antes de mostrar sucesso.
- [ ] Lacunas de replay recarregam as tabelas canônicas.

## Próximo

Use [React Context](./react-context) quando a superfície de estado for pequena.
Use [Vue 3 + Pinia](./vue-pinia) para construir o mesmo padrão offline em Vue.
