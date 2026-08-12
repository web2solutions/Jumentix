import type { CanaChangeEvent } from '@jumentix/cana';

export type LocaleText = { en: string; 'pt-BR': string };

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

export type TaskDemoSnapshot = {
  categories: TaskCategory[];
  tasks: Task[];
};

export type CanaFrameworkExampleId =
  | 'react-context-basic'
  | 'react-context-advanced'
  | 'react-redux-basic'
  | 'react-redux-advanced'
  | 'vue-pinia-basic'
  | 'vue-pinia-advanced';

export type CanaFrameworkExample = {
  id: CanaFrameworkExampleId;
  framework: 'React Context' | 'React Redux' | 'Vue 3 + Pinia';
  level: 'simple' | 'advanced';
  title: LocaleText;
  description: LocaleText;
  files: Array<{
    path: string;
    source: string;
  }>;
};

export type CanaFrameworkRunContext = {
  root: HTMLElement;
  dbName: string;
  log: (message: string) => void;
  report: (value: unknown) => void;
};

export type CanaEventApplier = (event: CanaChangeEvent) => void;
