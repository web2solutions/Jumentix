<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CContainer,
  CForm,
  CFormInput,
  CInputGroup,
  CInputGroupText,
  CRow
} from '@coreui/vue';

import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const auth = useAuthStore();

const firstName = ref('');
const username = ref('');
const password = ref('');
const passwordRepeat = ref('');
const errorMessage = ref('');
const submitting = ref(false);

const submit = async () => {
  errorMessage.value = '';
  if (password.value !== passwordRepeat.value) {
    errorMessage.value = 'Passwords do not match.';
    return;
  }
  submitting.value = true;
  try {
    await auth.register({
      firstName: firstName.value,
      username: username.value,
      password: password.value
    });
    await router.push({ path: '/login', query: { registered: '1' } });
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <div class="bg-body-tertiary min-vh-100 d-flex flex-row align-items-center">
    <CContainer>
      <CRow class="justify-content-center">
        <CCol :md="8" :lg="6" :xl="5">
          <CCard class="mx-4">
            <CCardBody class="p-4">
              <CForm @submit.prevent="submit">
                <h1>Register</h1>
                <p class="text-body-secondary">Create your Jumentix account</p>
                <CAlert v-if="errorMessage" color="danger" role="alert">
                  {{ errorMessage }}
                </CAlert>
                <CInputGroup class="mb-3">
                  <CInputGroupText>
                    <CIcon icon="cil-user" />
                  </CInputGroupText>
                  <CFormInput v-model="firstName" placeholder="First name" autocomplete="given-name" required />
                </CInputGroup>
                <CInputGroup class="mb-3">
                  <CInputGroupText>@</CInputGroupText>
                  <CFormInput v-model="username" placeholder="Username" autocomplete="username" required />
                </CInputGroup>
                <CInputGroup class="mb-3">
                  <CInputGroupText>
                    <CIcon icon="cil-lock-locked" />
                  </CInputGroupText>
                  <CFormInput
                    v-model="password"
                    type="password"
                    placeholder="Password (min 8 characters)"
                    autocomplete="new-password"
                    minlength="8"
                    required
                  />
                </CInputGroup>
                <CInputGroup class="mb-4">
                  <CInputGroupText>
                    <CIcon icon="cil-lock-locked" />
                  </CInputGroupText>
                  <CFormInput
                    v-model="passwordRepeat"
                    type="password"
                    placeholder="Repeat password"
                    autocomplete="new-password"
                    minlength="8"
                    required
                  />
                </CInputGroup>
                <div class="d-grid gap-2">
                  <CButton color="success" type="submit" :disabled="submitting">
                    {{ submitting ? 'Creating account…' : 'Create account' }}
                  </CButton>
                  <RouterLink to="/login" custom v-slot="{ href, navigate }">
                    <CButton color="link" :href="href" @click="navigate">
                      Already registered? Login
                    </CButton>
                  </RouterLink>
                </div>
              </CForm>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </CContainer>
  </div>
</template>
