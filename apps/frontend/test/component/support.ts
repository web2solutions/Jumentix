import { mount, type MountingOptions } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import CIcon from '@coreui/icons-vue';
import CoreuiVue from '@coreui/vue';
import {
  cilArrowBottom, cilArrowTop, cilCheck, cilCloudDownload, cilCloudUpload,
  cilFeaturedPlaylist, cilFilter, cilInbox, cilLockLocked, cilMenu, cilPencil,
  cilPeople, cilPlus, cilReload, cilSave, cilSearch, cilSpeedometer, cilSquare,
  cilSwapVertical, cilTask, cilTrash, cilUser, cilViewColumn, cilX
} from '@coreui/icons';
import type { Component } from 'vue';

import { resetSharedApiClient } from '@/contracts/apiClient';
import { setLocale, type Locale } from '@/i18n';
import { useAuthStore } from '@/stores/auth';
import { useProfileStore } from '@/stores/profile';

/**
 * Shared harness for component suites (JUM-776): real CoreUI plugin, the
 * icons the shell registers, a fresh Pinia with a signed-in superadmin
 * session, and the locale pinned so assertions on text are deterministic.
 */
export const icons = {
  cilArrowBottom,
  cilArrowTop,
  cilCheck,
  cilCloudDownload,
  cilCloudUpload,
  cilFeaturedPlaylist,
  cilFilter,
  cilInbox,
  cilLockLocked,
  cilMenu,
  cilPencil,
  cilPeople,
  cilPlus,
  cilReload,
  cilSave,
  cilSearch,
  cilSpeedometer,
  cilSquare,
  cilSwapVertical,
  cilTask,
  cilTrash,
  cilUser,
  cilViewColumn,
  cilX
};

export interface RecordedCall {
  url: string;
  method: string;
  body?: unknown;
}

export const recorded: RecordedCall[] = [];

export interface Answer {
  status?: number;
  body?: unknown;
}

export type Responder = (url: URL, init: { method: string; body?: string }) => Answer | undefined;

/** Installs a fetch mock; the responder decides status/body per call (default: 200 `{}`). */
export const mockFetch = (responder: Responder = () => undefined): void => {
  recorded.length = 0;
  globalThis.fetch = ((url: string, init: { method: string; body?: string } = { method: 'GET' }) => {
    recorded.push({
      url: String(url),
      method: init.method,
      body: init.body ? JSON.parse(init.body) : undefined
    });
    const answer = responder(new URL(String(url)), init) ?? {};
    const status = answer.status ?? 200;
    return Promise.resolve({
      ok: status < 400,
      status,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve(answer.body ?? {}),
      text: () => Promise.resolve(JSON.stringify(answer.body ?? {}))
    } as unknown as Response);
  }) as typeof fetch;
};

export const flush = async (times = 3): Promise<void> => {
  for (let index = 0; index < times; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  }
};

export interface Session {
  roles?: string[];
  organization?: string;
  locale?: Locale;
}

export const freshSession = ({ roles = ['superadmin'], organization, locale = 'en' }: Session = {}): Pinia => {
  resetSharedApiClient();
  setLocale(locale);
  const pinia = createPinia();
  setActivePinia(pinia);
  const auth = useAuthStore();
  auth.token = 'Bearer session-token';
  auth.userId = 'u1';
  auth.username = 'zoe@x.dev';
  const profile = useProfileStore();
  profile.record = {
    id: 'u1',
    firstName: 'Zoe',
    lastName: 'Lima',
    username: 'zoe@x.dev',
    roles,
    organization,
    emails: [],
    documents: [],
    phones: []
  };
  return pinia;
};

export const mountWithShell = <T extends Component>(
  component: T,
  options: MountingOptions<Record<string, unknown>> & { pinia?: Pinia } = {}
) => {
  const pinia = options.pinia ?? freshSession();
  const extraPlugins = (options.global?.plugins ?? []).filter((plugin) => plugin !== pinia);
  return mount(component, {
    ...options,
    global: {
      ...(options.global ?? {}),
      plugins: [pinia, CoreuiVue, ...extraPlugins],
      provide: { icons },
      components: { CIcon },
      stubs: {
        RouterLink: { template: '<a><slot :href="\'#\'" :navigate="() => {}" :isActive="false" /></a>' },
        // Chart.js needs a real <canvas> 2D context, which happy-dom does not
        // provide; the chart's inputs are asserted through `aggregateBreakdown`
        // in the unit suite, and the browser e2e renders the real canvas.
        XCrudChart: { props: ['title', 'breakdown'], template: '<div class="xcrud-chart-stub">{{ title }}</div>' },
        ...(options.global?.stubs ?? {})
      }
    },
    attachTo: document.body
  });
};
