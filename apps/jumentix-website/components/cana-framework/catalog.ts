import type { CanaFrameworkExample, CanaFrameworkExampleId } from './types';

const canaTs = `import { createClient, type CanaChangeEvent, type CanaSchema } from '@jumentix/cana';

export type Categoria = {
  id: string;
  nome: string;
  cor: string;
  criadaEm: number;
  atualizadaEm: number;
};

export type Tarefa = {
  id: string;
  titulo: string;
  categoriaId: string;
  concluida: boolean;
  prioridade: 'baixa' | 'media' | 'alta';
  notas?: string;
  criadaEm: number;
  atualizadaEm: number;
};

export const esquemaTarefas: CanaSchema = {
  version: 1,
  stores: [
    { name: 'categorias', keyPath: 'id', indexes: [{ name: 'porNome', keyPath: 'nome', unique: true }] },
    {
      name: 'tarefas',
      keyPath: 'id',
      indexes: [
        { name: 'porCategoria', keyPath: 'categoriaId' },
        { name: 'porConcluida', keyPath: 'concluida' },
        { name: 'porAtualizadaEm', keyPath: 'atualizadaEm' }
      ]
    }
  ]
};

export const cana = createClient({
  name: 'tutorial-cana-tarefas',
  schema: esquemaTarefas,
  originId: 'tarefas-ui',
  retainedEvents: 100
});

export async function abrirBancoDeTarefas() {
  await cana.open();
  return cana;
}

export async function carregarTudo() {
  const [categorias, tarefas] = await Promise.all([
    cana.table<Categoria>('categorias').query({ index: 'porNome' }),
    cana.table<Tarefa>('tarefas').query({ index: 'porAtualizadaEm' })
  ]);
  return { categorias: [...categorias], tarefas: [...tarefas] };
}

export async function criarDadosIniciais() {
  await abrirBancoDeTarefas();
  if (await cana.table<Categoria>('categorias').count()) return;
  const agora = Date.now();
  await cana.transaction('readwrite', ['categorias', 'tarefas'], async (scope) => {
    await scope.table<Categoria>('categorias').bulkAdd([
      { id: 'trabalho', nome: 'Trabalho', cor: '#2563eb', criadaEm: agora, atualizadaEm: agora },
      { id: 'casa', nome: 'Casa', cor: '#16a34a', criadaEm: agora, atualizadaEm: agora }
    ]);
    await scope.table<Tarefa>('tarefas').bulkAdd([
      {
        id: 'tarefa-1',
        titulo: 'Escrever tutorial do Cana',
        categoriaId: 'trabalho',
        concluida: false,
        prioridade: 'alta',
        criadaEm: agora,
        atualizadaEm: agora
      },
      {
        id: 'tarefa-2',
        titulo: 'Revisar filtros por categoria',
        categoriaId: 'casa',
        concluida: true,
        prioridade: 'media',
        criadaEm: agora,
        atualizadaEm: agora
      }
    ]);
  });
}

export function textoEvento(event: CanaChangeEvent) {
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

.categoria {
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  padding: 16px;
  background: white;
}

.tarefa {
  display: block;
  width: 100%;
  margin-top: 8px;
  border: 1px solid #dbe3ef;
  border-radius: 6px;
  padding: 8px;
  text-align: left;
  background: #f8fafc;
}

.eventos {
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
  "name": "cana-react-context-tarefas",
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
  "name": "cana-react-redux-tarefas",
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
  "name": "cana-vue-pinia-tarefas",
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
import { cana, carregarTudo, criarDadosIniciais, textoEvento, type Categoria, type Tarefa } from './cana';

type State = { categorias: Categoria[]; tarefas: Tarefa[]; eventos: string[] };
type Action =
  | { type: 'loaded'; payload: Omit<State, 'eventos'> }
  | { type: 'event'; event: Parameters<typeof textoEvento>[0] };

function reducer(state: State, action: Action): State {
  if (action.type === 'loaded') return { ...action.payload, eventos: [] };
  const event = action.event;
  return {
    categorias: applyCanaEventToRecords(state.categorias, event, {
      store: 'categorias',
      getKey: (categoria) => categoria.id,
      sort: (a, b) => a.nome.localeCompare(b.nome)
    }),
    tarefas: applyCanaEventToRecords(state.tarefas, event, {
      store: 'tarefas',
      getKey: (tarefa) => tarefa.id,
      sort: (a, b) => a.atualizadaEm - b.atualizadaEm
    }),
    eventos: [...state.eventos, textoEvento(event)].slice(-8)
  };
}

const TarefasContext = createContext<{
  state: State;
  adicionarTarefa(titulo: string, categoriaId: string): Promise<void>;
  alternarTarefa(tarefa: Tarefa): Promise<void>;
} | null>(null);

export function TarefasProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [state, dispatch] = useReducer(reducer, { categorias: [], tarefas: [], eventos: [] });

  useEffect(() => {
    let alive = true;
    void criarDadosIniciais()
      .then(carregarTudo)
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
    async adicionarTarefa(titulo: string, categoriaId: string) {
      const agora = Date.now();
      await cana.table<Tarefa>('tarefas').add({
        id: crypto.randomUUID(),
        titulo,
        categoriaId,
        concluida: false,
        prioridade: 'media',
        criadaEm: agora,
        atualizadaEm: agora
      });
    },
    async alternarTarefa(tarefa: Tarefa) {
      await cana.table<Tarefa>('tarefas').update(tarefa.id, {
        concluida: !tarefa.concluida,
        atualizadaEm: Date.now()
      });
    }
  };

  return <TarefasContext.Provider value={api}>{children}</TarefasContext.Provider>;
}

export function useTarefas() {
  const ctx = useContext(TarefasContext);
  if (!ctx) throw new Error('useTarefas must run inside TarefasProvider');
  return ctx;
}`;

