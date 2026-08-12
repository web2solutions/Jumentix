import type { CanaFrameworkExample, CanaFrameworkExampleId } from './types';

const sharedCanaTs = `import { createClient, type CanaChangeEvent, type CanaSchema } from '@jumentix/cana';

export type TaskCategory = {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  updatedAt: number;
};

export type Task = {
  id: string;
  title: string;
  categoryId: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  notes?: string;
  createdAt: number;
  updatedAt: number;
};

export const taskSchema: CanaSchema = {
  version: 1,
  stores: [
    { name: 'categories', keyPath: 'id', indexes: [{ name: 'byName', keyPath: 'name', unique: true }] },
    {
      name: 'tasks',
      keyPath: 'id',
      indexes: [
        { name: 'byCategory', keyPath: 'categoryId' },
        { name: 'byCompleted', keyPath: 'completed' },
        { name: 'byUpdatedAt', keyPath: 'updatedAt' }
      ]
    }
  ]
};

export const cana = createClient({
  name: 'task-tutorial',
  schema: taskSchema,
  originId: 'task-ui',
  retainedEvents: 100
});

export async function openTasksDatabase() {
  await cana.open();
  return cana;
}

export function eventText(event: CanaChangeEvent) {
  return \`\${event.cursor}: \${event.type} \${event.store}/\${String(event.key ?? 'all')}\`;
}`;

const reactContextBasic = `import React, { createContext, useContext, useEffect, useReducer } from 'react';
import { cana, eventText, openTasksDatabase, type Task, type TaskCategory } from './cana';

type State = { categories: TaskCategory[]; tasks: Task[]; events: string[] };
type Action =
  | { type: 'loaded'; payload: Omit<State, 'events'> }
  | { type: 'cana-event'; event: any };

function reducer(state: State, action: Action): State {
  if (action.type === 'loaded') return { ...action.payload, events: [] };
  const { event } = action;
  const events = [...state.events, eventText(event)].slice(-8);
  if (event.store === 'categories' && event.record) {
    const next = state.categories.filter((item) => item.id !== event.record.id).concat(event.record);
    return { ...state, categories: next.sort((a, b) => a.name.localeCompare(b.name)), events };
  }
  if (event.store === 'tasks' && event.record) {
    const next = state.tasks.filter((item) => item.id !== event.record.id).concat(event.record);
    return { ...state, tasks: next.sort((a, b) => a.updatedAt - b.updatedAt), events };
  }
  return { ...state, events };
}

const TasksContext = createContext<{
  state: State;
  addTask(title: string, categoryId: string): Promise<void>;
  toggleTask(task: Task): Promise<void>;
} | null>(null);

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { categories: [], tasks: [], events: [] });

  useEffect(() => {
    let stop = () => {};
    void openTasksDatabase().then(async (client) => {
      dispatch({
        type: 'loaded',
        payload: {
          categories: [...await client.table<TaskCategory>('categories').query({ index: 'byName' })],
          tasks: [...await client.table<Task>('tasks').query({ index: 'byUpdatedAt' })]
        }
      });
      stop = client.subscribe((event) => dispatch({ type: 'cana-event', event }));
    });
    return () => stop();
  }, []);

  const api = {
    state,
    async addTask(title: string, categoryId: string) {
      const now = Date.now();
      await cana.table<Task>('tasks').add({
        id: crypto.randomUUID(),
        title,
        categoryId,
        completed: false,
        priority: 'medium',
        createdAt: now,
        updatedAt: now
      });
    },
    async toggleTask(task: Task) {
      await cana.table<Task>('tasks').update(task.id, {
        completed: !task.completed,
        updatedAt: Date.now()
      });
    }
  };

  return <TasksContext.Provider value={api}>{children}</TasksContext.Provider>;
}

export function useTasks() {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error('useTasks must be used inside TasksProvider');
  return ctx;
}`;

