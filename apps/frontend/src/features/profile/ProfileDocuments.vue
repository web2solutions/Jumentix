<script setup lang="ts">
import { reactive, watch } from 'vue';
import {
  CAlert,
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
import { maskCpf, maskSsn, validateDocumentData } from '@/contracts/validation';
import { useSectionNotify } from './useSectionNotify';

const props = defineProps<{ documents: UserDocument[] }>();

const profile = useProfileStore();
const { errorMessage, successMessage, run } = useSectionNotify();
const typeOptions = ['CPF', 'RG', 'SSN', 'passport']; // OAS enum

// Masks follow the OAS x-validation rules for the type+country (JUM-765).
const maskDocumentData = (type: string, countryIssue: string, raw: string): string => {
  if (type === 'CPF') return maskCpf(raw);
  if (type === 'SSN') return maskSsn(raw);
  return raw;
};

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

const onDataInput = (id: string | null, value: string) => {
  const state = id ? edits[id] : newDocument;
  state.data = maskDocumentData(state.type, state.countryIssue, value);
};

const add = () => {
  const invalid = validateDocumentData(newDocument.type, newDocument.countryIssue, newDocument.data);
  if (invalid) {
    errorMessage.value = invalid;
    return;
  }
  return run(async () => {
    await profile.addDocument({ ...newDocument });
    newDocument.type = 'CPF';
    newDocument.countryIssue = 'BR';
    newDocument.data = '';
  }, 'Documento adicionado.');
};

const update = (id: string) => {
  const state = edits[id];
  const invalid = validateDocumentData(state.type, state.countryIssue, state.data);
  if (invalid) {
    errorMessage.value = invalid;
    return;
  }
  return run(() => profile.updateDocument(id, { ...state }), 'Documento atualizado.');
};
const remove = (id: string) => run(() => profile.removeDocument(id), 'Documento removido.');
</script>

<template>
  <CCard class="mb-4">
    <CCardHeader><strong>Documents</strong></CCardHeader>
    <CCardBody>
      <CAlert v-if="errorMessage" color="danger" role="alert">{{ errorMessage }}</CAlert>
      <CAlert v-if="successMessage" color="success" role="alert">{{ successMessage }}</CAlert>
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
              <CFormInput
                :model-value="edits[item.id].data"
                :aria-label="`Document ${item.data}`"
                @update:model-value="onDataInput(item.id, $event)"
              />
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
        <CFormInput
          :model-value="newDocument.data"
          placeholder="Document number"
          aria-label="New document number"
          @update:model-value="onDataInput(null, $event)"
        />
        <CButton color="success" @click="add">Add</CButton>
      </div>
    </CCardBody>
  </CCard>
</template>
