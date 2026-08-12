import type { CanaChangeEvent } from '@jumentix/cana';

export type LocaleText = { en: string; 'pt-BR': string };

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

export type TaskCategory = Categoria;
export type Task = Tarefa;

export type TaskDemoSnapshot = {
  categories: Categoria[];
  tasks: Tarefa[];
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
  download?: {
    href: string;
    label: LocaleText;
  };
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
