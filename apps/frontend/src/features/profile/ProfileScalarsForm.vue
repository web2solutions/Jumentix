<script setup lang="ts">
import { reactive, watch } from 'vue';
import { CAlert, CButton, CCard, CCardBody, CCardHeader, CForm } from '@coreui/vue';

import OasFormField from '@/components/OasFormField.vue';
import { fieldDescriptors } from '@/contracts/formSchema';
import { collectBody, validateAll } from '@/contracts/oasForm';
import { useProfileStore, type UserRecord } from '@/stores/profile';
import { useSectionNotify } from './useSectionNotify';

const props = defineProps<{ record: UserRecord }>();

const profile = useProfileStore();
const { errorMessage, successMessage, run } = useSectionNotify();

// OAS RequestUpdateUser drives the fields (JUM-766): arrays (emails/
// documents/phones) are managed by their own sub-resource cards, and `id`
// travels in the path + body rather than as a form field.
const descriptors = fieldDescriptors('RequestUpdateUser').filter((descriptor) => (
  descriptor.name !== 'id' && descriptor.type !== 'array'
));

const form = reactive<Record<string, unknown>>({});

watch(
  () => props.record,
  (record) => {
    for (const descriptor of descriptors) {
      form[descriptor.name] = (record as unknown as Record<string, unknown> | null)?.[descriptor.name] ?? '';
    }
  },
  { immediate: true }
);

const save = () => run(async () => {
  const invalid = validateAll(descriptors, form);
  if (invalid) {
    throw new Error(invalid);
  }
  await profile.saveScalars(collectBody(descriptors, form));
}, 'Perfil atualizado.');
</script>

<template>
  <CCard class="mb-4">
    <CCardHeader><strong>Account details</strong></CCardHeader>
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
        <CButton color="primary" type="submit">Save profile</CButton>
      </CForm>
    </CCardBody>
  </CCard>
</template>