const reactContextAdvanced = `import { isCanaErrorCode, type CanaChangeEvent } from '@jumentix/cana';
import { cana, openTasksDatabase, type Task, type TaskCategory } from './cana';

let lastSeenCursor = Number(localStorage.getItem('tasks:lastCursor') ?? 0);
const ORIGIN_ID = 'task-ui';

export async function subscribeWithReplay(apply: (event: CanaChangeEvent) => void) {
  await openTasksDatabase();
  try {
    return cana.subscribe((event) => {
      // If you also apply optimistic UI patches, skip your own echo here.
      // This demo applies committed Cana events, so it records every event.
      apply(event);
      lastSeenCursor = event.cursor;
      localStorage.setItem('tasks:lastCursor', String(lastSeenCursor));
    }, { sinceCursor: lastSeenCursor });
  } catch (error) {
    if (isCanaErrorCode(error, 'NotFound')) {
      await reloadFromTables();
      return cana.subscribe(apply);
    }
    throw error;
  }
}

export async function createCategoryWithFirstTask(name: string, title: string) {
  await openTasksDatabase();
  const now = Date.now();
  const categoryId = name.toLowerCase().replace(/\\s+/g, '-');
  return cana.transaction('readwrite', ['categories', 'tasks'], async (scope) => {
    await scope.table<TaskCategory>('categories').put({
      id: categoryId,
      name,
      color: '#f97316',
      createdAt: now,
      updatedAt: now
    });
    await scope.table<Task>('tasks').put({
      id: crypto.randomUUID(),
      title,
      categoryId,
      completed: false,
      priority: 'high',
      createdAt: now,
      updatedAt: now
    });
  });
}

async function reloadFromTables() {
  const categories = await cana.table<TaskCategory>('categories').query({ index: 'byName' });
  const tasks = await cana.table<Task>('tasks').query({ index: 'byUpdatedAt' });
  return { categories, tasks };
}`;

const reduxBasic = `import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { cana, eventText, openTasksDatabase, type Task, type TaskCategory } from './cana';

const categories = createSlice({
  name: 'categories',
  initialState: [] as TaskCategory[],
  reducers: {
    upsert(state, action: PayloadAction<TaskCategory>) {
      const i = state.findIndex((item) => item.id === action.payload.id);
      if (i >= 0) state[i] = action.payload;
      else state.push(action.payload);
      state.sort((a, b) => a.name.localeCompare(b.name));
    }
  }
});

const tasks = createSlice({
  name: 'tasks',
  initialState: [] as Task[],
  reducers: {
    upsert(state, action: PayloadAction<Task>) {
      const i = state.findIndex((item) => item.id === action.payload.id);
      if (i >= 0) state[i] = action.payload;
      else state.push(action.payload);
      state.sort((a, b) => a.updatedAt - b.updatedAt);
    }
  }
});

const events = createSlice({
  name: 'events',
  initialState: [] as string[],
  reducers: { add: (state, action: PayloadAction<string>) => [...state, action.payload].slice(-8) }
});

export const store = configureStore({
  reducer: {
    categories: categories.reducer,
    tasks: tasks.reducer,
    events: events.reducer
  }
});

export async function startCanaListener() {
  const client = await openTasksDatabase();
  return client.subscribe((event) => {
    store.dispatch(events.actions.add(eventText(event)));
    if (event.store === 'categories' && event.record) {
      store.dispatch(categories.actions.upsert(event.record as TaskCategory));
    }
    if (event.store === 'tasks' && event.record) {
      store.dispatch(tasks.actions.upsert(event.record as Task));
    }
  });
}

export async function addTask(title: string, categoryId: string) {
  const now = Date.now();
  await cana.table<Task>('tasks').put({
    id: crypto.randomUUID(),
    title,
    categoryId,
    completed: false,
    priority: 'medium',
    createdAt: now,
    updatedAt: now
  });
}`;

const reduxAdvanced = `import { createAsyncThunk } from '@reduxjs/toolkit';
import { isCanaErrorCode, type CanaChangeEvent } from '@jumentix/cana';
import { cana, openTasksDatabase, type Task, type TaskCategory } from './cana';
import { store, applyCanaEvent, replaceAll, setCanaError } from './store';

let lastCursor = Number(localStorage.getItem('redux:lastCursor') ?? 0);

export async function attachCanaEvents() {
  await openTasksDatabase();
  try {
    return cana.subscribe((event: CanaChangeEvent) => {
      store.dispatch(applyCanaEvent(event));
      lastCursor = event.cursor;
      localStorage.setItem('redux:lastCursor', String(lastCursor));
    }, { sinceCursor: lastCursor });
  } catch (error) {
    if (isCanaErrorCode(error, 'NotFound')) {
      const [categories, tasks] = await Promise.all([
        cana.table<TaskCategory>('categories').query({ index: 'byName' }),
        cana.table<Task>('tasks').query({ index: 'byUpdatedAt' })
      ]);
      store.dispatch(replaceAll({ categories: [...categories], tasks: [...tasks] }));
      return cana.subscribe((event) => store.dispatch(applyCanaEvent(event)));
    }
    store.dispatch(setCanaError(error));
    throw error;
  }
}

export const createCategoryWithFirstTask = createAsyncThunk(
  'tasks/createCategoryWithFirstTask',
  async ({ name, title }: { name: string; title: string }) => {
    const now = Date.now();
    const categoryId = name.toLowerCase().replace(/\\s+/g, '-');
    const tx = await cana.transaction('readwrite', ['categories', 'tasks'], async (scope) => {
      await scope.table<TaskCategory>('categories').put({
        id: categoryId,
        name,
        color: '#7c3aed',
        createdAt: now,
        updatedAt: now
      });
      await scope.table<Task>('tasks').put({
        id: crypto.randomUUID(),
        title,
        categoryId,
        completed: false,
        priority: 'high',
        createdAt: now,
        updatedAt: now
      });
    });
    return { outcome: tx.outcome, correlationId: tx.correlationId };
  }
);`;