const reactContextApp = `import { TarefasProvider, useTarefas } from './TarefasProvider';

function QuadroDeTarefas() {
  const { state, adicionarTarefa, alternarTarefa } = useTarefas();
  const grupos = state.categorias.map((categoria) => ({
    categoria,
    tarefas: state.tarefas.filter((tarefa) => tarefa.categoriaId === categoria.id)
  }));

  return (
    <main className="app">
      <h1>Cana + React Context</h1>
      <div className="toolbar">
        <button onClick={() => void adicionarTarefa('Nova tarefa de trabalho', 'trabalho')}>
          Adicionar tarefa
        </button>
      </div>
      <section className="board">
        {grupos.map(({ categoria, tarefas }) => (
          <article className="categoria" key={categoria.id}>
            <h2>{categoria.nome}</h2>
            {tarefas.map((tarefa) => (
              <button className="tarefa" key={tarefa.id} onClick={() => void alternarTarefa(tarefa)}>
                {tarefa.concluida ? 'Concluida: ' : ''}{tarefa.titulo}
              </button>
            ))}
          </article>
        ))}
      </section>
      <pre className="eventos">{state.eventos.join('\\n') || 'Sem eventos ainda.'}</pre>
    </main>
  );
}

export default function App() {
  return (
    <TarefasProvider>
      <QuadroDeTarefas />
    </TarefasProvider>
  );
}`;

const reactContextAdvanced = `import { isCanaErrorCode, type CanaChangeEvent } from '@jumentix/cana';
import { cana, carregarTudo, type Categoria, type Tarefa } from './cana';

let ultimoCursor = Number(localStorage.getItem('tarefas:lastCursor') ?? 0);

export async function ouvirComReplay(apply: (event: CanaChangeEvent) => void) {
  try {
    return cana.subscribe((event) => {
      apply(event);
      ultimoCursor = event.cursor;
      localStorage.setItem('tarefas:lastCursor', String(ultimoCursor));
    }, { sinceCursor: ultimoCursor });
  } catch (error) {
    if (isCanaErrorCode(error, 'NotFound')) {
      await carregarTudo();
      return cana.subscribe(apply);
    }
    throw error;
  }
}

export async function criarCategoriaComPrimeiraTarefa(nome: string, titulo: string) {
  const agora = Date.now();
  const categoriaId = nome.toLowerCase().replace(/\\s+/g, '-');
  return cana.transaction('readwrite', ['categorias', 'tarefas'], async (scope) => {
    await scope.table<Categoria>('categorias').put({
      id: categoriaId,
      nome,
      cor: '#f97316',
      criadaEm: agora,
      atualizadaEm: agora
    });
    await scope.table<Tarefa>('tarefas').put({
      id: crypto.randomUUID(),
      titulo,
      categoriaId,
      concluida: false,
      prioridade: 'alta',
      criadaEm: agora,
      atualizadaEm: agora
    });
  });
}`;

