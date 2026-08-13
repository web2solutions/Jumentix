import type { CanaFrameworkExample, CanaFrameworkExampleId } from './types';

const canaTs = `import { createClient, type CanaChangeEvent, type CanaSchema } from '@jumentix/cana';

export type Category = {
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
  name: 'tutorial-cana-tasks',
  schema: taskSchema,
  originId: 'tasks-ui',
  retainedEvents: 100
});

export async function openTaskDatabase() {
  await cana.open();
  return cana;
}

export async function loadAll() {
  const [categories, tasks] = await Promise.all([
    cana.table<Category>('categories').query({ index: 'byName' }),
    cana.table<Task>('tasks').query({ index: 'byUpdatedAt' })
  ]);
  return { categories: [...categories], tasks: [...tasks] };
}

export async function seedInitialData() {
  await openTaskDatabase();
  if (await cana.table<Category>('categories').count()) return;
  const now = Date.now();
  await cana.transaction('readwrite', ['categories', 'tasks'], async (scope) => {
    await scope.table<Category>('categories').bulkAdd([
      { id: 'work', name: 'Work', color: '#2563eb', createdAt: now, updatedAt: now },
      { id: 'home', name: 'Home', color: '#16a34a', createdAt: now, updatedAt: now }
    ]);
    await scope.table<Task>('tasks').bulkAdd([
      {
        id: 'task-1',
        title: 'Write the Cana tutorial',
        categoryId: 'work',
        completed: false,
        priority: 'high',
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'task-2',
        title: 'Review category filters',
        categoryId: 'home',
        completed: true,
        priority: 'medium',
        createdAt: now,
        updatedAt: now
      }
    ]);
  });
}

export function formatEvent(event: CanaChangeEvent) {
  return event.cursor + ': ' + event.type + ' ' + event.store + '/' + String(event.key ?? 'all');
}`;

const reactStylesCss = `body {
  margin: 0;
  font-family: Inter, system-ui, sans-serif;
  background: #f8fafc;
  color: #0f172a;
}

button {
  cursor: pointer;
}

.app {
  max-width: 960px;
  margin: 0 auto;
  padding: 32px;
}

.toolbar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 16px 0;
}

.board {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.category {
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  padding: 16px;
  background: white;
}

.task {
  display: block;
  width: 100%;
  margin-top: 8px;
  border: 1px solid #dbe3ef;
  border-radius: 6px;
  padding: 8px;
  text-align: left;
  background: #f8fafc;
}

.events {
  margin-top: 16px;
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  padding: 12px;
  background: #0f172a;
  color: #dbeafe;
  white-space: pre-wrap;
}`;

const reactMainTsx = `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;

const reactContextPackageJson = `{
  "name": "cana-react-context-tasks",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@jumentix/cana": "^0.1.0",
    "@jumentix/cana-react": "^0.1.0",
    "@vitejs/plugin-react": "^5.1.2",
    "typescript": "^6.0.3",
    "vite": "^7.2.7",
    "react": "^19.2.8",
    "react-dom": "^19.2.8"
  },
  "devDependencies": {
    "@types/react": "^19.2.18",
    "@types/react-dom": "^19.2.4"
  }
}`;

const reactReduxPackageJson = `{
  "name": "cana-react-redux-tasks",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@jumentix/cana": "^0.1.0",
    "@jumentix/cana-react": "^0.1.0",
    "@reduxjs/toolkit": "^2.12.0",
    "@vitejs/plugin-react": "^5.1.2",
    "typescript": "^6.0.3",
    "vite": "^7.2.7",
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "react-redux": "^9.3.0"
  },
  "devDependencies": {
    "@types/react": "^19.2.18",
    "@types/react-dom": "^19.2.4"
  }
}`;

const vuePackageJson = `{
  "name": "cana-vue-pinia-tasks",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@jumentix/cana": "^0.1.0",
    "@jumentix/cana-vue": "^0.1.0",
    "@vitejs/plugin-vue": "^6.0.5",
    "pinia": "^4.0.3",
    "typescript": "^6.0.3",
    "vite": "^7.2.7",
    "vue": "^3.5.41",
    "vue-tsc": "^3.1.8"
  }
}`;

const viteReactConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()]
});`;

