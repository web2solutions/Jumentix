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
import SearchableEnumInput from '@/components/SearchableEnumInput.vue';
import { fieldDescriptors, type FieldDescriptor } from '@/contracts/formSchema';
import { fieldLabel } from '@/contracts/labels';
import { collectBody, validateAll } from '@/contracts/oasForm';
import { maskPhone, phoneMaskCap, validatePhone } from '@/contracts/validation';
import { useProfileStore, type UserPhone } from '@/stores/profile';
import { t } from '@/i18n';
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
  }, t('profile.updated'));
};

const update = (id: string) => {
  const state = edits[id];
  const invalid = validateAll(updateDescriptors, state)
    ?? validatePhone(String(state.countryCode ?? ''), String(state.localCode ?? ''), String(state.number ?? ''));
  if (invalid) {
    errorMessage.value = invalid;
    return;
  }
  return run(() => profile.updatePhone(id, collectBody(updateDescriptors, state)), t('profile.updated'));
};
const remove = (id: string) => run(() => profile.removePhone(id), t('profile.updated'));

const cellControl = (descriptor: FieldDescriptor): 'checkbox' | 'select' | 'text' => {
  if (descriptor.type === 'boolean') return 'checkbox';
  return descriptor.enum ? 'select' : 'text';
};
</script>

<template>
  <CCard class="mb-4">
    <CCardHeader><strong>{{ t('profile.phones') }}</strong></CCardHeader>
    <CCardBody>
      <CAlert v-if="errorMessage" color="danger" role="alert">{{ errorMessage }}</CAlert>
      <CAlert v-if="successMessage" color="success" role="alert">{{ successMessage }}</CAlert>
      <CTable responsive align="middle" class="mb-3">
        <CTableHead>
          <CTableRow>
            <CTableHeaderCell v-for="d in updateDescriptors" :key="d.name">
              {{ fieldLabel(d) }}
            </CTableHeaderCell>
            <CTableHeaderCell class="text-end">{{ t('profile.actions') }}</CTableHeaderCell>
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
              <SearchableEnumInput
                v-else-if="cellControl(d) === 'select'"
                :id="`oas-cell-${item.id}-${d.name}`"
                :model-value="String(edits[item.id][d.name] ?? '')"
                :options="d.enum ?? []"
                :maxlength="d.maxLength"
                :aria-label="d.name"
                @update:model-value="edits[item.id][d.name] = $event"
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
              <CButton size="sm" color="primary" class="me-2" @click="update(item.id)">{{ t('profile.save.row') }}</CButton>
              <CButton size="sm" color="danger" variant="outline" @click="remove(item.id)">{{ t('profile.delete') }}</CButton>
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
        <CButton color="success" class="mb-3" @click="add">{{ t('profile.add') }}</CButton>
      </div>
    </CCardBody>
  </CCard>
</template>
