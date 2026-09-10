import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { RestApiRequestEvent } from '@jumentix/sdk-rest-client';

import { getSharedApiClient } from '@/contracts/apiClient';

export interface NetworkRequestRecord {
  operationId: string;
  method: string;
  url: string;
  status?: number;
  durationMs?: number;
  ok: boolean;
}

const MAX_RECENT = 10;

/**
 * Feeds the NetworkActivity widget from the SDK's request lifecycle events
 * (JUM-765): the SDK is the intermediary of every UI↔server call, so this
 * store simply aggregates what it emits.
 */
export const useNetworkStore = defineStore('network', () => {
  const inFlight = ref(0);
  const recent = ref<NetworkRequestRecord[]>([]);
  let unsubscribe: (() => void) | undefined;

  const onEvent = (event: RestApiRequestEvent) => {
    if (event.type === 'request:start') {
      inFlight.value += 1;
      return;
    }
    inFlight.value = Math.max(0, inFlight.value - 1);
    recent.value = [
      {
        operationId: event.operationId,
        method: event.method.toUpperCase(),
        url: event.url,
        status: event.status,
        durationMs: event.durationMs,
        ok: event.type === 'request:success'
      },
      ...recent.value
    ].slice(0, MAX_RECENT);
  };

  const start = (): void => {
    if (!unsubscribe) {
      unsubscribe = getSharedApiClient().subscribe(onEvent);
    }
  };

  const stop = (): void => {
    unsubscribe?.();
    unsubscribe = undefined;
  };

  return {
    inFlight, recent, start, stop
  };
});