const viteVueConfig = `import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()]
});`;

const indexHtml = `<div id="root"></div>
<script type="module" src="/src/main.tsx"></script>`;

const vueIndexHtml = `<div id="app"></div>
<script type="module" src="/src/main.ts"></script>`;

const reactTsconfig = `{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["vite/client"],
    "jsx": "react-jsx"
  },
  "include": ["src"]
}`;

const vueTsconfig = `{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "types": ["vite/client"]
  },
  "include": ["src/**/*.ts", "src/**/*.vue"]
}`;

const viteEnvDts = `/// <reference types="vite/client" />
`;

const reactContextProvider = `import React, { createContext, useContext, useEffect, useReducer, useState } from 'react';
import { applyCanaEventToRecords, useCanaSubscription } from '@jumentix/cana-react';
import { cana, loadAll, seedInitialData, formatEvent, type Category, type Task } from './cana';

type State = { categories: Category[]; tasks: Task[]; events: string[] };
type Action =
  | { type: 'loaded'; payload: Omit<State, 'events'> }
  | { type: 'event'; event: Parameters<typeof formatEvent>[0] };

function reducer(state: State, action: Action): State {
  if (action.type === 'loaded') return { ...action.payload, events: [] };
  const event = action.event;
  return {
    categories: applyCanaEventToRecords(state.categories, event, {
      store: 'categories',
      getKey: (category) => category.id,
      sort: (a, b) => a.name.localeCompare(b.name)
    }),
    tasks: applyCanaEventToRecords(state.tasks, event, {
      store: 'tasks',
      getKey: (task) => task.id,
      sort: (a, b) => a.updatedAt - b.updatedAt
    }),
    events: [...state.events, formatEvent(event)].slice(-8)
  };
}

const TasksContext = createContext<{
  state: State;
  addTask(title: string, categoryId: string): Promise<void>;
  toggleTask(task: Task): Promise<void>;
} | null>(null);

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [state, dispatch] = useReducer(reducer, { categories: [], tasks: [], events: [] });

  useEffect(() => {
    let alive = true;
    void seedInitialData()
      .then(loadAll)
      .then((payload) => {
        if (!alive) return;
        dispatch({ type: 'loaded', payload });
        setReady(true);
      });
    return () => { alive = false; };
  }, []);

  useCanaSubscription(ready ? cana : null, (event) => {
    dispatch({ type: 'event', event });
  });

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
  if (!ctx) throw new Error('useTasks must run inside TasksProvider');
  return ctx;
}`;

const reactContextApp = `import { TasksProvider, useTasks } from './TasksProvider';

function TaskBoardExample() {
  const { state, addTask, toggleTask } = useTasks();
  const groups = state.categories.map((category) => ({
    category,
    tasks: state.tasks.filter((task) => task.categoryId === category.id)
  }));

  return (
    <main className="app">
      <h1>Cana + React Context</h1>
      <div className="toolbar">
        <button onClick={() => void addTask('New work task', 'work')}>
          Add task
        </button>
      </div>
      <section className="board">
        {groups.map(({ category, tasks }) => (
          <article className="category" key={category.id}>
            <h2>{category.name}</h2>
            {tasks.map((task) => (
              <button className="task" key={task.id} onClick={() => void toggleTask(task)}>
                {task.completed ? 'Done: ' : ''}{task.title}
              </button>
            ))}
          </article>
        ))}
      </section>
      <pre className="events">{state.events.join('\\n') || 'No events yet.'}</pre>
    </main>
  );
}

export default function App() {
  return (
    <TasksProvider>
      <TaskBoardExample />
    </TasksProvider>
  );
}`;