const reactContextAdvancedApp = `import { criarCategoriaComPrimeiraTarefa } from './advancedCana';
import { TarefasProvider, useTarefas } from './TarefasProvider';

function QuadroAvancado() {
  const { state, adicionarTarefa, alternarTarefa } = useTarefas();
  const grupos = state.categorias.map((categoria) => ({
    categoria,
    tarefas: state.tarefas.filter((tarefa) => tarefa.categoriaId === categoria.id)
  }));

  return (
    <main className="app">
      <h1>Cana + React Context avancado</h1>
      <div className="toolbar">
        <button onClick={() => void adicionarTarefa('Tarefa avulsa', 'trabalho')}>Adicionar tarefa</button>
        <button onClick={() => void criarCategoriaComPrimeiraTarefa('Operacoes', 'Criada na mesma transacao')}>
          Criar categoria + tarefa
        </button>
      </div>
      <section className="board">
        {grupos.map(({ categoria, tarefas }) => (
          <article className="categoria" key={categoria.id}>
            <h2>{categoria.nome}</h2>
            {tarefas.map((tarefa) => (
              <button className="tarefa" key={tarefa.id} onClick={() => void alternarTarefa(tarefa)}>
                {tarefa.concluida ? 'Concluida: ' : ''}{tarefa.titulo}
              </button>
            ))}
          </article>
        ))}
      </section>
      <pre className="eventos">{state.eventos.join('\\n') || 'Sem eventos ainda.'}</pre>
    </main>
  );
}

export default function App() {
  return (
    <TarefasProvider>
      <QuadroAvancado />
    </TarefasProvider>
  );
}`;

const reduxStoreBasic = `import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { CanaChangeEvent } from '@jumentix/cana';
import { connectCanaToRedux } from '@jumentix/cana-react/redux';
import { cana, carregarTudo, criarDadosIniciais, textoEvento, type Categoria, type Tarefa } from './cana';

type State = { categorias: Categoria[]; tarefas: Tarefa[]; eventos: string[] };

function upsert<T extends { id: string }>(records: T[], record: T) {
  const next = records.filter((item) => item.id !== record.id).concat(record);
  return next;
}

const slice = createSlice({
  name: 'tarefas',
  initialState: { categorias: [], tarefas: [], eventos: [] } as State,
  reducers: {
    replaceAll(_state, action: PayloadAction<{ categorias: Categoria[]; tarefas: Tarefa[] }>) {
      return { categorias: action.payload.categorias, tarefas: action.payload.tarefas, eventos: [] };
    },
    applyCanaEvent(state, action: PayloadAction<CanaChangeEvent>) {
      const event = action.payload;
      state.eventos = [...state.eventos, textoEvento(event)].slice(-8);
      if (event.store === 'categorias' && event.record) {
        state.categorias = upsert(state.categorias, event.record as Categoria)
          .sort((a, b) => a.nome.localeCompare(b.nome));
      }
      if (event.store === 'tarefas' && event.record) {
        state.tarefas = upsert(state.tarefas, event.record as Tarefa)
          .sort((a, b) => a.atualizadaEm - b.atualizadaEm);
      }
    }
  }
});

export const { applyCanaEvent, replaceAll } = slice.actions;

export const store = configureStore({ reducer: slice.reducer });
export type RootState = ReturnType<typeof store.getState>;

export async function startCanaRedux() {
  await criarDadosIniciais();
  store.dispatch(replaceAll(await carregarTudo()));
  const bridge = connectCanaToRedux({
    client: cana,
    dispatch: store.dispatch,
    mapEvent: (event) => applyCanaEvent(event)
  });
  return bridge.stop;
}

export async function adicionarTarefa(titulo: string, categoriaId: string) {
  const agora = Date.now();
  await cana.table<Tarefa>('tarefas').add({
    id: crypto.randomUUID(),
    titulo,
    categoriaId,
    concluida: false,
    prioridade: 'media',
    criadaEm: agora,
    atualizadaEm: agora
  });
}

export async function alternarTarefa(tarefa: Tarefa) {
  await cana.table<Tarefa>('tarefas').update(tarefa.id, {
    concluida: !tarefa.concluida,
    atualizadaEm: Date.now()
  });
}`;

