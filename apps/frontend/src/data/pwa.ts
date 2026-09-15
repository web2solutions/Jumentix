import { useNotificationStore } from '@/stores/notifications';
import { t } from '@/i18n';

const pwaEnabled = (): boolean => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;
  return Boolean(import.meta.env.PROD) || import.meta.env.VITE_PWA === '1';
};

export const registerSW = (): void => {
  if (!pwaEnabled()) return;
  navigator.serviceWorker.register('./sw.js').then((registration) => {
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          useNotificationStore().push({
            kind: 'update',
            title: t('pwa.updateTitle'),
            message: t('pwa.updateBody')
          });
        }
      });
    });
  }).catch(() => undefined);
};
