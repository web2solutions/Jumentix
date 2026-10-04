import type { CanaChangeEvent } from '@jumentix/cana';

export interface LocaleText {
  en: string;
  'pt-BR': string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  updatedAt: number;
}

export interface Task {
  id: string;
  title: string;
  categoryId: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export type TaskCategory = Category;

export interface TaskDemoSnapshot {
  categories: Category[];
  tasks: Task[];
}

export type CanaFrameworkExampleId =
  | 'react-context-basic'
  | 'react-context-advanced'
  | 'react-redux-basic'
  | 'react-redux-advanced'
  | 'vue-pinia-basic'
  | 'vue-pinia-advanced';

export interface CanaFrameworkExample {
  id: CanaFrameworkExampleId;
  framework: 'React Context' | 'React Redux' | 'Vue 3 + Pinia';
  level: 'simple' | 'advanced';
  title: LocaleText;
  description: LocaleText;
  download?: {
    href: string;
    label: LocaleText;
  };
  files: {
    path: string;
    source: string;
  }[];
}

export interface CanaFrameworkRunContext {
  root: HTMLElement;
  dbName: string;
  log: (message: string) => void;
  report: (value: unknown) => void;
}

export type CanaEventApplier = (event: CanaChangeEvent) => void;
