<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardGroup,
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

const username = ref('');
const password = ref('');
const errorMessage = ref('');
const submitting = ref(false);

const submit = async () => {
  errorMessage.value = '';
  submitting.value = true;
  try {
    await auth.login({ username: username.value, password: password.value });
    await router.push('/dashboard');
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
          <CCardGroup>
            <CCard class="p-4">
              <CCardBody>
                <CForm @submit.prevent="submit">
                  <h1>Login</h1>
                  <p class="text-body-secondary">Sign in to your Jumentix account</p>
                  <CAlert v-if="errorMessage" color="danger" role="alert">
                    {{ errorMessage }}
                  </CAlert>
                  <CInputGroup class="mb-3">
                    <CInputGroupText>
                      <CIcon icon="cil-user" />
                    </CInputGroupText>
                    <CFormInput
                      v-model="username"
                      placeholder="Username"
                      autocomplete="username"
                      required
                    />
                  </CInputGroup>
                  <CInputGroup class="mb-4">
                    <CInputGroupText>
                      <CIcon icon="cil-lock-locked" />
                    </CInputGroupText>
                    <CFormInput
                      v-model="password"
                      type="password"
                      placeholder="Password"
                      autocomplete="current-password"
                      required
                    />
                  </CInputGroup>
                  <CRow>
                    <CCol :xs="6">
                      <CButton color="primary" class="px-4" type="submit" :disabled="submitting">
                        {{ submitting ? 'Signing in…' : 'Login' }}
                      </CButton>
                    </CCol>
                    <CCol :xs="6" class="text-end">
                      <RouterLink to="/register" custom v-slot="{ href, navigate }">
                        <CButton color="link" class="px-0" :href="href" @click="navigate">
                          Need an account? Register
                        </CButton>
                      </RouterLink>
                    </CCol>
                  </CRow>
                </CForm>
              </CCardBody>
            </CCard>
          </CCardGroup>
        </CCol>
      </CRow>
    </CContainer>
  </div>
</template>
