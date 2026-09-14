<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  CButton,
  CDropdown,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle
} from '@coreui/vue';

import { localized, useI18n } from '@/i18n';
import { findModule } from '@/modules/manifest';
import { useShellViewport } from '@/shell/breakpoints';
import { useTaskStore, visibleTaskSlice } from '@/stores/tasks';

const tasks = useTaskStore();
const router = useRouter();
const { t } = useI18n();
const {
  compactTaskbar,
  bottomSheetSwitcher
} = useShellViewport();
const sheetOpen = ref(false);

const MAX_VISIBLE = 8;

const sliced = computed(() => (
  bottomSheetSwitcher.value
    ? { shown: [] as string[], overflow: tasks.open }
    : visibleTaskSlice(tasks.open, MAX_VISIBLE)
));

const titleFor = (moduleId: string): string => {
  const mod = findModule(moduleId);
  return mod ? localized(mod.title) : moduleId;
};

const iconFor = (moduleId: string): string => findModule(moduleId)?.icon ?? 'cil-task';

const activate = (moduleId: string) => {
  tasks.activate(moduleId);
  router.push(`/m/${moduleId}`);
  sheetOpen.value = false;
};

const closeTask = (moduleId: string, event: Event) => {
  event.stopPropagation();
  event.preventDefault();
  tasks.close(moduleId);
  if (tasks.active) {
    router.push(`/m/${tasks.active}`);
  }
};

const onKey = (event: KeyboardEvent, moduleId: string) => {
  const ids = tasks.open;
  const index = ids.indexOf(moduleId);
  if (event.key === 'ArrowRight' && ids[index + 1]) {
    activate(ids[index + 1]);
  } else if (event.key === 'ArrowLeft' && ids[index - 1]) {
    activate(ids[index - 1]);
  } else if (event.key === 'Enter' || event.key === ' ') {
    activate(moduleId);
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    closeTask(moduleId, event);
  }
};
</script>

<template>
  <nav
    class="app-taskbar"
    data-taskbar
    :data-compact="compactTaskbar ? 'true' : 'false'"
    :data-sheet="bottomSheetSwitcher ? 'true' : 'false'"
    :aria-label="t('taskbar.label')"
  >
    <div
      v-if="bottomSheetSwitcher"
      class="app-taskbar__sheet"
    >
      <CButton
        color="secondary"
        variant="ghost"
        class="app-taskbar__touch"
        :aria-expanded="sheetOpen"
        @click="sheetOpen = !sheetOpen"
      >
        {{ t('taskbar.switcher') }}
        <span v-if="tasks.open.length" class="ms-1">({{ tasks.open.length }})</span>
      </CButton>
      <ul v-if="sheetOpen" class="app-taskbar__sheet-list">
        <li v-for="id in tasks.open" :key="id">
          <button type="button" class="app-taskbar__sheet-item" @click="activate(id)">
            {{ titleFor(id) }}
          </button>
        </li>
      </ul>
    </div>
    <div
      v-else
      class="app-taskbar__row"
      role="tablist"
    >
      <div
        v-for="id in sliced.shown"
        :key="id"
        class="app-taskbar__item"
        :data-active="tasks.active === id ? 'true' : 'false'"
      >
        <button
          type="button"
          class="app-taskbar__btn app-taskbar__touch"
          role="tab"
          :aria-selected="tasks.active === id"
          :title="titleFor(id)"
          @click="activate(id)"
          @keydown="onKey($event, id)"
        >
          <CIcon :icon="iconFor(id)" />
          <span class="app-taskbar__label">{{ titleFor(id) }}</span>
        </button>
        <button
          type="button"
          class="app-taskbar__close app-taskbar__touch"
          :aria-label="t('taskbar.close', { name: titleFor(id) })"
          @click="closeTask(id, $event)"
        >
          <CIcon icon="cil-x" />
        </button>
      </div>
      <CDropdown v-if="sliced.overflow.length" variant="nav-item">
        <CDropdownToggle caret class="app-taskbar__touch">
          {{ t('taskbar.more') }}
        </CDropdownToggle>
        <CDropdownMenu>
          <CDropdownItem
            v-for="id in sliced.overflow"
            :key="id"
            component="button"
            type="button"
            @click="activate(id)"
          >
            {{ titleFor(id) }}
          </CDropdownItem>
        </CDropdownMenu>
      </CDropdown>
    </div>
    <p v-if="!tasks.open.length" class="app-taskbar__empty mb-0">{{ t('taskbar.empty') }}</p>
  </nav>
</template>
