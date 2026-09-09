<script setup lang="ts">
import { ref } from 'vue';
import { CButton, CCard, CCardBody, CCardHeader, CForm, CFormInput, CFormLabel } from '@coreui/vue';

import { useProfileStore } from '@/stores/profile';

const emit = defineEmits<{
  saved: [message: string];
  failed: [error: unknown];
}>();

const profile = useProfileStore();
const password = ref('');
const repeat = ref('');

const save = async () => {
  if (password.value !== repeat.value) {
    emit('failed', new Error('Passwords do not match.'));
    return;
  }
  try {
    await profile.changePassword(password.value);
    password.value = '';
    repeat.value = '';
    emit('saved', 'Password updated.');
  } catch (error) {
    emit('failed', error);
  }
};
</script>

<template>
  <CCard class="mb-4">
    <CCardHeader><strong>Change password</strong></CCardHeader>
    <CCardBody>
      <CForm @submit.prevent="save">
        <div class="mb-3">
          <CFormLabel for="profile-password">New password</CFormLabel>
          <CFormInput
            id="profile-password"
            v-model="password"
            type="password"
            minlength="8"
            required
            autocomplete="new-password"
          />
        </div>
        <div class="mb-3">
          <CFormLabel for="profile-password-repeat">Repeat new password</CFormLabel>
          <CFormInput
            id="profile-password-repeat"
            v-model="repeat"
            type="password"
            minlength="8"
            required
            autocomplete="new-password"
          />
        </div>
        <CButton color="warning" type="submit">Update password</CButton>
      </CForm>
    </CCardBody>
  </CCard>
</template>
