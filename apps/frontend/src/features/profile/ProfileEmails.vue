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
import { useProfileStore, type UserEmail } from '@/stores/profile';
import { t } from '@/i18n';
import { useSectionNotify } from './useSectionNotify';

const props = defineProps<{ emails: UserEmail[] }>();

const profile = useProfileStore();
const { errorMessage, successMessage, run } = useSectionNotify();

// Fields from the OAS (JUM-766): create form iterates RequestCreateEmail,
// row edits iterate RequestUpdateEmail (minus id, which travels in the path).
const createDescriptors = fieldDescriptors('RequestCreateEmail');
const updateDescriptors = fieldDescriptors('RequestUpdateEmail').filter((d) => d.name !== 'id');

const cellControl = (descriptor: FieldDescriptor): 'select' | 'checkbox' | 'text' => {
  if (descriptor.enum) return 'select';
  if (descriptor.type === 'boolean') return 'checkbox';
  return 'text';
};

const edits = reactive<Record<string, Record<string, string | boolean>>>({});
watch(
  () => props.emails,
  (emails) => {
    for (const item of emails ?? []) {
      edits[item.id] = { email: item.email, type: item.type, isPrimary: item.isPrimary ?? false };
    }
  },
  { immediate: true, deep: true }
);

const newValues = reactive<Record<string, string | boolean>>({ type: 'work' });

const add = () => {
  const invalid = validateAll(createDescriptors, newValues);
  if (invalid) {
    errorMessage.value = invalid;
    return;
  }
  return run(async () => {
    await profile.addEmail(collectBody(createDescriptors, newValues) as { email: string; type: string });
    newValues.email = '';
    newValues.isPrimary = false;
  }, t('profile.updated'));
};

const update = (id: string) => {
  const invalid = validateAll(updateDescriptors, edits[id]);
  if (invalid) {
    errorMessage.value = invalid;
    return;
  }
  return run(() => profile.updateEmail(id, collectBody(updateDescriptors, edits[id])), t('profile.updated'));
};
const remove = (id: string) => run(() => profile.removeEmail(id), t('profile.updated'));
</script>

<template>
  <CCard class="mb-4">
    <CCardHeader><strong>{{ t('profile.emails') }}</strong></CCardHeader>
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
          <CTableRow v-for="item in emails" :key="item.id">
            <CTableDataCell v-for="d in updateDescriptors" :key="d.name">
              <SearchableEnumInput
                v-if="cellControl(d) === 'select'"
                :id="`oas-cell-${item.id}-${d.name}`"
                :model-value="String(edits[item.id][d.name] ?? '')"
                :options="d.enum ?? []"
                :maxlength="d.maxLength"
                :aria-label="d.name"
                @update:model-value="edits[item.id][d.name] = $event"
              />
              <CFormCheck
                v-else-if="cellControl(d) === 'checkbox'"
                :model-value="Boolean(edits[item.id][d.name])"
                @update:model-value="edits[item.id][d.name] = $event"
                :aria-label="d.name"
              />
              <CFormInput
                v-else
                :model-value="String(edits[item.id][d.name] ?? '')"
                @update:model-value="edits[item.id][d.name] = $event"
                :aria-label="`Email ${item.email}`"
                :minlength="d.minLength"
                :maxlength="d.maxLength"
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
          class="mb-0"
        />
        <CButton color="success" class="mb-3" @click="add">{{ t('profile.add') }}</CButton>
      </div>
    </CCardBody>
  </CCard>
</template>
