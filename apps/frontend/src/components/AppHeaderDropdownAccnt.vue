<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  CAvatar, CDropdown, CDropdownDivider, CDropdownHeader, CDropdownItem, CDropdownMenu, CDropdownToggle
} from '@coreui/vue';

import { useI18n } from '@/i18n';
import { useAuthStore } from '@/stores/auth';
import { useProfileStore } from '@/stores/profile';

/**
 * Account menu (JUM-781): only what the product has — the signed-in identity,
 * Profile, language and Logout. The CoreUI template entries (Updates 42,
 * Messages, Payments, Lock Account…) were dead links and are gone.
 */
const router = useRouter();
const auth = useAuthStore();
const profile = useProfileStore();
const { t, locale, locales, setLocale } = useI18n();

const initials = computed(() => {
  const first = profile.record?.firstName?.trim() ?? '';
  const last = profile.record?.lastName?.trim() ?? '';
  const fromName = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  return fromName || (auth.username.charAt(0).toUpperCase() || 'J');
});

const displayName = computed(() => (
  profile.record ? `${profile.record.firstName ?? ''} ${profile.record.lastName ?? ''}`.trim() : auth.username
));

const goToProfile = async () => {
  await router.push('/profile');
};

const logout = async () => {
  try {
    await auth.logout();
  } finally {
    profile.reset();
    await router.push('/login');
  }
};
</script>

<template>
  <CDropdown placement="bottom-end" variant="nav-item">
    <CDropdownToggle class="py-0 pe-0" :caret="false" :aria-label="t('nav.account')">
      <CAvatar
        v-if="profile.record?.avatar"
        :src="String(profile.record.avatar)"
        size="md"
      />
      <CAvatar v-else color="primary" text-color="white" size="md">{{ initials }}</CAvatar>
    </CDropdownToggle>
    <CDropdownMenu class="pt-0">
      <CDropdownHeader
        component="h6"
        class="bg-body-secondary text-body-secondary fw-semibold mb-2 rounded-top"
      >
        {{ displayName || t('nav.account') }}
      </CDropdownHeader>
      <CDropdownItem component="button" @click="goToProfile">
        <CIcon icon="cil-user" /> {{ t('nav.profile') }}
      </CDropdownItem>
      <CDropdownHeader component="h6" class="bg-body-secondary text-body-secondary fw-semibold my-2">
        {{ t('app.language') }}
      </CDropdownHeader>
      <CDropdownItem
        v-for="code in locales"
        :key="code"
        component="button"
        :active="locale === code"
        :aria-pressed="locale === code"
        @click="setLocale(code)"
      >
        {{ code === 'pt-BR' ? 'Português (BR)' : 'English' }}
      </CDropdownItem>
      <CDropdownDivider />
      <CDropdownItem component="button" @click="logout">
        <CIcon icon="cil-lock-locked" /> {{ t('nav.logout') }}
      </CDropdownItem>
    </CDropdownMenu>
  </CDropdown>
</template>