const reactContextAdvanced = `import { isCanaErrorCode, type CanaChangeEvent } from '@jumentix/cana';
import { cana, loadAll, type Category, type Task } from './cana';

let lastCursor = Number(localStorage.getItem('tasks:lastCursor') ?? 0);

export async function subscribeWithReplay(
  apply: (event: CanaChangeEvent) => void,
  reload: () => Promise<void>
) {
  const rememberAndApply = (event: CanaChangeEvent) => {
    apply(event);
    lastCursor = event.cursor;
    localStorage.setItem('tasks:lastCursor', String(lastCursor));
  };
  try {
    return cana.subscribe(rememberAndApply, { sinceCursor: lastCursor });
  } catch (error) {
    if (isCanaErrorCode(error, 'NotFound')) {
      lastCursor = 0;
      localStorage.setItem('tasks:lastCursor', '0');
      await reload();
      return cana.subscribe(rememberAndApply);
    }
    throw error;
  }
}

export async function createCategoryWithFirstTask(name: string, title: string) {
  const now = Date.now();
  const categoryId = name.toLowerCase().replace(/\\s+/g, '-');
  return cana.transaction('readwrite', ['categories', 'tasks'], async (scope) => {
    await scope.table<Category>('categories').put({
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
}`;

const reactContextAdvancedProvider = `import React, { createContext, useContext, useEffect, useReducer, useState } from 'react';
import { applyCanaEventToRecords } from '@jumentix/cana-react';
import { cana, loadAll, seedInitialData, formatEvent, type Category, type Task } from './cana';
import { subscribeWithReplay } from './advancedCana';

type State = { categories: Category[]; tasks: Task[]; events: string[] };
type Action =
  | { type: 'loaded'; payload: Omit<State, 'events'> }
  | { type: 'event'; event: Parameters<typeof formatEvent>[0] };

function reducer(state: State, action: Action): State {
  if (action.type === 'loaded') return { ...action.payload, events: state.events };
  const event = action.event;
  return {
    categories: applyCanaEventToRecords(state.categories, event, {
      store: 'categories',
      getKey: (category) => category.id,
      sort: (a, b) => a.name.localeCompare(b.name)
    }),
    tasks: applyCanaEventToRecords(state.tasks, event, {
      store: 'tasks',
      getKey: (task) => task.id,
      sort: (a, b) => a.updatedAt - b.updatedAt
    }),
    events: [...state.events, formatEvent(event)].slice(-8)
  };
}

const TasksContext = createContext<{
  state: State;
  addTask(title: string, categoryId: string): Promise<void>;
  toggleTask(task: Task): Promise<void>;
} | null>(null);

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [state, dispatch] = useReducer(reducer, { categories: [], tasks: [], events: [] });

  async function reloadState() {
    dispatch({ type: 'loaded', payload: await loadAll() });
  }

  useEffect(() => {
    let alive = true;
    void seedInitialData()
      .then(loadAll)
      .then((payload) => {
        if (!alive) return;
        dispatch({ type: 'loaded', payload });
        setReady(true);
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!ready) return undefined;
    let stop: (() => void) | undefined;
    let active = true;
    void subscribeWithReplay(
      (event) => dispatch({ type: 'event', event }),
      reloadState
    ).then((cleanup) => {
      if (active) stop = cleanup;
      else cleanup();
    });
    return () => {
      active = false;
      stop?.();
    };
  }, [ready]);

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
  if (!ctx) throw new Error('useTasks must run inside TasksProvider');
  return ctx;
}`;

const reactContextAdvancedApp = `import { createCategoryWithFirstTask } from './advancedCana';
import { TasksProvider, useTasks } from './TasksProvider';

function AdvancedTaskBoard() {
  const { state, addTask, toggleTask } = useTasks();
  const groups = state.categories.map((category) => ({
    category,
    tasks: state.tasks.filter((task) => task.categoryId === category.id)
  }));

  return (
    <main className="app">
      <h1>Cana + React Context advanced</h1>
      <div className="toolbar">
        <button onClick={() => void addTask('Standalone task', 'work')}>Add task</button>
        <button onClick={() => void createCategoryWithFirstTask('Operations', 'Created in the same transaction')}>
          Create category + task
        </button>
      </div>
      <section className="board">
        {groups.map(({ category, tasks }) => (
          <article className="category" key={category.id}>
            <h2>{category.name}</h2>
            {tasks.map((task) => (
              <button className="task" key={task.id} onClick={() => void toggleTask(task)}>
                {task.completed ? 'Done: ' : ''}{task.title}
              </button>
            ))}
          </article>
        ))}
      </section>
      <pre className="events">{state.events.join('\\n') || 'No events yet.'}</pre>
    </main>
  );
}

export default function App() {
  return (
    <TasksProvider>
      <AdvancedTaskBoard />
    </TasksProvider>
  );
}`;