const vueBasic = `<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useTaskStore } from './stores/tasks';

const tasks = useTaskStore();
const grouped = computed(() => tasks.categories.map((category) => ({
  category,
  tasks: tasks.tasks.filter((task) => task.categoryId === category.id)
})));

let stop = () => {};
onMounted(async () => { stop = await tasks.init(); });
onUnmounted(() => stop());
</script>

<template>
  <section>
    <button @click="tasks.addTask('New Pinia task', 'work')">Add task through Cana</button>
    <article v-for="group in grouped" :key="group.category.id">
      <h3>{{ group.category.name }}</h3>
      <button v-for="task in group.tasks" :key="task.id" @click="tasks.toggle(task)">
        {{ task.completed ? 'Done: ' : '' }}{{ task.title }}
      </button>
    </article>
    <pre>{{ tasks.events.join('\\n') || 'No Cana events yet.' }}</pre>
  </section>
</template>`;

const vueStore = `import { defineStore } from 'pinia';
import { cana, eventText, openTasksDatabase, type Task, type TaskCategory } from '../cana';
import type { CanaChangeEvent } from '@jumentix/cana';

export const useTaskStore = defineStore('tasks', {
  state: () => ({
    categories: [] as TaskCategory[],
    tasks: [] as Task[],
    events: [] as string[]
  }),
  actions: {
    async init() {
      await openTasksDatabase();
      this.categories = [...await cana.table<TaskCategory>('categories').query({ index: 'byName' })];
      this.tasks = [...await cana.table<Task>('tasks').query({ index: 'byUpdatedAt' })];
      return cana.subscribe((event) => this.applyCanaEvent(event));
    },
    applyCanaEvent(event: CanaChangeEvent) {
      this.events = [...this.events, eventText(event)].slice(-8);
      if (event.store === 'categories' && event.record) {
        this.categories = this.categories.filter((item) => item.id !== event.record.id)
          .concat(event.record as TaskCategory)
          .sort((a, b) => a.name.localeCompare(b.name));
      }
      if (event.store === 'tasks' && event.record) {
        this.tasks = this.tasks.filter((item) => item.id !== event.record.id)
          .concat(event.record as Task)
          .sort((a, b) => a.updatedAt - b.updatedAt);
      }
    },
    async addTask(title: string, categoryId: string) {
      const now = Date.now();
      await cana.table<Task>('tasks').put({
        id: crypto.randomUUID(),
        title,
        categoryId,
        completed: false,
        priority: 'medium',
        createdAt: now,
        updatedAt: now
      });
    },
    async toggle(task: Task) {
      await cana.table<Task>('tasks').update(task.id, {
        completed: !task.completed,
        updatedAt: Date.now()
      });
    }
  }
});`;

const vueAdvanced = `import { isCanaErrorCode, type CanaChangeEvent } from '@jumentix/cana';
import { defineStore } from 'pinia';
import { cana, openTasksDatabase, type Task, type TaskCategory } from '../cana';

let lastCursor = Number(localStorage.getItem('pinia:lastCursor') ?? 0);

export const useAdvancedTaskStore = defineStore('advancedTasks', {
  state: () => ({
    categories: [] as TaskCategory[],
    tasks: [] as Task[],
    events: [] as string[],
    canaError: null as unknown
  }),
  actions: {
    async init() {
      await openTasksDatabase();
      try {
        return cana.subscribe((event) => this.applyEvent(event), { sinceCursor: lastCursor });
      } catch (error) {
        if (isCanaErrorCode(error, 'NotFound')) {
          await this.reload();
          return cana.subscribe((event) => this.applyEvent(event));
        }
        this.canaError = error;
        throw error;
      }
    },
    applyEvent(event: CanaChangeEvent) {
      lastCursor = event.cursor;
      localStorage.setItem('pinia:lastCursor', String(lastCursor));
      this.events = [...this.events, \`\${event.cursor}: \${event.type} \${event.store}\`].slice(-8);
      if (event.store === 'tasks' && event.record) {
        const record = event.record as Task;
        this.tasks = this.tasks.filter((task) => task.id !== record.id).concat(record);
      }
      if (event.store === 'categories' && event.record) {
        const record = event.record as TaskCategory;
        this.categories = this.categories.filter((category) => category.id !== record.id).concat(record);
      }
    },
    async reload() {
      this.categories = [...await cana.table<TaskCategory>('categories').query({ index: 'byName' })];
      this.tasks = [...await cana.table<Task>('tasks').query({ index: 'byUpdatedAt' })];
    },
    async createCategoryWithFirstTask(name: string, title: string) {
      const now = Date.now();
      const categoryId = name.toLowerCase().replace(/\\s+/g, '-');
      await cana.transaction('readwrite', ['categories', 'tasks'], async (scope) => {
        await scope.table<TaskCategory>('categories').put({
          id: categoryId,
          name,
          color: '#dc2626',
          createdAt: now,
          updatedAt: now
        });
        await scope.table<Task>('tasks').put({
          id: crypto.randomUUID(),
          title,
          categoryId,
          completed: false,
          priority: 'high',
          createdAt: now,
          updatedAt: now
        });
      });
    }
  }
});`;

