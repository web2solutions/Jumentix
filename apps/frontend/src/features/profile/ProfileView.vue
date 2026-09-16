<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { CCol, CRow, CSpinner } from '@coreui/vue';

import { useAuthStore } from '@/stores/auth';
import { useI18n } from '@/i18n';
import { useProfileStore } from '@/stores/profile';
import ProfileScalarsForm from './ProfileScalarsForm.vue';
import ProfilePasswordForm from './ProfilePasswordForm.vue';
import ProfileEmails from './ProfileEmails.vue';
import ProfileDocuments from './ProfileDocuments.vue';
import ProfilePhones from './ProfilePhones.vue';

const router = useRouter();
const auth = useAuthStore();
const profile = useProfileStore();
const { t } = useI18n();

onMounted(async () => {
  try {
    await profile.load();
  } catch (error) {
    // 401 = the session is no longer accepted (expired token, backend
    // restarted with in-memory data wiped). Unauthenticated goes to /login.
    if (error instanceof Error && error.message.includes(' 401 ')) {
      auth.expire();
      profile.reset();
      await router.push('/login');
    }
  }
});
</script>

<template>
  <div>
    <h2 class="mb-3">{{ t('profile.title') }}</h2>
    <div v-if="profile.loading && !profile.record" class="text-center py-5">
      <CSpinner color="primary" />
    </div>
    <template v-else-if="profile.record">
      <CRow>
        <CCol :lg="6">
          <ProfileScalarsForm :record="profile.record" />
        </CCol>
        <CCol :lg="6">
          <ProfilePasswordForm />
        </CCol>
      </CRow>
      <CRow>
        <CCol :lg="12">
          <ProfileEmails :emails="profile.record.emails" />
        </CCol>
        <CCol :lg="12">
          <ProfileDocuments :documents="profile.record.documents" />
        </CCol>
        <CCol :lg="12">
          <ProfilePhones :phones="profile.record.phones" />
        </CCol>
      </CRow>
    </template>
  </div>
</template>