const reduxStoreBasic = `import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { CanaChangeEvent } from '@jumentix/cana';
import { connectCanaToRedux } from '@jumentix/cana-react/redux';
import { cana, loadAll, seedInitialData, formatEvent, type Category, type Task } from './cana';

type State = { categories: Category[]; tasks: Task[]; events: string[] };

function upsert<T extends { id: string }>(records: T[], record: T) {
  const next = records.filter((item) => item.id !== record.id).concat(record);
  return next;
}

const slice = createSlice({
  name: 'tasks',
  initialState: { categories: [], tasks: [], events: [] } as State,
  reducers: {
    replaceAll(_state, action: PayloadAction<{ categories: Category[]; tasks: Task[] }>) {
      return { categories: action.payload.categories, tasks: action.payload.tasks, events: [] };
    },
    applyCanaEvent(state, action: PayloadAction<CanaChangeEvent>) {
      const event = action.payload;
      state.events = [...state.events, formatEvent(event)].slice(-8);
      if (event.store === 'categories' && event.record) {
        state.categories = upsert(state.categories, event.record as Category)
          .sort((a, b) => a.name.localeCompare(b.name));
      }
      if (event.store === 'tasks' && event.record) {
        state.tasks = upsert(state.tasks, event.record as Task)
          .sort((a, b) => a.updatedAt - b.updatedAt);
      }
    }
  }
});

export const { applyCanaEvent, replaceAll } = slice.actions;

export const store = configureStore({ reducer: slice.reducer });
export type RootState = ReturnType<typeof store.getState>;

export async function startCanaRedux() {
  await seedInitialData();
  store.dispatch(replaceAll(await loadAll()));
  const bridge = connectCanaToRedux({
    client: cana,
    dispatch: store.dispatch,
    mapEvent: (event) => applyCanaEvent(event)
  });
  return bridge.stop;
}

export async function addTask(title: string, categoryId: string) {
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
}

export async function toggleTask(task: Task) {
  await cana.table<Task>('tasks').update(task.id, {
    completed: !task.completed,
    updatedAt: Date.now()
  });
}`;

const reduxApp = `import { useEffect } from 'react';
import { Provider, useSelector } from 'react-redux';
import { addTask, toggleTask, startCanaRedux, store, type RootState } from './store';

function ReduxTaskBoard() {
  const { categories, tasks, events } = useSelector((state: RootState) => state);

  useEffect(() => {
    let stop = () => {};
    void startCanaRedux().then((cleanup) => { stop = cleanup; });
    return () => stop();
  }, []);

  return (
    <main className="app">
      <h1>Cana + React Redux</h1>
      <div className="toolbar">
        <button onClick={() => void addTask('New Redux task', 'work')}>Add task</button>
      </div>
      <section className="board">
        {categories.map((category) => (
          <article className="category" key={category.id}>
            <h2>{category.name}</h2>
            {tasks.filter((task) => task.categoryId === category.id).map((task) => (
              <button className="task" key={task.id} onClick={() => void toggleTask(task)}>
                {task.completed ? 'Done: ' : ''}{task.title}
              </button>
            ))}
          </article>
        ))}
      </section>
      <pre className="events">{events.join('\\n') || 'No events yet.'}</pre>
    </main>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <ReduxTaskBoard />
    </Provider>
  );
}`;

