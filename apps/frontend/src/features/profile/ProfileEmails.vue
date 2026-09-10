<script setup lang="ts">
import { reactive, watch } from 'vue';
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CFormCheck,
  CFormInput,
  CFormSelect,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow
} from '@coreui/vue';

import { useProfileStore, type UserEmail } from '@/stores/profile';
import { useSectionNotify } from './useSectionNotify';

const props = defineProps<{ emails: UserEmail[] }>();

const profile = useProfileStore();
const { errorMessage, successMessage, run } = useSectionNotify();

// Editable copies per row, keyed by email id.
const edits = reactive<Record<string, { email: string; type: string; isPrimary: boolean }>>({});
watch(
  () => props.emails,
  (emails) => {
    for (const item of emails ?? []) {
      edits[item.id] = { email: item.email, type: item.type, isPrimary: item.isPrimary ?? false };
    }
  },
  { immediate: true, deep: true }
);

const newEmail = reactive({ email: '', type: 'work', isPrimary: false });
const typeOptions = ['work', 'personal']; // OAS enum

const add = () => run(async () => {
  await profile.addEmail({ ...newEmail });
  newEmail.email = '';
  newEmail.type = 'work';
  newEmail.isPrimary = false;
}, 'Email adicionado.');

const update = (id: string) => run(() => profile.updateEmail(id, { ...edits[id] }), 'Email atualizado.');
const remove = (id: string) => run(() => profile.removeEmail(id), 'Email removido.');
</script>

<template>
  <CCard class="mb-4">
    <CCardHeader><strong>Email addresses</strong></CCardHeader>
    <CCardBody>
      <CAlert v-if="errorMessage" color="danger" role="alert">{{ errorMessage }}</CAlert>
      <CAlert v-if="successMessage" color="success" role="alert">{{ successMessage }}</CAlert>
      <CTable responsive align="middle" class="mb-3">
        <CTableHead>
          <CTableRow>
            <CTableHeaderCell>Email</CTableHeaderCell>
            <CTableHeaderCell>Type</CTableHeaderCell>
            <CTableHeaderCell>Primary</CTableHeaderCell>
            <CTableHeaderCell class="text-end">Actions</CTableHeaderCell>
          </CTableRow>
        </CTableHead>
        <CTableBody>
          <CTableRow v-for="item in emails" :key="item.id">
            <CTableDataCell>
              <CFormInput v-model="edits[item.id].email" :aria-label="`Email ${item.email}`" />
            </CTableDataCell>
            <CTableDataCell>
              <CFormSelect v-model="edits[item.id].type" :options="typeOptions" aria-label="Email type" />
            </CTableDataCell>
            <CTableDataCell>
              <CFormCheck v-model="edits[item.id].isPrimary" aria-label="Primary email" />
            </CTableDataCell>
            <CTableDataCell class="text-end">
              <CButton size="sm" color="primary" class="me-2" @click="update(item.id)">Save</CButton>
              <CButton size="sm" color="danger" variant="outline" @click="remove(item.id)">Delete</CButton>
            </CTableDataCell>
          </CTableRow>
        </CTableBody>
      </CTable>
      <div class="d-flex gap-2 align-items-center">
        <CFormInput v-model="newEmail.email" placeholder="new@email.com" aria-label="New email" />
        <CFormSelect v-model="newEmail.type" :options="typeOptions" aria-label="New email type" style="max-width: 140px" />
        <CFormCheck v-model="newEmail.isPrimary" label="Primary" />
        <CButton color="success" @click="add">Add</CButton>
      </div>
    </CCardBody>
  </CCard>
</template>
