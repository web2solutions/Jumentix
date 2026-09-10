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

import OasFormField from '@/components/OasFormField.vue';
import { fieldDescriptors, type FieldDescriptor } from '@/contracts/formSchema';
import { collectBody, validateAll } from '@/contracts/oasForm';
import { maskPhone, phoneMaskCap, validatePhone } from '@/contracts/validation';
import { useProfileStore, type UserPhone } from '@/stores/profile';
import { useSectionNotify } from './useSectionNotify';

const props = defineProps<{ phones: UserPhone[] }>();

const profile = useProfileStore();
const { errorMessage, successMessage, run } = useSectionNotify();

// OAS-driven fields (JUM-766): RequestCreatePhone / RequestUpdatePhone.
const createDescriptors = fieldDescriptors('RequestCreatePhone');
const updateDescriptors = fieldDescriptors('RequestUpdatePhone').filter((d) => d.name !== 'id');

// The `number` field carries the OAS x-validation rule selected by countryCode.
const maskNumber = (values: Record<string, unknown>) => (raw: string) => (
  maskPhone(String(values.countryCode ?? ''), raw)
);

const edits = reactive<Record<string, Record<string, string | boolean>>>({});
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

const newValues = reactive<Record<string, string | boolean>>({ countryCode: '+55' });

const add = () => {
  const invalid = validateAll(createDescriptors, newValues)
    ?? validatePhone(
      String(newValues.countryCode ?? ''),
      String(newValues.localCode ?? ''),
      String(newValues.number ?? '')
    );
  if (invalid) {
    errorMessage.value = invalid;
    return;
  }
  return run(async () => {
    await profile.addPhone(collectBody(createDescriptors, newValues) as {
      countryCode: string;
      localCode: string;
      number: string;
    });
    newValues.localCode = '';
    newValues.number = '';
    newValues.isPrimary = false;
  }, 'Telefone adicionado.');
};

const update = (id: string) => {
  const state = edits[id];
  const invalid = validateAll(updateDescriptors, state)
    ?? validatePhone(String(state.countryCode ?? ''), String(state.localCode ?? ''), String(state.number ?? ''));
  if (invalid) {
    errorMessage.value = invalid;
    return;
  }
  return run(() => profile.updatePhone(id, collectBody(updateDescriptors, state)), 'Telefone atualizado.');
};
const remove = (id: string) => run(() => profile.removePhone(id), 'Telefone removido.');

const cellControl = (descriptor: FieldDescriptor): 'checkbox' | 'text' => (
  descriptor.type === 'boolean' ? 'checkbox' : 'text'
);
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
            <CTableHeaderCell v-for="d in updateDescriptors" :key="d.name">
              {{ d.description ?? d.name }}
            </CTableHeaderCell>
            <CTableHeaderCell class="text-end">Actions</CTableHeaderCell>
          </CTableRow>
        </CTableHead>
        <CTableBody>
          <CTableRow v-for="item in phones" :key="item.id">
            <CTableDataCell v-for="d in updateDescriptors" :key="d.name">
              <CFormCheck
                v-if="cellControl(d) === 'checkbox'"
                v-model="edits[item.id][d.name]"
                :aria-label="d.name"
              />
              <CFormInput
                v-else
                :model-value="String(edits[item.id][d.name] ?? '')"
                :aria-label="d.name === 'number' ? `Phone ${item.number}` : d.name"
                :maxlength="d.maxLength ?? (d.name === 'number' ? phoneMaskCap(String(edits[item.id].countryCode ?? '')) : undefined)"
                @update:model-value="d.name === 'number'
                  ? (edits[item.id].number = maskNumber(edits[item.id])($event))
                  : (edits[item.id][d.name] = $event)"
              />
            </CTableDataCell>
            <CTableDataCell class="text-end">
              <CButton size="sm" color="primary" class="me-2" @click="update(item.id)">Save</CButton>
              <CButton size="sm" color="danger" variant="outline" @click="remove(item.id)">Delete</CButton>
            </CTableDataCell>
          </CTableRow>
        </CTableBody>
      </CTable>
      <div class="d-flex gap-2 align-items-end">
        <OasFormField
          v-for="d in createDescriptors"
          :key="d.name"
          v-model="newValues[d.name]"
          :descriptor="d"
          :mask="d.name === 'number' ? maskNumber(newValues) : undefined"
          :mask-cap="d.name === 'number' ? phoneMaskCap(String(newValues.countryCode ?? '')) : undefined"
          class="mb-0"
        />
        <CButton color="success" class="mb-3" @click="add">Add</CButton>
      </div>
    </CCardBody>
  </CCard>
</template>
