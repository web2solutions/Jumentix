<script setup lang="ts">
import { reactive, watch } from 'vue';
import {
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

const props = defineProps<{ phones: UserPhone[] }>();
const emit = defineEmits<{
  saved: [message: string];
  failed: [error: unknown];
}>();

const profile = useProfileStore();

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

const run = async (action: () => Promise<void>, message: string) => {
  try {
    await action();
    emit('saved', message);
  } catch (error) {
    emit('failed', error);
  }
};

const add = () => run(async () => {
  await profile.addPhone({ ...newPhone });
  newPhone.countryCode = '+55';
  newPhone.localCode = '';
  newPhone.number = '';
  newPhone.isPrimary = false;
}, 'Phone added.');

const update = (id: string) => run(() => profile.updatePhone(id, { ...edits[id] }), 'Phone updated.');
const remove = (id: string) => run(() => profile.removePhone(id), 'Phone removed.');
</script>

<template>
  <CCard class="mb-4">
    <CCardHeader><strong>Phones</strong></CCardHeader>
    <CCardBody>
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
              <CFormInput v-model="edits[item.id].number" :aria-label="`Phone ${item.number}`" />
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
        <CFormInput v-model="newPhone.number" placeholder="98765-4321" aria-label="New phone number" />
        <CFormCheck v-model="newPhone.isPrimary" label="Primary" />
        <CButton color="success" @click="add">Add</CButton>
      </div>
    </CCardBody>
  </CCard>
</template>
