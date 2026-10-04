'use client';

import React, { createContext, useContext, useMemo, useReducer, useRef, useState } from 'react';

import { createClient } from '@jumentix/cana';
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
import { configureStore, createSlice } from '@reduxjs/toolkit';
import { IconDownload } from '@tabler/icons-react';
import { usePathname } from 'next/navigation';
import { createRoot } from 'react-dom/client';
import { Provider, useDispatch, useSelector } from 'react-redux';

import { getCanaFrameworkExample } from './catalog';
import jumentixTheme from '../../theme';
import { languageFromPath, MonacoCodeBlock } from '../code/MonacoCodeBlock';
import trimTrailingBlankCodeLines from '../code/normalizeCode';
import { deleteEphemeralDatabase } from '../docs-playground/runSnippet';

import type { CanaChangeEvent, CanaClient, CanaSchema } from '@jumentix/cana';
import type { PayloadAction } from '@reduxjs/toolkit';

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
      name: 'categories',
      keyPath: 'id',
      indexes: [{ name: 'byName', keyPath: 'name', unique: true }]
    },
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

const baseCategories: TaskCategory[] = [
  { id: 'work', name: 'Work', color: '#2563eb', createdAt: 1, updatedAt: 1 },
  { id: 'home', name: 'Home', color: '#16a34a', createdAt: 2, updatedAt: 2 }
];

const baseTasks: Task[] = [
  {
    id: 'task-1',
    title: 'Write the Cana tutorial',
    categoryId: 'work',
    completed: false,
    priority: 'high',
    createdAt: 3,
    updatedAt: 3
  },
  {
    id: 'task-2',
    title: 'Review category filters',
    categoryId: 'home',
    completed: true,
    priority: 'medium',
    createdAt: 4,
    updatedAt: 4
  }
];

function currentColorScheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.getAttribute('data-mantine-color-scheme') === 'light'
    ? 'light'
    : 'dark';
}

const DemoMantineProvider = ({ children }: { children: React.ReactNode }) => (
  <MantineProvider
    forceColorScheme={currentColorScheme()}
    theme={jumentixTheme}
    withCssVariables={false}
    withGlobalClasses={false}
  >
    {children}
  </MantineProvider>
);

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
  await client.table<TaskCategory>('categories').bulkPut(baseCategories);
  await client.table<Task>('tasks').bulkPut(baseTasks);
}

async function snapshot(client: CanaClient): Promise<TaskDemoSnapshot> {
  const categories = await client.table<TaskCategory>('categories').query({ index: 'byName' });
  const tasks = await client.table<Task>('tasks').query({ index: 'byUpdatedAt' });
  return {
    categories: [...categories],
    tasks: [...tasks]
  };
}

function applyEvent(state: TaskDemoSnapshot, event: CanaChangeEvent): TaskDemoSnapshot {
  if (event.store === 'categories') {
    if (event.type === 'cleared') return { ...state, categories: [] };
    if (event.type === 'deleted') {
      return { ...state, categories: state.categories.filter((item) => item.id !== event.key) };
    }
    const record = event.record as TaskCategory;
    return {
      ...state,
      categories: [...state.categories.filter((item) => item.id !== record.id), record].sort(
        (a, b) => a.name.localeCompare(b.name)
      )
    };
  }

  if (event.store === 'tasks') {
    if (event.type === 'cleared') return { ...state, tasks: [] };
    if (event.type === 'deleted') {
      return { ...state, tasks: state.tasks.filter((item) => item.id !== event.key) };
    }
    const record = event.record as Task;
    return {
      ...state,
      tasks: [...state.tasks.filter((item) => item.id !== record.id), record].sort(
        (a, b) => a.updatedAt - b.updatedAt
      )
    };
  }

  return state;
}

function eventLabel(event: CanaChangeEvent): string {
  return `${event.cursor}: ${event.type} ${event.store}${event.key ? `/${String(event.key)}` : ''}`;
}

