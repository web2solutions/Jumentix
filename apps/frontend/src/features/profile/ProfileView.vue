<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { CAlert, CCol, CRow, CSpinner } from '@coreui/vue';

import { useAuthStore } from '@/stores/auth';
import { useProfileStore } from '@/stores/profile';
import ProfileScalarsForm from './ProfileScalarsForm.vue';
import ProfilePasswordForm from './ProfilePasswordForm.vue';
import ProfileEmails from './ProfileEmails.vue';
import ProfileDocuments from './ProfileDocuments.vue';
import ProfilePhones from './ProfilePhones.vue';

const router = useRouter();
const auth = useAuthStore();
const profile = useProfileStore();
const errorMessage = ref('');
const successMessage = ref('');

const notify = (message: string) => {
  successMessage.value = message;
  errorMessage.value = '';
};

const fail = (error: unknown) => {
  errorMessage.value = error instanceof Error ? error.message : String(error);
  successMessage.value = '';
};

onMounted(async () => {
  try {
    await profile.load();
  } catch (error) {
    // 401 = the session is no longer accepted (expired token, backend
    // restarted with in-memory data wiped). Unauthenticated goes to /login.
    if (error instanceof Error && error.message.includes(' 401 ')) {
      auth.expire();
      await router.push('/login');
      return;
    }
    fail(error);
  }
});
</script>

<template>
  <div>
    <h2 class="mb-3">My profile</h2>
    <CAlert v-if="errorMessage" color="danger" role="alert">{{ errorMessage }}</CAlert>
    <CAlert v-if="successMessage" color="success" role="alert">{{ successMessage }}</CAlert>
    <div v-if="profile.loading && !profile.record" class="text-center py-5">
      <CSpinner color="primary" />
    </div>
    <template v-else-if="profile.record">
      <CRow>
        <CCol :lg="6">
          <ProfileScalarsForm :record="profile.record" @saved="notify" @failed="fail" />
        </CCol>
        <CCol :lg="6">
          <ProfilePasswordForm @saved="notify" @failed="fail" />
        </CCol>
      </CRow>
      <CRow>
        <CCol :lg="12">
          <ProfileEmails :emails="profile.record.emails" @saved="notify" @failed="fail" />
        </CCol>
        <CCol :lg="12">
          <ProfileDocuments :documents="profile.record.documents" @saved="notify" @failed="fail" />
        </CCol>
        <CCol :lg="12">
          <ProfilePhones :phones="profile.record.phones" @saved="notify" @failed="fail" />
        </CCol>
      </CRow>
    </template>
  </div>
</template>
