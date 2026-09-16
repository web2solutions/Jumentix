import {
  afterEach, beforeEach, describe, expect, it
} from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';

import { registerSW } from '@/data/pwa';
import { useNotificationStore } from '@/stores/notifications';

type Listener = () => void;

const flush = async (times = 3): Promise<void> => {
  for (let index = 0; index < times; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  }
};

const makeRegistration = () => {
  const listeners: Record<string, Listener> = {};
  const workerListeners: Record<string, Listener> = {};
  const worker = {
    state: 'installing',
    addEventListener: (event: string, listener: Listener) => {
      workerListeners[event] = listener;
    }
  };
  const registration = {
    installing: worker as { state: string } | null,
    addEventListener: (event: string, listener: Listener) => {
      listeners[event] = listener;
    }
  };
  return {
    listeners, workerListeners, worker, registration
  };
};

const installServiceWorker = (value: unknown): void => {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value
  });
};

/** PWA update flow (JUM-808): register ./sw.js and notify on installed updates. */
describe('PWA service worker registration (JUM-808)', () => {
  const originalFlag = process.env.VITE_PWA;

  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.VITE_PWA;
    else process.env.VITE_PWA = originalFlag;
    delete (navigator as { serviceWorker?: unknown }).serviceWorker;
  });

  it('does nothing when the origin has no service worker support', () => {
    expect.hasAssertions();
    process.env.VITE_PWA = '1';
    registerSW();
    expect(useNotificationStore().items).toHaveLength(0);
  });

  it('does nothing when PWA is disabled (not PROD and VITE_PWA unset)', () => {
    expect.hasAssertions();
    delete process.env.VITE_PWA;
    const registered: string[] = [];
    installServiceWorker({
      controller: null,
      register: async (script: string) => {
        registered.push(script);
      }
    });
    registerSW();
    expect(registered).toHaveLength(0);
  });

  it('registers ./sw.js and pushes an update notification once installed', async () => {
    expect.hasAssertions();
    process.env.VITE_PWA = '1';
    const fake = makeRegistration();
    const registered: string[] = [];
    installServiceWorker({
      controller: {},
      register: async (script: string) => {
        registered.push(script);
        return fake.registration;
      }
    });
    registerSW();
    await flush();
    fake.listeners.updatefound?.();
    fake.worker.state = 'installed';
    fake.workerListeners.statechange?.();
    expect(registered).toStrictEqual(['./sw.js']);
    expect(useNotificationStore().items.some((item) => item.kind === 'update')).toBe(true);
  });

  it('ignores updatefound without an installing worker and swallows register failures', async () => {
    expect.hasAssertions();
    process.env.VITE_PWA = '1';
    const fake = makeRegistration();
    fake.registration.installing = null;
    installServiceWorker({ controller: null, register: async () => fake.registration });
    registerSW();
    await flush();
    fake.listeners.updatefound?.();
    expect(useNotificationStore().items).toHaveLength(0);
    installServiceWorker({
      controller: null,
      register: async () => {
        throw new Error('sw denied');
      }
    });
    expect(() => registerSW()).not.toThrow();
  });
});
