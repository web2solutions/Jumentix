<script setup lang="ts">
import { reactive, watch } from 'vue';
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CFormInput,
  CFormSelect,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow
} from '@coreui/vue';

import { useProfileStore, type UserDocument } from '@/stores/profile';

const props = defineProps<{ documents: UserDocument[] }>();
const emit = defineEmits<{
  saved: [message: string];
  failed: [error: unknown];
}>();

const profile = useProfileStore();
const typeOptions = ['CPF', 'RG', 'SSN', 'passport']; // OAS enum

const edits = reactive<Record<string, { type: string; countryIssue: string; data: string }>>({});
watch(
  () => props.documents,
  (documents) => {
    for (const item of documents ?? []) {
      edits[item.id] = { type: item.type, countryIssue: item.countryIssue, data: item.data };
    }
  },
  { immediate: true, deep: true }
);

const newDocument = reactive({ type: 'CPF', countryIssue: 'BR', data: '' });

const run = async (action: () => Promise<void>, message: string) => {
  try {
    await action();
    emit('saved', message);
  } catch (error) {
    emit('failed', error);
  }
};

const add = () => run(async () => {
  await profile.addDocument({ ...newDocument });
  newDocument.type = 'CPF';
  newDocument.countryIssue = 'BR';
  newDocument.data = '';
}, 'Document added.');

const update = (id: string) => run(() => profile.updateDocument(id, { ...edits[id] }), 'Document updated.');
const remove = (id: string) => run(() => profile.removeDocument(id), 'Document removed.');
</script>

<template>
  <CCard class="mb-4">
    <CCardHeader><strong>Documents</strong></CCardHeader>
    <CCardBody>
      <CTable responsive align="middle" class="mb-3">
        <CTableHead>
          <CTableRow>
            <CTableHeaderCell>Type</CTableHeaderCell>
            <CTableHeaderCell>Country</CTableHeaderCell>
            <CTableHeaderCell>Number</CTableHeaderCell>
            <CTableHeaderCell class="text-end">Actions</CTableHeaderCell>
          </CTableRow>
        </CTableHead>
        <CTableBody>
          <CTableRow v-for="item in documents" :key="item.id">
            <CTableDataCell>
              <CFormSelect v-model="edits[item.id].type" :options="typeOptions" aria-label="Document type" />
            </CTableDataCell>
            <CTableDataCell>
              <CFormInput v-model="edits[item.id].countryIssue" aria-label="Country of issue" />
            </CTableDataCell>
            <CTableDataCell>
              <CFormInput v-model="edits[item.id].data" :aria-label="`Document ${item.data}`" />
            </CTableDataCell>
            <CTableDataCell class="text-end">
              <CButton size="sm" color="primary" class="me-2" @click="update(item.id)">Save</CButton>
              <CButton size="sm" color="danger" variant="outline" @click="remove(item.id)">Delete</CButton>
            </CTableDataCell>
          </CTableRow>
        </CTableBody>
      </CTable>
      <div class="d-flex gap-2 align-items-center">
        <CFormSelect v-model="newDocument.type" :options="typeOptions" aria-label="New document type" style="max-width: 140px" />
        <CFormInput v-model="newDocument.countryIssue" placeholder="BR" aria-label="New document country" style="max-width: 100px" />
        <CFormInput v-model="newDocument.data" placeholder="Document number" aria-label="New document number" />
        <CButton color="success" @click="add">Add</CButton>
      </div>
    </CCardBody>
  </CCard>
</template>