const reduxStoreAdvanced = `import { configureStore, createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { isCanaErrorCode, type CanaChangeEvent } from '@jumentix/cana';
import { connectCanaToRedux } from '@jumentix/cana-react/redux';
import { cana, loadAll, seedInitialData, formatEvent, type Category, type Task } from './cana';

type State = { categories: Category[]; tasks: Task[]; events: string[]; canaError: unknown };
let lastCursor = Number(localStorage.getItem('redux:lastCursor') ?? 0);

function upsert<T extends { id: string }>(records: T[], record: T) {
  return records.filter((item) => item.id !== record.id).concat(record);
}

const slice = createSlice({
  name: 'tasks',
  initialState: { categories: [], tasks: [], events: [], canaError: null } as State,
  reducers: {
    replaceAll(state, action: PayloadAction<{ categories: Category[]; tasks: Task[] }>) {
      state.categories = action.payload.categories;
      state.tasks = action.payload.tasks;
    },
    setCanaError(state, action: PayloadAction<unknown>) {
      state.canaError = action.payload;
    },
    applyCanaEvent(state, action: PayloadAction<CanaChangeEvent>) {
      const event = action.payload;
      lastCursor = event.cursor;
      localStorage.setItem('redux:lastCursor', String(lastCursor));
      state.events = [...state.events, formatEvent(event)].slice(-8);
      if (event.store === 'categories' && event.record) {
        state.categories = upsert(state.categories, event.record as Category)
          .sort((a, b) => a.name.localeCompare(b.name));
      }
      if (event.store === 'tasks' && event.record) {
        state.tasks = upsert(state.tasks, event.record as Task)
          .sort((a, b) => a.updatedAt - b.updatedAt);
      }
    }
  }
});

export const { applyCanaEvent, replaceAll, setCanaError } = slice.actions;
export const store = configureStore({ reducer: slice.reducer });
export type RootState = ReturnType<typeof store.getState>;

export async function startCanaReduxWithReplay() {
  await seedInitialData();
  store.dispatch(replaceAll(await loadAll()));
  try {
    const bridge = connectCanaToRedux({
      client: cana,
      dispatch: store.dispatch,
      sinceCursor: lastCursor,
      mapEvent: (event) => applyCanaEvent(event)
    });
    return bridge.stop;
  } catch (error) {
    if (isCanaErrorCode(error, 'NotFound')) {
      store.dispatch(replaceAll(await loadAll()));
      const bridge = connectCanaToRedux({
        client: cana,
        dispatch: store.dispatch,
        mapEvent: (event) => applyCanaEvent(event)
      });
      return bridge.stop;
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
    return cana.transaction('readwrite', ['categories', 'tasks'], async (scope) => {
      await scope.table<Category>('categories').put({
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
  }
);

export async function addTask(title: string, categoryId: string) {
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
}

export async function toggleTask(task: Task) {
  await cana.table<Task>('tasks').update(task.id, {
    completed: !task.completed,
    updatedAt: Date.now()
  });
}`;

const reduxAdvancedApp = `import { useEffect } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import {
  addTask,
  toggleTask,
  createCategoryWithFirstTask,
  startCanaReduxWithReplay,
  store,
  type RootState
} from './store';

function AdvancedReduxBoard() {
  const dispatch = useDispatch<typeof store.dispatch>();
  const { categories, tasks, events } = useSelector((state: RootState) => state);

  useEffect(() => {
    let stop = () => {};
    void startCanaReduxWithReplay().then((cleanup) => { stop = cleanup; });
    return () => stop();
  }, []);

  return (
    <main className="app">
      <h1>Cana + React Redux advanced</h1>
      <div className="toolbar">
        <button onClick={() => void addTask('New Redux task', 'work')}>Add task</button>
        <button onClick={() => void dispatch(createCategoryWithFirstTask({
          name: 'Release',
          title: 'Created in one transaction'
        }))}>
          Create category + task
        </button>
      </div>
      <section className="board">
        {categories.map((category) => (
          <article className="category" key={category.id}>
            <h2>{category.name}</h2>
            {tasks.filter((task) => task.categoryId === category.id).map((task) => (
              <button className="task" key={task.id} onClick={() => void toggleTask(task)}>
                {task.completed ? 'Done: ' : ''}{task.title}
              </button>
            ))}
          </article>
        ))}
      </section>
      <pre className="events">{events.join('\\n') || 'No events yet.'}</pre>
    </main>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <AdvancedReduxBoard />
    </Provider>
  );
}`;

const vueMainTs = `import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './styles.css';

createApp(App).use(createPinia()).mount('#app');`;

const vueStylesCss = reactStylesCss;