const reduxApp = `import { useEffect } from 'react';
import { Provider, useSelector } from 'react-redux';
import { adicionarTarefa, alternarTarefa, startCanaRedux, store, type RootState } from './store';

function QuadroRedux() {
  const { categorias, tarefas, eventos } = useSelector((state: RootState) => state);

  useEffect(() => {
    let stop = () => {};
    void startCanaRedux().then((cleanup) => { stop = cleanup; });
    return () => stop();
  }, []);

  return (
    <main className="app">
      <h1>Cana + React Redux</h1>
      <div className="toolbar">
        <button onClick={() => void adicionarTarefa('Nova tarefa Redux', 'trabalho')}>Adicionar tarefa</button>
      </div>
      <section className="board">
        {categorias.map((categoria) => (
          <article className="categoria" key={categoria.id}>
            <h2>{categoria.nome}</h2>
            {tarefas.filter((tarefa) => tarefa.categoriaId === categoria.id).map((tarefa) => (
              <button className="tarefa" key={tarefa.id} onClick={() => void alternarTarefa(tarefa)}>
                {tarefa.concluida ? 'Concluida: ' : ''}{tarefa.titulo}
              </button>
            ))}
          </article>
        ))}
      </section>
      <pre className="eventos">{eventos.join('\\n') || 'Sem eventos ainda.'}</pre>
    </main>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <QuadroRedux />
    </Provider>
  );
}`;