const TaskBoard = ({
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
}) => {
  const grouped = value.categories.map((category) => ({
    category,
    tasks: value.tasks.filter((task) => task.categoryId === category.id)
  }));

  return (
    <Stack className="cana-framework-demo" gap="sm">
      <Group gap="xs">
        <Button className="cana-framework-demo-action" onClick={onAddTask} size="xs">
          Add task through Cana
        </Button>
        {onAdvanced ? (
          <Button
            className="cana-framework-demo-action"
            onClick={onAdvanced}
            size="xs"
            variant="default"
          >
            Run transaction
          </Button>
        ) : null}
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        {grouped.map(({ category, tasks }) => (
          <Paper
            key={category.id}
            withBorder
            className="cana-framework-demo-card"
            p="sm"
            radius={6}
          >
            <Group justify="space-between" mb={6}>
              <Text fw={700}>{category.name}</Text>
              <Badge color={category.id === 'work' ? 'blue' : 'green'}>{tasks.length}</Badge>
            </Group>
            <Stack gap={4}>
              {tasks.map((task) => (
                <Button
                  key={task.id}
                  className="cana-framework-demo-task"
                  justify="space-between"
                  onClick={() => onToggle(task)}
                  size="xs"
                  variant={task.completed ? 'light' : 'default'}
                >
                  {task.completed ? 'Done: ' : ''}
                  {task.title}
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
};

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

const ReactContextProvider = ({
  client,
  initial,
  advanced,
  children
}: {
  client: CanaClient;
  initial: TaskDemoSnapshot;
  advanced?: boolean;
  children: React.ReactNode;
}) => {
  const [state, dispatch] = useReducer(reactContextReducer, { ...initial, events: [] });
  const counter = useRef(10);

  React.useEffect(() => {
    const stop = client.subscribe((event) => dispatch(event));
    return () => stop();
  }, [client]);

  const api = useMemo(
    () => ({
      state,
      addTask: async () => {
        counter.current += 1;
        await client.table<Task>('tasks').add({
          id: `context-${counter.current}`,
          title: `Context task ${counter.current}`,
          categoryId: counter.current % 2 ? 'work' : 'home',
          completed: false,
          priority: 'medium',
          createdAt: counter.current,
          updatedAt: counter.current
        });
      },
      toggleTask: async (task: Task) => {
        await client.table<Task>('tasks').update(task.id, {
          completed: !task.completed,
          updatedAt: Date.now()
        });
      },
      runTransaction: advanced
        ? async () => {
            counter.current += 1;
            await client.transaction('readwrite', ['categories', 'tasks'], async (scope) => {
              await scope.table<TaskCategory>('categories').put({
                id: 'ops',
                name: 'Operations',
                color: '#f97316',
                createdAt: counter.current,
                updatedAt: counter.current
              });
              await scope.table<Task>('tasks').put({
                id: `context-tx-${counter.current}`,
                title: 'Created with a Cana transaction',
                categoryId: 'ops',
                completed: false,
                priority: 'high',
                createdAt: counter.current,
                updatedAt: counter.current
              });
            });
          }
        : undefined
    }),
    [advanced, client, state]
  );

  return <TaskContext.Provider value={api}>{children}</TaskContext.Provider>;
};

const ReactContextBoard = () => {
  const ctx = useContext(TaskContext);
  if (!ctx) return null;
  return (
    <TaskBoard
      events={ctx.state.events}
      snapshot={ctx.state}
      onAddTask={() => {
        ctx.addTask().catch(() => undefined);
      }}
      onAdvanced={
        ctx.runTransaction
          ? () => {
              ctx.runTransaction?.().catch(() => undefined);
            }
          : undefined
      }
      onToggle={(task) => {
        ctx.toggleTask(task).catch(() => undefined);
      }}
    />
  );
};

async function runReactContext(context: CanaFrameworkRunContext, advanced: boolean) {
  const client = await openTaskClient(
    context.dbName,
    advanced ? 'react-context-advanced' : 'react-context-basic'
  );
  await seed(client);
  const initial = await snapshot(client);
  const root = createRoot(context.root);
  root.render(
    <DemoMantineProvider>
      <ReactContextProvider advanced={advanced} client={client} initial={initial}>
        <ReactContextBoard />
      </ReactContextProvider>
    </DemoMantineProvider>
  );
  context.report({ backend: client.backend, state: initial });
  return () => {
    root.unmount();
    client.close().catch(() => undefined);
  };
}

type ReduxState = TaskDemoSnapshot & { events: string[] };

function createReduxStore(initial: TaskDemoSnapshot) {
  const categories = createSlice({
    name: 'categories',
    initialState: initial.categories,
    reducers: {
      upsert: (state, action: PayloadAction<TaskCategory>) => {
        const index = state.findIndex((item) => item.id === action.payload.id);
        // eslint-disable-next-line no-param-reassign -- Redux Toolkit reducer: state is an Immer draft, mutation is the intended API
        if (index >= 0) state[index] = action.payload;
        else state.push(action.payload);
        state.sort((a, b) => a.name.localeCompare(b.name));
      },
      remove: (state, action: PayloadAction<string>) =>
        state.filter((item) => item.id !== action.payload),
      clear: () => []
    }
  });
  const tasks = createSlice({
    name: 'tasks',
    initialState: initial.tasks,
    reducers: {
      upsert: (state, action: PayloadAction<Task>) => {
        const index = state.findIndex((item) => item.id === action.payload.id);
        // eslint-disable-next-line no-param-reassign -- Redux Toolkit reducer: state is an Immer draft, mutation is the intended API
        if (index >= 0) state[index] = action.payload;
        else state.push(action.payload);
        state.sort((a, b) => a.updatedAt - b.updatedAt);
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
    if (event.store === 'categories') {
      if (event.type === 'cleared') store.dispatch(categories.actions.clear());
      else if (event.type === 'deleted')
        store.dispatch(categories.actions.remove(String(event.key)));
      else store.dispatch(categories.actions.upsert(event.record as TaskCategory));
    }
    if (event.store === 'tasks') {
      if (event.type === 'cleared') store.dispatch(tasks.actions.clear());
      else if (event.type === 'deleted') store.dispatch(tasks.actions.remove(String(event.key)));
      else store.dispatch(tasks.actions.upsert(event.record as Task));
    }
  };
  return { store, apply };
}

const ReduxBoard = ({ client, advanced }: { client: CanaClient; advanced?: boolean }) => {
  const dispatch = useDispatch();
  const categories = useSelector((state: ReduxState) => state.categories);
  const tasks = useSelector((state: ReduxState) => state.tasks);
  const events = useSelector((state: ReduxState) => state.events);
  const counter = useRef(20);

  const writeTask = async () => {
    counter.current += 1;
    await client.table<Task>('tasks').put({
      id: `redux-${counter.current}`,
      title: `Redux task ${counter.current}`,
      categoryId: counter.current % 2 ? 'work' : 'home',
      completed: false,
      priority: 'medium',
      createdAt: counter.current,
      updatedAt: counter.current
    });
  };

  const toggle = async (task: Task) => {
    await client.table<Task>('tasks').update(task.id, {
      completed: !task.completed,
      updatedAt: Date.now()
    });
  };

  const runTransaction = async () => {
    if (!advanced) return;
    counter.current += 1;
    await client.transaction('readwrite', ['categories', 'tasks'], async (scope) => {
      await scope.table<TaskCategory>('categories').put({
        id: 'release',
        name: 'Release',
        color: '#7c3aed',
        createdAt: counter.current,
        updatedAt: counter.current
      });
      await scope.table<Task>('tasks').put({
        id: `redux-tx-${counter.current}`,
        title: 'Redux received transaction events',
        categoryId: 'release',
        completed: false,
        priority: 'high',
        createdAt: counter.current,
        updatedAt: counter.current
      });
    });
    dispatch({ type: 'demo/transactionFinished' });
  };

  return (
    <TaskBoard
      events={events}
      snapshot={{ categories, tasks }}
      onAddTask={() => {
        writeTask().catch(() => undefined);
      }}
      onAdvanced={
        advanced
          ? () => {
              runTransaction().catch(() => undefined);
            }
          : undefined
      }
      onToggle={(task) => {
        toggle(task).catch(() => undefined);
      }}
    />
  );
};

async function runRedux(context: CanaFrameworkRunContext, advanced: boolean) {
  const client = await openTaskClient(
    context.dbName,
    advanced ? 'react-redux-advanced' : 'react-redux-basic'
  );
  await seed(client);
  const initial = await snapshot(client);
  const { store, apply } = createReduxStore(initial);
  const stop = client.subscribe(apply);
  const root = createRoot(context.root);
  root.render(
    <DemoMantineProvider>
      <Provider store={store}>
        <ReduxBoard advanced={advanced} client={client} />
      </Provider>
    </DemoMantineProvider>
  );
  context.report({ backend: client.backend, state: store.getState() });
  return () => {
    stop();
    root.unmount();
    client.close().catch(() => undefined);
  };
}

async function runVuePinia(context: CanaFrameworkRunContext, advanced: boolean) {
  const { computed, createApp, defineComponent, h, onMounted, onUnmounted, ref } =
    await import('vue');
  const { createPinia, defineStore } = await import('pinia');
  const client = await openTaskClient(
    context.dbName,
    advanced ? 'vue-pinia-advanced' : 'vue-pinia-basic'
  );
  await seed(client);
  const initial = await snapshot(client);
  const pinia = createPinia();
  const tasksStore = defineStore(`tasks-${context.dbName}`, {
    state: () => ({
      categories: initial.categories,
      tasks: initial.tasks,
      events: [] as string[],
      counter: 30
    }),
    getters: {
      groups: (state) =>
        state.categories.map((category) => ({
          category,
          tasks: state.tasks.filter((task) => task.categoryId === category.id)
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
        await client.table<Task>('tasks').put({
          id: `pinia-${this.counter}`,
          title: `Pinia task ${this.counter}`,
          categoryId: this.counter % 2 ? 'work' : 'home',
          completed: false,
          priority: 'medium',
          createdAt: this.counter,
          updatedAt: this.counter
        });
      },
      async toggle(task: Task) {
        await client.table<Task>('tasks').update(task.id, {
          completed: !task.completed,
          updatedAt: Date.now()
        });
      },
      async runTransaction() {
        this.counter += 1;
        await client.transaction('readwrite', ['categories', 'tasks'], async (scope) => {
          await scope.table<TaskCategory>('categories').put({
            id: 'qa',
            name: 'QA',
            color: '#dc2626',
            createdAt: this.counter,
            updatedAt: this.counter
          });
          await scope.table<Task>('tasks').put({
            id: `pinia-tx-${this.counter}`,
            title: 'Pinia updated by the Cana transaction',
            categoryId: 'qa',
            completed: false,
            priority: 'high',
            createdAt: this.counter,
            updatedAt: this.counter
          });
        });
      }
    }
  });

  const app = createApp(
    defineComponent({
      setup() {
        const store = tasksStore();
        const groups = computed(() => store.groups);
        const stop = ref<(() => void) | null>(null);
        onMounted(() => {
          stop.value = client.subscribe((event) => store.apply(event));
        });
        onUnmounted(() => stop.value?.());
        return () =>
          h('div', { class: 'cana-framework-demo cana-vue-demo' }, [
            h('div', { class: 'cana-framework-demo-actions' }, [
              h(
                'button',
                {
                  class: 'cana-framework-demo-action cana-framework-demo-native-action',
                  type: 'button',
                  onClick: () => {
                    store.addTask().catch(() => undefined);
                  }
                },
                'Add task through Cana'
              ),
              advanced
                ? h(
                    'button',
                    {
                      class: 'cana-framework-demo-action cana-framework-demo-native-action',
                      type: 'button',
                      onClick: () => {
                        store.runTransaction().catch(() => undefined);
                      }
                    },
                    'Run transaction'
                  )
                : null
            ]),
            h(
              'div',
              { class: 'cana-framework-demo-grid' },
              groups.value.map(({ category, tasks: list }) =>
                h(
                  'section',
                  {
                    key: category.id,
                    class: 'cana-framework-demo-card'
                  },
                  [
                    h('strong', category.name),
                    h('span', { class: 'cana-framework-demo-count' }, `${list.length} tasks`),
                    h(
                      'div',
                      { class: 'cana-framework-demo-list' },
                      list.map((task) =>
                        h(
                          'button',
                          {
                            class: 'cana-framework-demo-task cana-framework-demo-native-task',
                            key: task.id,
                            type: 'button',
                            onClick: () => {
                              store.toggle(task).catch(() => undefined);
                            }
                          },
                          `${task.completed ? 'Done: ' : ''}${task.title}`
                        )
                      )
                    )
                  ]
                )
              )
            ),
            h(
              'pre',
              { class: 'cana-framework-demo-events cana-framework-demo-native-events' },
              store.events.length ? store.events.join('\n') : 'No Cana events yet.'
            )
          ]);
      }
    })
  );
  app.use(pinia);
  app.mount(context.root);
  context.report({ backend: client.backend, state: initial });
  return () => {
    app.unmount();
    client.close().catch(() => undefined);
  };
}

const RUNNERS: Record<
  CanaFrameworkExampleId,
  (context: CanaFrameworkRunContext) => Promise<() => void>
> = {
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

function agentMarkdownForExample(example: CanaFrameworkExample, locale: 'en' | 'pt-BR'): string {
  const fileBlocks = example.files.map((file) =>
    [
      `#### ${file.path}`,
      '',
      `\`\`\`${languageFromPath(file.path)}`,
      trimTrailingBlankCodeLines(file.source),
      '```'
    ].join('\n')
  );

  return [`### ${example.title[locale]}`, example.description[locale], ...fileBlocks].join('\n\n');
}

export interface CanaFrameworkPlaygroundProps {
  id: CanaFrameworkExampleId;
}

export const CanaFrameworkPlayground = ({ id }: CanaFrameworkPlaygroundProps) => {
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
  const [previousExample, setPreviousExample] = useState(example);

  if (previousExample !== example) {
    setPreviousExample(example);
    setActiveFile(example?.files[0]?.path ?? '');
  }

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

  React.useEffect(
    () => () => {
      cleanupRef.current?.();
    },
    []
  );

  if (!example) {
    return (
      <Alert color="red" my="md" title="Cana framework example not found">
        <Text className="jtx-inline-code" component="code">
          {id}
        </Text>
      </Alert>
    );
  }

  const selected = example.files.find((file) => file.path === activeFile) ?? example.files[0];

  return (
    <Paper
      withBorder
      className="cana-framework-playground"
      data-testid={`cana-framework-playground-${id}`}
      my="md"
      p="md"
    >
      <Stack gap="sm">
        <div>
          <Group gap="xs" mb={4}>
            <Badge>{example.framework}</Badge>
            <Badge variant="light">{example.level}</Badge>
          </Group>
          <Title order={4}>{example.title[locale]}</Title>
          <Text c="dimmed" size="sm">
            {example.description[locale]}
          </Text>
        </div>

        <pre
          hidden
          data-agent-markdown="cana-framework-full-app"
          data-testid={`cana-framework-playground-${id}-agent-markdown`}
        >
          {agentMarkdownForExample(example, locale)}
        </pre>

        <Group>
          <Button
            data-testid={`cana-framework-playground-${id}-run`}
            loading={running}
            size="sm"
            onClick={() => {
              handleRun().catch(() => undefined);
            }}
          >
            {locale === 'pt-BR' ? 'Executar' : 'Run'}
          </Button>
          <Button
            data-testid={`cana-framework-playground-${id}-reset`}
            disabled={running}
            size="sm"
            variant="default"
            onClick={() => {
              handleReset().catch(() => undefined);
            }}
          >
            {locale === 'pt-BR' ? 'Resetar' : 'Reset'}
          </Button>
          {example.download ? (
            <Button
              download
              component="a"
              href={example.download.href}
              leftSection={<IconDownload aria-hidden="true" size={16} />}
              size="sm"
              variant="light"
            >
              {example.download.label[locale]}
            </Button>
          ) : null}
        </Group>

        <Box
          ref={rootRef}
          className="cana-framework-preview"
          data-testid={`cana-framework-playground-${id}-preview`}
          mih={180}
          p="sm"
        />

        <Select
          data={example.files.map((file) => ({ value: file.path, label: file.path }))}
          label={locale === 'pt-BR' ? 'Arquivo da implementação' : 'Implementation file'}
          onChange={(value) => value && setActiveFile(value)}
          value={activeFile}
        />
        <Tabs onChange={(value) => value && setActiveFile(value)} value={selected.path}>
          <Tabs.List>
            {example.files.map((file) => (
              <Tabs.Tab key={file.path} value={file.path}>
                {file.path.split('/').pop()}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {example.files.map((file) => (
            <Tabs.Panel key={file.path} pt="xs" value={file.path}>
              <MonacoCodeBlock
                readOnly
                ariaLabel={`${file.path} implementation code`}
                language={languageFromPath(file.path)}
                maxHeight={680}
                minHeight={220}
                testId={`cana-framework-playground-${id}-${file.path}`}
                value={trimTrailingBlankCodeLines(file.source)}
              />
            </Tabs.Panel>
          ))}
        </Tabs>

        {output ? (
          <Stack gap={4}>
            <Text fw={600} size="sm">
              {locale === 'pt-BR' ? 'Resultado inicial' : 'Initial result'}
            </Text>
            <MonacoCodeBlock
              readOnly
              ariaLabel={`${example.title[locale]} initial result`}
              language="json"
              maxHeight={320}
              minHeight={120}
              testId={`cana-framework-playground-${id}-output`}
              value={output}
            />
          </Stack>
        ) : null}

        {logs.length ? (
          <Stack gap={4}>
            <Text fw={600} size="sm">
              Console
            </Text>
            <MonacoCodeBlock
              readOnly
              ariaLabel={`${example.title[locale]} console logs`}
              language="text"
              maxHeight={260}
              minHeight={100}
              value={logs.join('\n')}
            />
          </Stack>
        ) : null}

        {error ? (
          <Alert color="red" title="Error">
            <MonacoCodeBlock
              readOnly
              language="text"
              maxHeight={260}
              minHeight={100}
              value={error}
            />
          </Alert>
        ) : null}
      </Stack>
    </Paper>
  );
};