const vueStoreBasic = `import { defineStore } from 'pinia';
import { applyCanaEventToRecords, connectCanaToPinia } from '@jumentix/cana-vue';
import { cana, loadAll, seedInitialData, formatEvent, type Category, type Task } from '../cana';

export const useTasksStore = defineStore('tasks', {
  state: () => ({
    categories: [] as Category[],
    tasks: [] as Task[],
    events: [] as string[]
  }),
  getters: {
    byCategory: (state) => (categoryId: string) =>
      state.tasks.filter((task) => task.categoryId === categoryId)
  },
  actions: {
    async init() {
      await seedInitialData();
      Object.assign(this, await loadAll());
      const bridge = connectCanaToPinia({
        client: cana,
        apply: (event) => this.applyEvent(event)
      });
      return bridge.stop;
    },
    applyEvent(event: Parameters<typeof formatEvent>[0]) {
      this.events = [...this.events, formatEvent(event)].slice(-8);
      this.categories = applyCanaEventToRecords(this.categories, event, {
        store: 'categories',
        getKey: (category) => category.id,
        sort: (a, b) => a.name.localeCompare(b.name)
      });
      this.tasks = applyCanaEventToRecords(this.tasks, event, {
        store: 'tasks',
        getKey: (task) => task.id,
        sort: (a, b) => a.updatedAt - b.updatedAt
      });
    },
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
  }
});`;

const vueAppBasic = `<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useTasksStore } from './stores/tasks';

const tasks = useTasksStore();
let stop = () => {};

onMounted(async () => {
  stop = await tasks.init();
});
onUnmounted(() => stop());
</script>

<template>
  <main class="app">
    <h1>Cana + Vue 3 + Pinia</h1>
    <div class="toolbar">
      <button @click="tasks.addTask('New Pinia task', 'work')">Add task</button>
    </div>
    <section class="board">
      <article v-for="category in tasks.categories" :key="category.id" class="category">
        <h2>{{ category.name }}</h2>
        <button
          v-for="task in tasks.byCategory(category.id)"
          :key="task.id"
          class="task"
          @click="tasks.toggleTask(task)"
        >
          {{ task.completed ? 'Done: ' : '' }}{{ task.title }}
        </button>
      </article>
    </section>
    <pre class="events">{{ tasks.events.join('\\n') || 'No events yet.' }}</pre>
  </main>
</template>`;

const vueStoreAdvanced = `import { defineStore } from 'pinia';
import { isCanaErrorCode } from '@jumentix/cana';
import { applyCanaEventToRecords, connectCanaToPinia } from '@jumentix/cana-vue';
import { cana, loadAll, seedInitialData, formatEvent, type Category, type Task } from '../cana';

let lastCursor = Number(localStorage.getItem('pinia:lastCursor') ?? 0);

export const useTasksStore = defineStore('advancedTasks', {
  state: () => ({
    categories: [] as Category[],
    tasks: [] as Task[],
    events: [] as string[],
    canaError: null as unknown
  }),
  getters: {
    byCategory: (state) => (categoryId: string) =>
      state.tasks.filter((task) => task.categoryId === categoryId)
  },
  actions: {
    async init() {
      await seedInitialData();
      Object.assign(this, await loadAll());
      try {
        const bridge = connectCanaToPinia({
          client: cana,
          sinceCursor: lastCursor,
          apply: (event) => this.applyEvent(event)
        });
        return bridge.stop;
      } catch (error) {
        if (isCanaErrorCode(error, 'NotFound')) {
          Object.assign(this, await loadAll());
          const bridge = connectCanaToPinia({
            client: cana,
            apply: (event) => this.applyEvent(event)
          });
          return bridge.stop;
        }
        this.canaError = error;
        throw error;
      }
    },
    applyEvent(event: Parameters<typeof formatEvent>[0]) {
      lastCursor = event.cursor;
      localStorage.setItem('pinia:lastCursor', String(lastCursor));
      this.events = [...this.events, formatEvent(event)].slice(-8);
      this.categories = applyCanaEventToRecords(this.categories, event, {
        store: 'categories',
        getKey: (category) => category.id,
        sort: (a, b) => a.name.localeCompare(b.name)
      });
      this.tasks = applyCanaEventToRecords(this.tasks, event, {
        store: 'tasks',
        getKey: (task) => task.id,
        sort: (a, b) => a.updatedAt - b.updatedAt
      });
    },
    async createCategoryWithFirstTask(name: string, title: string) {
      const now = Date.now();
      const categoryId = name.toLowerCase().replace(/\\s+/g, '-');
      await cana.transaction('readwrite', ['categories', 'tasks'], async (scope) => {
        await scope.table<Category>('categories').put({
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
    },
    async toggleTask(task: Task) {
      await cana.table<Task>('tasks').update(task.id, {
        completed: !task.completed,
        updatedAt: Date.now()
      });
    }
  }
});`;

