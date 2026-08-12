'use client';

import type { CanaChangeEvent, CanaClient, CanaSchema } from '@jumentix/cana';
import { createClient } from '@jumentix/cana';
import {
  configureStore,
  createSlice,
  type PayloadAction
} from '@reduxjs/toolkit';
import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  MantineProvider,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Title
} from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import { usePathname } from 'next/navigation';
import { Provider, useDispatch, useSelector } from 'react-redux';
import React, { createContext, useContext, useMemo, useReducer, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { theme as jumentixTheme } from '../../theme';
import { languageFromPath, MonacoCodeBlock } from '../code/MonacoCodeBlock';
import { deleteEphemeralDatabase } from '../docs-playground/runSnippet';
import { getCanaFrameworkExample } from './catalog';
import type {
  CanaFrameworkExample,
  CanaFrameworkExampleId,
  CanaFrameworkRunContext,
  Task,
  TaskCategory,
  TaskDemoSnapshot
} from './types';

const schema: CanaSchema = {
  version: 1,
  stores: [
    {
      name: 'categorias',
      keyPath: 'id',
      indexes: [{ name: 'porNome', keyPath: 'nome', unique: true }]
    },
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

const baseCategories: TaskCategory[] = [
  { id: 'trabalho', nome: 'Trabalho', cor: '#2563eb', criadaEm: 1, atualizadaEm: 1 },
  { id: 'casa', nome: 'Casa', cor: '#16a34a', criadaEm: 2, atualizadaEm: 2 }
];

const baseTasks: Task[] = [
  {
    id: 'tarefa-1',
    titulo: 'Escrever tutorial do Cana',
    categoriaId: 'trabalho',
    concluida: false,
    prioridade: 'alta',
    criadaEm: 3,
    atualizadaEm: 3
  },
  {
    id: 'tarefa-2',
    titulo: 'Revisar filtros por categoria',
    categoriaId: 'casa',
    concluida: true,
    prioridade: 'media',
    criadaEm: 4,
    atualizadaEm: 4
  }
];

type Listener = (event: CanaChangeEvent) => void;

function currentColorScheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.getAttribute('data-mantine-color-scheme') === 'light'
    ? 'light'
    : 'dark';
}

function DemoMantineProvider({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider
      theme={jumentixTheme}
      withCssVariables={false}
      withGlobalClasses={false}
      forceColorScheme={currentColorScheme()}
    >
      {children}
    </MantineProvider>
  );
}

async function openTaskClient(dbName: string, originId: string): Promise<CanaClient> {
  const client = createClient({
    name: dbName,
    schema,
    originId,
    retainedEvents: 50
  });
  await client.open();
  return client;
}

async function seed(client: CanaClient): Promise<void> {
  await client.table<TaskCategory>('categorias').bulkPut(baseCategories);
  await client.table<Task>('tarefas').bulkPut(baseTasks);
}

async function snapshot(client: CanaClient): Promise<TaskDemoSnapshot> {
  const categories = await client.table<TaskCategory>('categorias').query({ index: 'porNome' });
  const tasks = await client.table<Task>('tarefas').query({ index: 'porAtualizadaEm' });
  return {
    categories: [...categories],
    tasks: [...tasks]
  };
}

function applyEvent(state: TaskDemoSnapshot, event: CanaChangeEvent): TaskDemoSnapshot {
  if (event.store === 'categorias') {
    if (event.type === 'cleared') return { ...state, categories: [] };
    if (event.type === 'deleted') {
      return { ...state, categories: state.categories.filter((item) => item.id !== event.key) };
    }
    const record = event.record as TaskCategory;
    return {
      ...state,
      categories: [
        ...state.categories.filter((item) => item.id !== record.id),
        record
      ].sort((a, b) => a.nome.localeCompare(b.nome))
    };
  }

  if (event.store === 'tarefas') {
    if (event.type === 'cleared') return { ...state, tasks: [] };
    if (event.type === 'deleted') {
      return { ...state, tasks: state.tasks.filter((item) => item.id !== event.key) };
    }
    const record = event.record as Task;
    return {
      ...state,
      tasks: [
        ...state.tasks.filter((item) => item.id !== record.id),
        record
      ].sort((a, b) => a.atualizadaEm - b.atualizadaEm)
    };
  }

  return state;
}

function eventLabel(event: CanaChangeEvent): string {
  return `${event.cursor}: ${event.type} ${event.store}${event.key ? `/${String(event.key)}` : ''}`;
}

function TaskBoard({
  snapshot: value,
  events,
  onAddTask,
  onToggle,
  onAdvanced
}: {
  snapshot: TaskDemoSnapshot;
  events: string[];
  onAddTask: () => void;
  onToggle: (task: Task) => void;
  onAdvanced?: () => void;
}) {
  const grouped = value.categories.map((category) => ({
    category,
    tasks: value.tasks.filter((task) => task.categoriaId === category.id)
  }));

  return (
    <Stack gap="sm" className="cana-framework-demo">
      <Group gap="xs">
        <Button className="cana-framework-demo-action" size="xs" onClick={onAddTask}>Add task through Cana</Button>
        {onAdvanced ? (
          <Button className="cana-framework-demo-action" size="xs" variant="default" onClick={onAdvanced}>
            Run transaction
          </Button>
        ) : null}
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        {grouped.map(({ category, tasks }) => (
          <Paper key={category.id} className="cana-framework-demo-card" withBorder p="sm" radius={6}>
            <Group justify="space-between" mb={6}>
              <Text fw={700}>{category.nome}</Text>
              <Badge color={category.id === 'trabalho' ? 'blue' : 'green'}>{tasks.length}</Badge>
            </Group>
            <Stack gap={4}>
              {tasks.map((task) => (
                <Button
                  key={task.id}
                  className="cana-framework-demo-task"
                  variant={task.concluida ? 'light' : 'default'}
                  size="xs"
                  justify="space-between"
                  onClick={() => onToggle(task)}
                >
                  {task.concluida ? 'Done: ' : ''}{task.titulo}
                </Button>
              ))}
            </Stack>
          </Paper>
        ))}
      </SimpleGrid>
      <pre className="cana-framework-demo-events">
        {events.length ? events.join('\n') : 'No Cana events yet.'}
      </pre>
    </Stack>
  );
}

type ReactContextState = TaskDemoSnapshot & { events: string[] };

const TaskContext = createContext<{
  state: ReactContextState;
  addTask: () => Promise<void>;
  toggleTask: (task: Task) => Promise<void>;
  runTransaction?: () => Promise<void>;
} | null>(null);

function reactContextReducer(state: ReactContextState, event: CanaChangeEvent): ReactContextState {
  const next = applyEvent(state, event);
  return { ...next, events: [...state.events, eventLabel(event)].slice(-8) };
}

function ReactContextProvider({
  client,
  initial,
  advanced,
  children
}: {
  client: CanaClient;
  initial: TaskDemoSnapshot;
  advanced?: boolean;
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(reactContextReducer, { ...initial, events: [] });
  const counter = useRef(10);

  React.useEffect(() => {
    const stop = client.subscribe((event) => dispatch(event));
    return () => stop();
  }, [client]);

  const api = useMemo(() => ({
    state,
    addTask: async () => {
      counter.current += 1;
      await client.table<Task>('tarefas').add({
        id: `context-${counter.current}`,
        titulo: `Tarefa Context ${counter.current}`,
        categoriaId: counter.current % 2 ? 'trabalho' : 'casa',
        concluida: false,
        prioridade: 'media',
        criadaEm: counter.current,
        atualizadaEm: counter.current
      });
    },
    toggleTask: async (task: Task) => {
      await client.table<Task>('tarefas').update(task.id, {
        concluida: !task.concluida,
        atualizadaEm: Date.now()
      });
    },
    runTransaction: advanced
      ? async () => {
          counter.current += 1;
          await client.transaction('readwrite', ['categorias', 'tarefas'], async (scope) => {
            await scope.table<TaskCategory>('categorias').put({
              id: 'ops',
              nome: 'Operacoes',
              cor: '#f97316',
              criadaEm: counter.current,
              atualizadaEm: counter.current
            });
            await scope.table<Task>('tarefas').put({
              id: `context-tx-${counter.current}`,
              titulo: 'Criada com uma transacao Cana',
              categoriaId: 'ops',
              concluida: false,
              prioridade: 'alta',
              criadaEm: counter.current,
              atualizadaEm: counter.current
            });
          });
        }
      : undefined
  }), [advanced, client, state]);

  return <TaskContext.Provider value={api}>{children}</TaskContext.Provider>;
}

function ReactContextBoard() {
  const ctx = useContext(TaskContext);
  if (!ctx) return null;
  return (
    <TaskBoard
      snapshot={ctx.state}
      events={ctx.state.events}
      onAddTask={() => void ctx.addTask()}
      onToggle={(task) => void ctx.toggleTask(task)}
      onAdvanced={ctx.runTransaction ? () => void ctx.runTransaction?.() : undefined}
    />
  );
}

async function runReactContext(context: CanaFrameworkRunContext, advanced: boolean) {
  const client = await openTaskClient(context.dbName, advanced ? 'react-context-advanced' : 'react-context-basic');
  await seed(client);
  const initial = await snapshot(client);
  const root = createRoot(context.root);
  root.render(
    <DemoMantineProvider>
      <ReactContextProvider client={client} initial={initial} advanced={advanced}>
        <ReactContextBoard />
      </ReactContextProvider>
    </DemoMantineProvider>
  );
  context.report({ backend: client.backend, state: initial });
  return () => {
    root.unmount();
    client.close();
  };
}

type ReduxState = TaskDemoSnapshot & { events: string[] };

function createReduxStore(initial: TaskDemoSnapshot) {
  const categories = createSlice({
    name: 'categorias',
    initialState: initial.categories,
    reducers: {
      upsert: (state, action: PayloadAction<TaskCategory>) => {
        const index = state.findIndex((item) => item.id === action.payload.id);
        if (index >= 0) state[index] = action.payload;
        else state.push(action.payload);
        state.sort((a, b) => a.nome.localeCompare(b.nome));
      },
      remove: (state, action: PayloadAction<string>) =>
        state.filter((item) => item.id !== action.payload),
      clear: () => []
    }
  });
  const tasks = createSlice({
    name: 'tarefas',
    initialState: initial.tasks,
    reducers: {
      upsert: (state, action: PayloadAction<Task>) => {
        const index = state.findIndex((item) => item.id === action.payload.id);
        if (index >= 0) state[index] = action.payload;
        else state.push(action.payload);
        state.sort((a, b) => a.atualizadaEm - b.atualizadaEm);
      },
      remove: (state, action: PayloadAction<string>) =>
        state.filter((item) => item.id !== action.payload),
      clear: () => []
    }
  });
  const events = createSlice({
    name: 'events',
    initialState: [] as string[],
    reducers: {
      add: (state, action: PayloadAction<string>) => [...state, action.payload].slice(-8)
    }
  });
  const store = configureStore({
    reducer: {
      categories: categories.reducer,
      tasks: tasks.reducer,
      events: events.reducer
    }
  });
  const apply = (event: CanaChangeEvent) => {
    store.dispatch(events.actions.add(eventLabel(event)));
    if (event.store === 'categorias') {
      if (event.type === 'cleared') store.dispatch(categories.actions.clear());
      else if (event.type === 'deleted') store.dispatch(categories.actions.remove(String(event.key)));
      else store.dispatch(categories.actions.upsert(event.record as TaskCategory));
    }
    if (event.store === 'tarefas') {
      if (event.type === 'cleared') store.dispatch(tasks.actions.clear());
      else if (event.type === 'deleted') store.dispatch(tasks.actions.remove(String(event.key)));
      else store.dispatch(tasks.actions.upsert(event.record as Task));
    }
  };
  return { store, apply };
}

function ReduxBoard({
  client,
  advanced
}: {
  client: CanaClient;
  advanced?: boolean;
}) {
  const dispatch = useDispatch();
  const categories = useSelector((state: ReduxState) => state.categories);
  const tasks = useSelector((state: ReduxState) => state.tasks);
  const events = useSelector((state: ReduxState) => state.events);
  const counter = useRef(20);

  const writeTask = async () => {
    counter.current += 1;
    await client.table<Task>('tarefas').put({
      id: `redux-${counter.current}`,
      titulo: `Tarefa Redux ${counter.current}`,
      categoriaId: counter.current % 2 ? 'trabalho' : 'casa',
      concluida: false,
      prioridade: 'media',
      criadaEm: counter.current,
      atualizadaEm: counter.current
    });
  };

  const toggle = async (task: Task) => {
    await client.table<Task>('tarefas').update(task.id, {
      concluida: !task.concluida,
      atualizadaEm: Date.now()
    });
  };

  const runTransaction = advanced
    ? async () => {
        counter.current += 1;
        await client.transaction('readwrite', ['categorias', 'tarefas'], async (scope) => {
          await scope.table<TaskCategory>('categorias').put({
            id: 'release',
            nome: 'Release',
            cor: '#7c3aed',
            criadaEm: counter.current,
            atualizadaEm: counter.current
          });
          await scope.table<Task>('tarefas').put({
            id: `redux-tx-${counter.current}`,
            titulo: 'Redux recebeu eventos da transacao',
            categoriaId: 'release',
            concluida: false,
            prioridade: 'alta',
            criadaEm: counter.current,
            atualizadaEm: counter.current
          });
        });
        dispatch({ type: 'demo/transactionFinished' });
      }
    : undefined;

  return (
    <TaskBoard
      snapshot={{ categories, tasks }}
      events={events}
      onAddTask={() => void writeTask()}
      onToggle={(task) => void toggle(task)}
      onAdvanced={runTransaction ? () => void runTransaction() : undefined}
    />
  );
}

async function runRedux(context: CanaFrameworkRunContext, advanced: boolean) {
  const client = await openTaskClient(context.dbName, advanced ? 'react-redux-advanced' : 'react-redux-basic');
  await seed(client);
  const initial = await snapshot(client);
  const { store, apply } = createReduxStore(initial);
  const stop = client.subscribe(apply);
  const root = createRoot(context.root);
  root.render(
    <DemoMantineProvider>
      <Provider store={store}>
        <ReduxBoard client={client} advanced={advanced} />
      </Provider>
    </DemoMantineProvider>
  );
  context.report({ backend: client.backend, state: store.getState() });
  return () => {
    stop();
    root.unmount();
    client.close();
  };
}

async function runVuePinia(context: CanaFrameworkRunContext, advanced: boolean) {
  const {
    computed,
    createApp,
    defineComponent,
    h,
    onMounted,
    onUnmounted,
    ref
  } = await import('vue');
  const { createPinia, defineStore } = await import('pinia');
  const client = await openTaskClient(context.dbName, advanced ? 'vue-pinia-advanced' : 'vue-pinia-basic');
  await seed(client);
  const initial = await snapshot(client);
  const pinia = createPinia();
  const useTasks = defineStore(`tasks-${context.dbName}`, {
    state: () => ({
      categories: initial.categories as TaskCategory[],
      tasks: initial.tasks as Task[],
      events: [] as string[],
      counter: 30
    }),
    getters: {
      groups: (state) => state.categories.map((category) => ({
        category,
        tasks: state.tasks.filter((task) => task.categoriaId === category.id)
      }))
    },
    actions: {
      apply(event: CanaChangeEvent) {
        const next = applyEvent({ categories: this.categories, tasks: this.tasks }, event);
        this.categories = next.categories;
        this.tasks = next.tasks;
        this.events = [...this.events, eventLabel(event)].slice(-8);
      },
      async addTask() {
        this.counter += 1;
        await client.table<Task>('tarefas').put({
          id: `pinia-${this.counter}`,
          titulo: `Tarefa Pinia ${this.counter}`,
          categoriaId: this.counter % 2 ? 'trabalho' : 'casa',
          concluida: false,
          prioridade: 'media',
          criadaEm: this.counter,
          atualizadaEm: this.counter
        });
      },
      async toggle(task: Task) {
        await client.table<Task>('tarefas').update(task.id, {
          concluida: !task.concluida,
          atualizadaEm: Date.now()
        });
      },
      async runTransaction() {
        this.counter += 1;
        await client.transaction('readwrite', ['categorias', 'tarefas'], async (scope) => {
          await scope.table<TaskCategory>('categorias').put({
            id: 'qa',
            nome: 'QA',
            cor: '#dc2626',
            criadaEm: this.counter,
            atualizadaEm: this.counter
          });
          await scope.table<Task>('tarefas').put({
            id: `pinia-tx-${this.counter}`,
            titulo: 'Pinia atualizada pela transacao Cana',
            categoriaId: 'qa',
            concluida: false,
            prioridade: 'alta',
            criadaEm: this.counter,
            atualizadaEm: this.counter
          });
        });
      }
    }
  });

  const app = createApp(defineComponent({
    setup() {
      const store = useTasks();
      const groups = computed(() => store.groups);
      const stop = ref<(() => void) | null>(null);
      onMounted(() => {
        stop.value = client.subscribe((event) => store.apply(event));
      });
      onUnmounted(() => stop.value?.());
      return () => h('div', { class: 'cana-framework-demo cana-vue-demo' }, [
        h('div', { class: 'cana-framework-demo-actions' }, [
          h('button', {
            class: 'cana-framework-demo-action cana-framework-demo-native-action',
            type: 'button',
            onClick: () => void store.addTask()
          }, 'Add task through Cana'),
          advanced
            ? h('button', {
                class: 'cana-framework-demo-action cana-framework-demo-native-action',
                type: 'button',
                onClick: () => void store.runTransaction()
              }, 'Run transaction')
            : null
        ]),
        h('div', { class: 'cana-framework-demo-grid' },
          groups.value.map(({ category, tasks: list }) => h('section', {
            key: category.id,
            class: 'cana-framework-demo-card'
          }, [
            h('strong', category.nome),
            h('span', { class: 'cana-framework-demo-count' }, `${list.length} tasks`),
            h('div', { class: 'cana-framework-demo-list' }, list.map((task) => h('button', {
              class: 'cana-framework-demo-task cana-framework-demo-native-task',
              key: task.id,
              type: 'button',
              onClick: () => void store.toggle(task)
            }, `${task.concluida ? 'Done: ' : ''}${task.titulo}`)))
          ]))
        ),
        h('pre', { class: 'cana-framework-demo-events cana-framework-demo-native-events' }, store.events.length
          ? store.events.join('\n')
          : 'No Cana events yet.')
      ]);
    }
  }));
  app.use(pinia);
  app.mount(context.root);
  context.report({ backend: client.backend, state: initial });
  return () => {
    app.unmount();
    client.close();
  };
}

const RUNNERS: Record<CanaFrameworkExampleId, (context: CanaFrameworkRunContext) => Promise<() => void>> = {
  'react-context-basic': (context) => runReactContext(context, false),
  'react-context-advanced': (context) => runReactContext(context, true),
  'react-redux-basic': (context) => runRedux(context, false),
  'react-redux-advanced': (context) => runRedux(context, true),
  'vue-pinia-basic': (context) => runVuePinia(context, false),
  'vue-pinia-advanced': (context) => runVuePinia(context, true)
};

function formatOutput(value: unknown): string {
  if (value === undefined) return 'undefined';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export type CanaFrameworkPlaygroundProps = {
  id: CanaFrameworkExampleId;
};

export function CanaFrameworkPlayground({ id }: CanaFrameworkPlaygroundProps) {
  const example = getCanaFrameworkExample(id);
  const pathname = usePathname();
  const locale: 'en' | 'pt-BR' = pathname?.includes('/pt-BR/') ? 'pt-BR' : 'en';
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const cleanupRef = React.useRef<(() => void) | null>(null);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState(example?.files[0]?.path ?? '');

  React.useEffect(() => {
    setActiveFile(example?.files[0]?.path ?? '');
  }, [example]);

  async function cleanup(exampleToClean: CanaFrameworkExample | undefined) {
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (rootRef.current) rootRef.current.innerHTML = '';
    if (exampleToClean) {
      await deleteEphemeralDatabase(`cana-framework-${exampleToClean.id}`);
    }
  }

  async function handleRun() {
    if (!example || !rootRef.current) return;
    setRunning(true);
    setError(null);
    setOutput('');
    setLogs([]);
    try {
      await cleanup(example);
      const context: CanaFrameworkRunContext = {
        root: rootRef.current,
        dbName: `cana-framework-${example.id}`,
        log: (message) => setLogs((current) => [...current, message]),
        report: (value) => setOutput(formatOutput(value))
      };
      cleanupRef.current = await RUNNERS[example.id](context);
    } catch (err) {
      setError(formatOutput(err));
    } finally {
      setRunning(false);
    }
  }

  async function handleReset() {
    setRunning(true);
    setError(null);
    setOutput('');
    setLogs([]);
    try {
      await cleanup(example);
    } catch (err) {
      setError(formatOutput(err));
    } finally {
      setRunning(false);
    }
  }

  React.useEffect(() => () => {
    cleanupRef.current?.();
  }, []);

  if (!example) {
    return (
      <Alert color="red" my="md" title="Cana framework example not found">
        <Text component="code" className="jtx-inline-code">{id}</Text>
      </Alert>
    );
  }

  const selected = example.files.find((file) => file.path === activeFile) ?? example.files[0];

  return (
    <Paper
      withBorder
      p="md"
      my="md"
      className="cana-framework-playground"
      data-testid={`cana-framework-playground-${id}`}
    >
      <Stack gap="sm">
        <div>
          <Group gap="xs" mb={4}>
            <Badge>{example.framework}</Badge>
            <Badge variant="light">{example.level}</Badge>
          </Group>
          <Title order={4}>{example.title[locale]}</Title>
          <Text size="sm" c="dimmed">{example.description[locale]}</Text>
        </div>

        <Group>
          <Button
            size="sm"
            onClick={() => void handleRun()}
            loading={running}
            data-testid={`cana-framework-playground-${id}-run`}
          >
            {locale === 'pt-BR' ? 'Executar' : 'Run'}
          </Button>
          <Button
            size="sm"
            variant="default"
            onClick={() => void handleReset()}
            disabled={running}
            data-testid={`cana-framework-playground-${id}-reset`}
          >
            {locale === 'pt-BR' ? 'Resetar' : 'Reset'}
          </Button>
          {example.download ? (
            <Button
              component="a"
              href={example.download.href}
              download
              size="sm"
              variant="light"
              leftSection={<IconDownload size={16} aria-hidden="true" />}
            >
              {example.download.label[locale]}
            </Button>
          ) : null}
        </Group>

        <Box
          ref={rootRef}
          mih={180}
          p="sm"
          className="cana-framework-preview"
          data-testid={`cana-framework-playground-${id}-preview`}
        />

        <Select
          label={locale === 'pt-BR' ? 'Arquivo da implementação' : 'Implementation file'}
          value={activeFile}
          onChange={(value) => value && setActiveFile(value)}
          data={example.files.map((file) => ({ value: file.path, label: file.path }))}
        />
        <Tabs value={selected.path} onChange={(value) => value && setActiveFile(value)}>
          <Tabs.List>
            {example.files.map((file) => (
              <Tabs.Tab key={file.path} value={file.path}>{file.path.split('/').pop()}</Tabs.Tab>
            ))}
          </Tabs.List>
          {example.files.map((file) => (
            <Tabs.Panel key={file.path} value={file.path} pt="xs">
              <MonacoCodeBlock
                value={file.source}
                language={languageFromPath(file.path)}
                readOnly
                minHeight={220}
                maxHeight={680}
                ariaLabel={`${file.path} implementation code`}
                testId={`cana-framework-playground-${id}-${file.path}`}
              />
            </Tabs.Panel>
          ))}
        </Tabs>

        {output ? (
          <Stack gap={4}>
            <Text fw={600} size="sm">{locale === 'pt-BR' ? 'Resultado inicial' : 'Initial result'}</Text>
            <MonacoCodeBlock
              value={output}
              language="json"
              readOnly
              minHeight={120}
              maxHeight={320}
              ariaLabel={`${example.title[locale]} initial result`}
              testId={`cana-framework-playground-${id}-output`}
            />
          </Stack>
        ) : null}

        {logs.length ? (
          <Stack gap={4}>
            <Text fw={600} size="sm">Console</Text>
            <MonacoCodeBlock
              value={logs.join('\n')}
              language="text"
              readOnly
              minHeight={100}
              maxHeight={260}
              ariaLabel={`${example.title[locale]} console logs`}
            />
          </Stack>
        ) : null}

        {error ? (
          <Alert color="red" title="Error">
            <MonacoCodeBlock value={error} language="text" readOnly minHeight={100} maxHeight={260} />
          </Alert>
        ) : null}
      </Stack>
    </Paper>
  );
}