const reduxStoreAdvanced = `import { configureStore, createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { isCanaErrorCode, type CanaChangeEvent } from '@jumentix/cana';
import { connectCanaToRedux } from '@jumentix/cana-react/redux';
import { cana, carregarTudo, criarDadosIniciais, textoEvento, type Categoria, type Tarefa } from './cana';

type State = { categorias: Categoria[]; tarefas: Tarefa[]; eventos: string[]; canaError: unknown };
let ultimoCursor = Number(localStorage.getItem('redux:lastCursor') ?? 0);

function upsert<T extends { id: string }>(records: T[], record: T) {
  return records.filter((item) => item.id !== record.id).concat(record);
}

const slice = createSlice({
  name: 'tarefas',
  initialState: { categorias: [], tarefas: [], eventos: [], canaError: null } as State,
  reducers: {
    replaceAll(state, action: PayloadAction<{ categorias: Categoria[]; tarefas: Tarefa[] }>) {
      state.categorias = action.payload.categorias;
      state.tarefas = action.payload.tarefas;
    },
    setCanaError(state, action: PayloadAction<unknown>) {
      state.canaError = action.payload;
    },
    applyCanaEvent(state, action: PayloadAction<CanaChangeEvent>) {
      const event = action.payload;
      ultimoCursor = event.cursor;
      localStorage.setItem('redux:lastCursor', String(ultimoCursor));
      state.eventos = [...state.eventos, textoEvento(event)].slice(-8);
      if (event.store === 'categorias' && event.record) {
        state.categorias = upsert(state.categorias, event.record as Categoria)
          .sort((a, b) => a.nome.localeCompare(b.nome));
      }
      if (event.store === 'tarefas' && event.record) {
        state.tarefas = upsert(state.tarefas, event.record as Tarefa)
          .sort((a, b) => a.atualizadaEm - b.atualizadaEm);
      }
    }
  }
});

export const { applyCanaEvent, replaceAll, setCanaError } = slice.actions;
export const store = configureStore({ reducer: slice.reducer });
export type RootState = ReturnType<typeof store.getState>;

export async function startCanaReduxComReplay() {
  await criarDadosIniciais();
  store.dispatch(replaceAll(await carregarTudo()));
  try {
    const bridge = connectCanaToRedux({
      client: cana,
      dispatch: store.dispatch,
      sinceCursor: ultimoCursor,
      mapEvent: (event) => applyCanaEvent(event)
    });
    return bridge.stop;
  } catch (error) {
    if (isCanaErrorCode(error, 'NotFound')) {
      store.dispatch(replaceAll(await carregarTudo()));
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

export const criarCategoriaComPrimeiraTarefa = createAsyncThunk(
  'tarefas/criarCategoriaComPrimeiraTarefa',
  async ({ nome, titulo }: { nome: string; titulo: string }) => {
    const agora = Date.now();
    const categoriaId = nome.toLowerCase().replace(/\\s+/g, '-');
    return cana.transaction('readwrite', ['categorias', 'tarefas'], async (scope) => {
      await scope.table<Categoria>('categorias').put({
        id: categoriaId,
        nome,
        cor: '#7c3aed',
        criadaEm: agora,
        atualizadaEm: agora
      });
      await scope.table<Tarefa>('tarefas').put({
        id: crypto.randomUUID(),
        titulo,
        categoriaId,
        concluida: false,
        prioridade: 'alta',
        criadaEm: agora,
        atualizadaEm: agora
      });
    });
  }
);

export async function adicionarTarefa(titulo: string, categoriaId: string) {
  const agora = Date.now();
  await cana.table<Tarefa>('tarefas').add({
    id: crypto.randomUUID(),
    titulo,
    categoriaId,
    concluida: false,
    prioridade: 'media',
    criadaEm: agora,
    atualizadaEm: agora
  });
}

export async function alternarTarefa(tarefa: Tarefa) {
  await cana.table<Tarefa>('tarefas').update(tarefa.id, {
    concluida: !tarefa.concluida,
    atualizadaEm: Date.now()
  });
}`;

