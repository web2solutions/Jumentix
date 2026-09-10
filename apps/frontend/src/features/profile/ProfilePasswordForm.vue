<script setup lang="ts">
import { ref } from 'vue';
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CForm,
  CFormInput,
  CFormLabel
} from '@coreui/vue';

import { useProfileStore } from '@/stores/profile';
import { useSectionNotify } from './useSectionNotify';

const profile = useProfileStore();
const { errorMessage, successMessage, run } = useSectionNotify();
const password = ref('');
const repeat = ref('');

const save = async () => {
  if (password.value !== repeat.value) {
    errorMessage.value = 'As senhas não conferem.';
    return;
  }
  await run(async () => {
    await profile.changePassword(password.value);
    password.value = '';
    repeat.value = '';
  }, 'Senha atualizada.');
};
</script>

<template>
  <CCard class="mb-4">
    <CCardHeader><strong>Change password</strong></CCardHeader>
    <CCardBody>
      <CAlert v-if="errorMessage" color="danger" role="alert">{{ errorMessage }}</CAlert>
      <CAlert v-if="successMessage" color="success" role="alert">{{ successMessage }}</CAlert>
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
