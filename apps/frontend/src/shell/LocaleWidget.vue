<script setup lang="ts">
import { CDropdown, CDropdownItem, CDropdownMenu, CDropdownToggle } from '@coreui/vue';

import { useI18n } from '@/i18n';

const { t, locale, setLocale, locales } = useI18n();
</script>

<template>
  <CDropdown variant="nav-item" placement="bottom-end" data-widget="locale" :aria-label="t('app.language')">
    <CDropdownToggle :caret="false">
      <CIcon icon="cil-list" size="lg" />
    </CDropdownToggle>
    <CDropdownMenu>
      <CDropdownItem
        v-for="item in locales"
        :key="item"
        :active="locale === item"
        component="button"
        type="button"
        @click="setLocale(item)"
      >
        {{ item === 'en' ? 'English' : 'Português (BR)' }}
      </CDropdownItem>
    </CDropdownMenu>
  </CDropdown>
</template>