export const CANA_FRAMEWORK_EXAMPLES: readonly CanaFrameworkExample[] = [
  {
    id: 'react-context-basic',
    framework: 'React Context',
    level: 'simple',
    title: {
      en: 'React Context: categorized task list',
      'pt-BR': 'React Context: lista de tarefas por categoria'
    },
    description: {
      en: 'A provider listens to committed Cana events and updates React reducer state.',
      'pt-BR': 'Um provider ouve eventos confirmados do Cana e atualiza o reducer do React.'
    },
    files: [
      { path: 'src/cana.ts', source: sharedCanaTs },
      { path: 'src/TasksProvider.tsx', source: reactContextBasic }
    ]
  },
  {
    id: 'react-context-advanced',
    framework: 'React Context',
    level: 'advanced',
    title: {
      en: 'React Context: transactions and replay',
      'pt-BR': 'React Context: transações e replay'
    },
    description: {
      en: 'Use one write transaction, keep a cursor, and recover when the replay window is gone.',
      'pt-BR': 'Use uma transação de escrita, mantenha cursor e recupere quando a janela de replay expirou.'
    },
    files: [
      { path: 'src/cana.ts', source: sharedCanaTs },
      { path: 'src/advancedCana.ts', source: reactContextAdvanced }
    ]
  },
  {
    id: 'react-redux-basic',
    framework: 'React Redux',
    level: 'simple',
    title: {
      en: 'React Redux: store updated by Cana events',
      'pt-BR': 'React Redux: store atualizado por eventos Cana'
    },
    description: {
      en: 'A Cana listener dispatches slice actions for category and task records.',
      'pt-BR': 'Um listener do Cana dispara actions dos slices de categorias e tarefas.'
    },
    files: [
      { path: 'src/cana.ts', source: sharedCanaTs },
      { path: 'src/store.ts', source: reduxBasic }
    ]
  },
  {
    id: 'react-redux-advanced',
    framework: 'React Redux',
    level: 'advanced',
    title: {
      en: 'React Redux: transaction thunk and replay',
      'pt-BR': 'React Redux: thunk transacional e replay'
    },
    description: {
      en: 'Redux Toolkit thunks write to Cana while subscriptions keep the store canonical.',
      'pt-BR': 'Thunks do Redux Toolkit escrevem no Cana enquanto subscriptions mantêm a store canônica.'
    },
    files: [
      { path: 'src/cana.ts', source: sharedCanaTs },
      { path: 'src/advancedStore.ts', source: reduxAdvanced }
    ]
  },
  {
    id: 'vue-pinia-basic',
    framework: 'Vue 3 + Pinia',
    level: 'simple',
    title: {
      en: 'Vue 3 + Pinia: store patched from Cana',
      'pt-BR': 'Vue 3 + Pinia: store atualizada pelo Cana'
    },
    description: {
      en: 'A Pinia store owns actions and patches state from CanaChangeEvent.',
      'pt-BR': 'Uma store Pinia possui actions e atualiza estado a partir de CanaChangeEvent.'
    },
    files: [
      { path: 'src/cana.ts', source: sharedCanaTs },
      { path: 'src/stores/tasks.ts', source: vueStore },
      { path: 'src/App.vue', source: vueBasic }
    ]
  },
  {
    id: 'vue-pinia-advanced',
    framework: 'Vue 3 + Pinia',
    level: 'advanced',
    title: {
      en: 'Vue 3 + Pinia: replay-safe transaction flow',
      'pt-BR': 'Vue 3 + Pinia: fluxo transacional com replay'
    },
    description: {
      en: 'Pinia records the last Cana cursor and reloads from tables when replay is unavailable.',
      'pt-BR': 'Pinia registra o último cursor do Cana e recarrega das tabelas quando o replay não está disponível.'
    },
    files: [
      { path: 'src/cana.ts', source: sharedCanaTs },
      { path: 'src/stores/advancedTasks.ts', source: vueAdvanced }
    ]
  }
];

export function getCanaFrameworkExample(
  id: CanaFrameworkExampleId
): CanaFrameworkExample | undefined {
  return CANA_FRAMEWORK_EXAMPLES.find((example) => example.id === id);
}