const vueAppAdvanced = `<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useTasksStore } from './stores/advancedTasks';

const tasks = useTasksStore();
let stop = () => {};

onMounted(async () => {
  stop = await tasks.init();
});
onUnmounted(() => stop());
</script>

<template>
  <main class="app">
    <h1>Cana + Vue 3 + Pinia advanced</h1>
    <div class="toolbar">
      <button @click="tasks.createCategoryWithFirstTask('QA', 'Created in one transaction')">
        Create category + task
      </button>
    </div>
    <section class="board">
      <article v-for="category in tasks.categories" :key="category.id" class="category">
        <h2>{{ category.name }}</h2>
        <button
          v-for="task in tasks.byCategory(category.id)"
          :key="task.id"
          class="task"
          @click="tasks.toggleTask(task)"
        >
          {{ task.completed ? 'Done: ' : '' }}{{ task.title }}
        </button>
      </article>
    </section>
    <pre class="events">{{ tasks.events.join('\\n') || 'No events yet.' }}</pre>
  </main>
</template>`;

const download = {
  reactContext: {
    href: '/downloads/cana/cana-react-context.zip',
    label: { en: 'Download app', 'pt-BR': 'Baixar app' }
  },
  reactRedux: {
    href: '/downloads/cana/cana-react-redux.zip',
    label: { en: 'Download app', 'pt-BR': 'Baixar app' }
  },
  vuePinia: {
    href: '/downloads/cana/cana-vue-pinia.zip',
    label: { en: 'Download app', 'pt-BR': 'Baixar app' }
  }
};