const reduxAdvancedApp = `import { useEffect } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import {
  adicionarTarefa,
  alternarTarefa,
  criarCategoriaComPrimeiraTarefa,
  startCanaReduxComReplay,
  store,
  type RootState
} from './store';

function QuadroReduxAvancado() {
  const dispatch = useDispatch<typeof store.dispatch>();
  const { categorias, tarefas, eventos } = useSelector((state: RootState) => state);

  useEffect(() => {
    let stop = () => {};
    void startCanaReduxComReplay().then((cleanup) => { stop = cleanup; });
    return () => stop();
  }, []);

  return (
    <main className="app">
      <h1>Cana + React Redux avancado</h1>
      <div className="toolbar">
        <button onClick={() => void adicionarTarefa('Nova tarefa Redux', 'trabalho')}>Adicionar tarefa</button>
        <button onClick={() => void dispatch(criarCategoriaComPrimeiraTarefa({
          nome: 'Release',
          titulo: 'Criada em uma transacao'
        }))}>
          Criar categoria + tarefa
        </button>
      </div>
      <section className="board">
        {categorias.map((categoria) => (
          <article className="categoria" key={categoria.id}>
            <h2>{categoria.nome}</h2>
            {tarefas.filter((tarefa) => tarefa.categoriaId === categoria.id).map((tarefa) => (
              <button className="tarefa" key={tarefa.id} onClick={() => void alternarTarefa(tarefa)}>
                {tarefa.concluida ? 'Concluida: ' : ''}{tarefa.titulo}
              </button>
            ))}
          </article>
        ))}
      </section>
      <pre className="eventos">{eventos.join('\\n') || 'Sem eventos ainda.'}</pre>
    </main>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <QuadroReduxAvancado />
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
import { cana, carregarTudo, criarDadosIniciais, textoEvento, type Categoria, type Tarefa } from '../cana';

export const useTarefasStore = defineStore('tarefas', {
  state: () => ({
    categorias: [] as Categoria[],
    tarefas: [] as Tarefa[],
    eventos: [] as string[]
  }),
  getters: {
    porCategoria: (state) => (categoriaId: string) =>
      state.tarefas.filter((tarefa) => tarefa.categoriaId === categoriaId)
  },
  actions: {
    async init() {
      await criarDadosIniciais();
      Object.assign(this, await carregarTudo());
      const bridge = connectCanaToPinia({
        client: cana,
        apply: (event) => this.applyEvent(event)
      });
      return bridge.stop;
    },
    applyEvent(event: Parameters<typeof textoEvento>[0]) {
      this.eventos = [...this.eventos, textoEvento(event)].slice(-8);
      this.categorias = applyCanaEventToRecords(this.categorias, event, {
        store: 'categorias',
        getKey: (categoria) => categoria.id,
        sort: (a, b) => a.nome.localeCompare(b.nome)
      });
      this.tarefas = applyCanaEventToRecords(this.tarefas, event, {
        store: 'tarefas',
        getKey: (tarefa) => tarefa.id,
        sort: (a, b) => a.atualizadaEm - b.atualizadaEm
      });
    },
    async adicionarTarefa(titulo: string, categoriaId: string) {
      const agora = Date.now();
      await cana.table<Tarefa>('tarefas').add({
        id: crypto.randomUUID(),
        titulo,
        categoriaId,
        concluida: false,
        prioridade: 'media',
        criadaEm: agora,
        atualizadaEm: agora
      });
    },
    async alternarTarefa(tarefa: Tarefa) {
      await cana.table<Tarefa>('tarefas').update(tarefa.id, {
        concluida: !tarefa.concluida,
        atualizadaEm: Date.now()
      });
    }
  }
});`;

const vueAppBasic = `<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useTarefasStore } from './stores/tarefas';

const tarefas = useTarefasStore();
let stop = () => {};

onMounted(async () => {
  stop = await tarefas.init();
});
onUnmounted(() => stop());
</script>

<template>
  <main class="app">
    <h1>Cana + Vue 3 + Pinia</h1>
    <div class="toolbar">
      <button @click="tarefas.adicionarTarefa('Nova tarefa Pinia', 'trabalho')">Adicionar tarefa</button>
    </div>
    <section class="board">
      <article v-for="categoria in tarefas.categorias" :key="categoria.id" class="categoria">
        <h2>{{ categoria.nome }}</h2>
        <button
          v-for="tarefa in tarefas.porCategoria(categoria.id)"
          :key="tarefa.id"
          class="tarefa"
          @click="tarefas.alternarTarefa(tarefa)"
        >
          {{ tarefa.concluida ? 'Concluida: ' : '' }}{{ tarefa.titulo }}
        </button>
      </article>
    </section>
    <pre class="eventos">{{ tarefas.eventos.join('\\n') || 'Sem eventos ainda.' }}</pre>
  </main>
</template>`;

