<script setup lang="ts">
import { reactive, ref } from 'vue';
import { CAlert, CButton, CCard, CCardBody, CCardHeader, CForm } from '@coreui/vue';

import OasFormField from '@/components/OasFormField.vue';
import { fieldDescriptors } from '@/contracts/formSchema';
import { collectBody, validateAll } from '@/contracts/oasForm';
import { useProfileStore } from '@/stores/profile';
import { useSectionNotify } from './useSectionNotify';

const profile = useProfileStore();
const { errorMessage, successMessage, run } = useSectionNotify();

// OAS RequestUpdatePassword drives the field (JUM-766).
const descriptors = fieldDescriptors('RequestUpdatePassword');
const form = reactive<Record<string, unknown>>({});
const repeat = ref('');

const save = async () => {
  const invalid = validateAll(descriptors, form);
  if (invalid) {
    errorMessage.value = invalid;
    return;
  }
  if (form.password !== repeat.value) {
    errorMessage.value = 'As senhas não conferem.';
    return;
  }
  await run(async () => {
    await profile.changePassword(String(collectBody(descriptors, form).password));
    form.password = '';
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
        <OasFormField
          v-for="descriptor in descriptors"
          :key="descriptor.name"
          v-model="form[descriptor.name]"
          :descriptor="descriptor"
        />
        <div class="mb-3">
          <label class="form-label" for="profile-password-repeat">Repeat new password</label>
          <input
            id="profile-password-repeat"
            v-model="repeat"
            type="password"
            class="form-control"
            autocomplete="new-password"
            required
          />
        </div>
        <CButton color="warning" type="submit">Update password</CButton>
      </CForm>
    </CCardBody>
  </CCard>
</template>
