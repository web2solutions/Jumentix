import { ref } from 'vue';

import { formatApiError } from '@/contracts/errors';
import { t } from '@/i18n';

/**
 * Per-section feedback for the profile cards (JUM-765): each card shows its
 * own inline alert where the action happened, instead of the page-top alert
 * the user could not see from the bottom of the page.
 */
export const useSectionNotify = () => {
  const errorMessage = ref('');
  const successMessage = ref('');
  let dismissTimer: ReturnType<typeof setTimeout> | undefined;

  const run = async (
    action: () => Promise<'updated' | 'already-removed' | void>,
    successText: string
  ): Promise<void> => {
    errorMessage.value = '';
    successMessage.value = '';
    try {
      const outcome = await action();
      successMessage.value = outcome === 'already-removed'
        ? t('profile.alreadyRemoved')
        : successText;
      if (dismissTimer) clearTimeout(dismissTimer);
      dismissTimer = setTimeout(() => {
        successMessage.value = '';
      }, 4000);
    } catch (error) {
      errorMessage.value = formatApiError(error);
    }
  };

  return { errorMessage, successMessage, run };
};
