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
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow
} from '@coreui/vue';

import { useProfileStore, type UserPhone } from '@/stores/profile';
import { maskPhone, validatePhone } from '@/contracts/validation';
import { useSectionNotify } from './useSectionNotify';

const props = defineProps<{ phones: UserPhone[] }>();

const profile = useProfileStore();
const { errorMessage, successMessage, run } = useSectionNotify();

const onNumberInput = (id: string | null, value: string) => {
  const state = id ? edits[id] : newPhone;
  state.number = maskPhone(state.countryCode, value);
};

const edits = reactive<Record<string, { countryCode: string; localCode: string; number: string; isPrimary: boolean }>>({});
watch(
  () => props.phones,
  (phones) => {
    for (const item of phones ?? []) {
      edits[item.id] = {
        countryCode: item.countryCode,
        localCode: item.localCode,
        number: item.number,
        isPrimary: item.isPrimary ?? false
      };
    }
  },
  { immediate: true, deep: true }
);

const newPhone = reactive({ countryCode: '+55', localCode: '', number: '', isPrimary: false });

const add = () => {
  const invalid = validatePhone(newPhone.countryCode, newPhone.localCode, newPhone.number);
  if (invalid) {
    errorMessage.value = invalid;
    return;
  }
  return run(async () => {
    await profile.addPhone({ ...newPhone });
    newPhone.countryCode = '+55';
    newPhone.localCode = '';
    newPhone.number = '';
    newPhone.isPrimary = false;
  }, 'Telefone adicionado.');
};

const update = (id: string) => {
  const state = edits[id];
  const invalid = validatePhone(state.countryCode, state.localCode, state.number);
  if (invalid) {
    errorMessage.value = invalid;
    return;
  }
  return run(() => profile.updatePhone(id, { ...state }), 'Telefone atualizado.');
};
const remove = (id: string) => run(() => profile.removePhone(id), 'Telefone removido.');
</script>

<template>
  <CCard class="mb-4">
    <CCardHeader><strong>Phones</strong></CCardHeader>
    <CCardBody>
      <CAlert v-if="errorMessage" color="danger" role="alert">{{ errorMessage }}</CAlert>
      <CAlert v-if="successMessage" color="success" role="alert">{{ successMessage }}</CAlert>
      <CTable responsive align="middle" class="mb-3">
        <CTableHead>
          <CTableRow>
            <CTableHeaderCell>Country code</CTableHeaderCell>
            <CTableHeaderCell>Area code</CTableHeaderCell>
            <CTableHeaderCell>Number</CTableHeaderCell>
            <CTableHeaderCell>Primary</CTableHeaderCell>
            <CTableHeaderCell class="text-end">Actions</CTableHeaderCell>
          </CTableRow>
        </CTableHead>
        <CTableBody>
          <CTableRow v-for="item in phones" :key="item.id">
            <CTableDataCell>
              <CFormInput v-model="edits[item.id].countryCode" aria-label="Country code" />
            </CTableDataCell>
            <CTableDataCell>
              <CFormInput v-model="edits[item.id].localCode" aria-label="Area code" />
            </CTableDataCell>
            <CTableDataCell>
              <CFormInput
                :model-value="edits[item.id].number"
                :aria-label="`Phone ${item.number}`"
                @update:model-value="onNumberInput(item.id, $event)"
              />
            </CTableDataCell>
            <CTableDataCell>
              <CFormCheck v-model="edits[item.id].isPrimary" aria-label="Primary phone" />
            </CTableDataCell>
            <CTableDataCell class="text-end">
              <CButton size="sm" color="primary" class="me-2" @click="update(item.id)">Save</CButton>
              <CButton size="sm" color="danger" variant="outline" @click="remove(item.id)">Delete</CButton>
            </CTableDataCell>
          </CTableRow>
        </CTableBody>
      </CTable>
      <div class="d-flex gap-2 align-items-center">
        <CFormInput v-model="newPhone.countryCode" placeholder="+55" aria-label="New phone country code" style="max-width: 90px" />
        <CFormInput v-model="newPhone.localCode" placeholder="11" aria-label="New phone area code" style="max-width: 90px" />
        <CFormInput
          :model-value="newPhone.number"
          placeholder="98765-4321"
          aria-label="New phone number"
          @update:model-value="onNumberInput(null, $event)"
        />
        <CFormCheck v-model="newPhone.isPrimary" label="Primary" />
        <CButton color="success" @click="add">Add</CButton>
      </div>
    </CCardBody>
  </CCard>
</template>