const vueStoreAdvanced = `import { defineStore } from 'pinia';
import { isCanaErrorCode } from '@jumentix/cana';
import { applyCanaEventToRecords, connectCanaToPinia } from '@jumentix/cana-vue';
import { cana, carregarTudo, criarDadosIniciais, textoEvento, type Categoria, type Tarefa } from '../cana';

let ultimoCursor = Number(localStorage.getItem('pinia:lastCursor') ?? 0);

export const useTarefasStore = defineStore('tarefasAvancadas', {
  state: () => ({
    categorias: [] as Categoria[],
    tarefas: [] as Tarefa[],
    eventos: [] as string[],
    canaError: null as unknown
  }),
  getters: {
    porCategoria: (state) => (categoriaId: string) =>
      state.tarefas.filter((tarefa) => tarefa.categoriaId === categoriaId)
  },
  actions: {
    async init() {
      await criarDadosIniciais();
      Object.assign(this, await carregarTudo());
      try {
        const bridge = connectCanaToPinia({
          client: cana,
          sinceCursor: ultimoCursor,
          apply: (event) => this.applyEvent(event)
        });
        return bridge.stop;
      } catch (error) {
        if (isCanaErrorCode(error, 'NotFound')) {
          Object.assign(this, await carregarTudo());
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
    applyEvent(event: Parameters<typeof textoEvento>[0]) {
      ultimoCursor = event.cursor;
      localStorage.setItem('pinia:lastCursor', String(ultimoCursor));
      this.eventos = [...this.eventos, textoEvento(event)].slice(-8);
      this.categorias = applyCanaEventToRecords(this.categorias, event, {
        store: 'categorias',
        getKey: (categoria) => categoria.id,
        sort: (a, b) => a.nome.localeCompare(b.nome)
      });
      this.tarefas = applyCanaEventToRecords(this.tarefas, event, {
        store: 'tarefas',
        getKey: (tarefa) => tarefa.id,
        sort: (a, b) => a.atualizadaEm - b.atualizadaEm
      });
    },
    async criarCategoriaComPrimeiraTarefa(nome: string, titulo: string) {
      const agora = Date.now();
      const categoriaId = nome.toLowerCase().replace(/\\s+/g, '-');
      await cana.transaction('readwrite', ['categorias', 'tarefas'], async (scope) => {
        await scope.table<Categoria>('categorias').put({
          id: categoriaId,
          nome,
          cor: '#dc2626',
          criadaEm: agora,
          atualizadaEm: agora
        });
        await scope.table<Tarefa>('tarefas').put({
          id: crypto.randomUUID(),
          titulo,
          categoriaId,
          concluida: false,
          prioridade: 'alta',
          criadaEm: agora,
          atualizadaEm: agora
        });
      });
    },
    async alternarTarefa(tarefa: Tarefa) {
      await cana.table<Tarefa>('tarefas').update(tarefa.id, {
        concluida: !tarefa.concluida,
        atualizadaEm: Date.now()
      });
    }
  }
});`;

const vueAppAdvanced = `<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useTarefasStore } from './stores/tarefasAvancadas';

const tarefas = useTarefasStore();
let stop = () => {};

onMounted(async () => {
  stop = await tarefas.init();
});
onUnmounted(() => stop());
</script>

<template>
  <main class="app">
    <h1>Cana + Vue 3 + Pinia avancado</h1>
    <div class="toolbar">
      <button @click="tarefas.criarCategoriaComPrimeiraTarefa('QA', 'Criada em uma transacao')">
        Criar categoria + tarefa
      </button>
    </div>
    <section class="board">
      <article v-for="categoria in tarefas.categorias" :key="categoria.id" class="categoria">
        <h2>{{ categoria.nome }}</h2>
        <button
          v-for="tarefa in tarefas.porCategoria(categoria.id)"
          :key="tarefa.id"
          class="tarefa"
          @click="tarefas.alternarTarefa(tarefa)"
        >
          {{ tarefa.concluida ? 'Concluida: ' : '' }}{{ tarefa.titulo }}
        </button>
      </article>
    </section>
    <pre class="eventos">{{ tarefas.eventos.join('\\n') || 'Sem eventos ainda.' }}</pre>
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
      en: 'React Context: Categoria and Tarefa tables',
      'pt-BR': 'React Context: tabelas Categoria e Tarefa'
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
      { path: 'src/TarefasProvider.tsx', source: reactContextProvider },
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
      { path: 'src/TarefasProvider.tsx', source: reactContextProvider },
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
      en: 'A Redux thunk writes Categoria and Tarefa together while the listener resumes from the last cursor.',
      'pt-BR': 'Um thunk grava Categoria e Tarefa juntas enquanto o listener retoma do ultimo cursor.'
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
      { path: 'src/stores/tarefas.ts', source: vueStoreBasic },
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
      { path: 'src/stores/tarefasAvancadas.ts', source: vueStoreAdvanced },
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
