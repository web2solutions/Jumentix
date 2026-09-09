<script setup lang="ts">
import { reactive, watch } from 'vue';
import { CButton, CCard, CCardBody, CCardHeader, CForm, CFormInput, CFormLabel } from '@coreui/vue';

import { useProfileStore, type UserRecord } from '@/stores/profile';

const props = defineProps<{ record: UserRecord }>();
const emit = defineEmits<{
  saved: [message: string];
  failed: [error: unknown];
}>();

const profile = useProfileStore();

// OAS RequestUpdateUser scalars (id goes in path + body; arrays have their
// own sub-resource operations below in the page).
const form = reactive({
  firstName: '',
  lastName: '',
  avatar: '',
  username: '',
  organization: ''
});

watch(
  () => props.record,
  (record) => {
    form.firstName = record?.firstName ?? '';
    form.lastName = record?.lastName ?? '';
    form.avatar = record?.avatar ?? '';
    form.username = record?.username ?? '';
    form.organization = record?.organization ?? '';
  },
  { immediate: true }
);

const save = async () => {
  try {
    await profile.saveScalars({
      firstName: form.firstName,
      lastName: form.lastName,
      avatar: form.avatar,
      username: form.username,
      organization: form.organization
    });
    emit('saved', 'Profile updated.');
  } catch (error) {
    emit('failed', error);
  }
};
</script>

<template>
  <CCard class="mb-4">
    <CCardHeader><strong>Account details</strong></CCardHeader>
    <CCardBody>
      <CForm @submit.prevent="save">
        <div class="mb-3">
          <CFormLabel for="profile-firstName">First name</CFormLabel>
          <CFormInput id="profile-firstName" v-model="form.firstName" required minlength="1" />
        </div>
        <div class="mb-3">
          <CFormLabel for="profile-lastName">Last name</CFormLabel>
          <CFormInput id="profile-lastName" v-model="form.lastName" />
        </div>
        <div class="mb-3">
          <CFormLabel for="profile-avatar">Avatar</CFormLabel>
          <CFormInput id="profile-avatar" v-model="form.avatar" placeholder="avatar.png" />
        </div>
        <div class="mb-3">
          <CFormLabel for="profile-username">Username</CFormLabel>
          <CFormInput id="profile-username" v-model="form.username" required minlength="1" />
        </div>
        <div class="mb-3">
          <CFormLabel for="profile-organization">Organization (uuid)</CFormLabel>
          <CFormInput id="profile-organization" v-model="form.organization" placeholder="optional" />
        </div>
        <CButton color="primary" type="submit">Save profile</CButton>
      </CForm>
    </CCardBody>
  </CCard>
</template>