export const CANA_FRAMEWORK_EXAMPLES: readonly CanaFrameworkExample[] = [
  {
    id: 'react-context-basic',
    framework: 'React Context',
    level: 'simple',
    title: {
      en: 'React Context: Category and Task tables',
      'pt-BR': 'React Context: tabelas Category e Task'
    },
    description: {
      en: 'A provider listens to committed Cana events and updates reducer state.',
      'pt-BR': 'Um provider ouve eventos confirmados do Cana e atualiza o reducer.'
    },
    download: download.reactContext,
    files: [
      { path: 'package.json', source: reactContextPackageJson },
      { path: 'tsconfig.json', source: reactTsconfig },
      { path: 'index.html', source: indexHtml },
      { path: 'vite.config.ts', source: viteReactConfig },
      { path: 'src/vite-env.d.ts', source: viteEnvDts },
      { path: 'src/cana.ts', source: canaTs },
      { path: 'src/TasksProvider.tsx', source: reactContextProvider },
      { path: 'src/App.tsx', source: reactContextApp },
      { path: 'src/main.tsx', source: reactMainTsx },
      { path: 'src/styles.css', source: reactStylesCss }
    ]
  },
  {
    id: 'react-context-advanced',
    framework: 'React Context',
    level: 'advanced',
    title: {
      en: 'React Context: replay and transaction flow',
      'pt-BR': 'React Context: replay e fluxo transacional'
    },
    description: {
      en: 'The app keeps the same tables and adds replay recovery plus one multi-store transaction.',
      'pt-BR': 'A app mantem as mesmas tabelas e adiciona replay e uma transacao multi-store.'
    },
    download: download.reactContext,
    files: [
      { path: 'package.json', source: reactContextPackageJson },
      { path: 'tsconfig.json', source: reactTsconfig },
      { path: 'index.html', source: indexHtml },
      { path: 'vite.config.ts', source: viteReactConfig },
      { path: 'src/vite-env.d.ts', source: viteEnvDts },
      { path: 'src/cana.ts', source: canaTs },
      { path: 'src/TasksProvider.tsx', source: reactContextAdvancedProvider },
      { path: 'src/advancedCana.ts', source: reactContextAdvanced },
      { path: 'src/App.tsx', source: reactContextAdvancedApp },
      { path: 'src/main.tsx', source: reactMainTsx },
      { path: 'src/styles.css', source: reactStylesCss }
    ]
  },
  {
    id: 'react-redux-basic',
    framework: 'React Redux',
    level: 'simple',
    title: {
      en: 'React Redux: store updated by Cana events',
      'pt-BR': 'React Redux: store atualizada por eventos Cana'
    },
    description: {
      en: 'Redux renders the cache; Cana remains the durable source of truth.',
      'pt-BR': 'Redux renderiza o cache; Cana continua sendo a fonte duravel.'
    },
    download: download.reactRedux,
    files: [
      { path: 'package.json', source: reactReduxPackageJson },
      { path: 'tsconfig.json', source: reactTsconfig },
      { path: 'index.html', source: indexHtml },
      { path: 'vite.config.ts', source: viteReactConfig },
      { path: 'src/vite-env.d.ts', source: viteEnvDts },
      { path: 'src/cana.ts', source: canaTs },
      { path: 'src/store.ts', source: reduxStoreBasic },
      { path: 'src/App.tsx', source: reduxApp },
      { path: 'src/main.tsx', source: reactMainTsx },
      { path: 'src/styles.css', source: reactStylesCss }
    ]
  },
  {
    id: 'react-redux-advanced',
    framework: 'React Redux',
    level: 'advanced',
    title: {
      en: 'React Redux: replay-safe transaction thunk',
      'pt-BR': 'React Redux: thunk transacional com replay'
    },
    description: {
      en: 'A Redux thunk writes Category and Task together while the listener resumes from the last cursor.',
      'pt-BR': 'Um thunk grava Category e Task juntas enquanto o listener retoma do ultimo cursor.'
    },
    download: download.reactRedux,
    files: [
      { path: 'package.json', source: reactReduxPackageJson },
      { path: 'tsconfig.json', source: reactTsconfig },
      { path: 'index.html', source: indexHtml },
      { path: 'vite.config.ts', source: viteReactConfig },
      { path: 'src/vite-env.d.ts', source: viteEnvDts },
      { path: 'src/cana.ts', source: canaTs },
      { path: 'src/store.ts', source: reduxStoreAdvanced },
      { path: 'src/App.tsx', source: reduxAdvancedApp },
      { path: 'src/main.tsx', source: reactMainTsx },
      { path: 'src/styles.css', source: reactStylesCss }
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
      en: 'Pinia actions write to Cana and patch state from committed events.',
      'pt-BR': 'Actions Pinia escrevem no Cana e atualizam estado por eventos confirmados.'
    },
    download: download.vuePinia,
    files: [
      { path: 'package.json', source: vuePackageJson },
      { path: 'tsconfig.json', source: vueTsconfig },
      { path: 'index.html', source: vueIndexHtml },
      { path: 'vite.config.ts', source: viteVueConfig },
      { path: 'src/vite-env.d.ts', source: viteEnvDts },
      { path: 'src/cana.ts', source: canaTs },
      { path: 'src/stores/tasks.ts', source: vueStoreBasic },
      { path: 'src/App.vue', source: vueAppBasic },
      { path: 'src/main.ts', source: vueMainTs },
      { path: 'src/styles.css', source: vueStylesCss }
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
      en: 'The Pinia store records the last Cana cursor and reloads when replay is unavailable.',
      'pt-BR': 'A store Pinia guarda o ultimo cursor do Cana e recarrega quando o replay nao esta disponivel.'
    },
    download: download.vuePinia,
    files: [
      { path: 'package.json', source: vuePackageJson },
      { path: 'tsconfig.json', source: vueTsconfig },
      { path: 'index.html', source: vueIndexHtml },
      { path: 'vite.config.ts', source: viteVueConfig },
      { path: 'src/vite-env.d.ts', source: viteEnvDts },
      { path: 'src/cana.ts', source: canaTs },
      { path: 'src/stores/advancedTasks.ts', source: vueStoreAdvanced },
      { path: 'src/App.vue', source: vueAppAdvanced },
      { path: 'src/main.ts', source: vueMainTs },
      { path: 'src/styles.css', source: vueStylesCss }
    ]
  }
];

export function getCanaFrameworkExample(
  id: CanaFrameworkExampleId
): CanaFrameworkExample | undefined {
  return CANA_FRAMEWORK_EXAMPLES.find((example) => example.id === id);
}
