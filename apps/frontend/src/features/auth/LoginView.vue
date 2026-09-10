<script setup lang="ts">
import { reactive, ref } from 'vue';
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
  CRow
} from '@coreui/vue';

import OasFormField from '@/components/OasFormField.vue';
import { fieldDescriptors } from '@/contracts/formSchema';
import { collectBody, validateAll } from '@/contracts/oasForm';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const auth = useAuthStore();

// The form is built from the OAS RequestLogin schema at runtime (JUM-766).
const descriptors = fieldDescriptors('RequestLogin');
const values = reactive<Record<string, unknown>>({});
const fieldErrors = reactive<Record<string, string | null>>({});
const errorMessage = ref('');
const submitting = ref(false);

const submit = async () => {
  errorMessage.value = '';
  const invalid = validateAll(descriptors, values);
  if (invalid) {
    errorMessage.value = invalid;
    return;
  }
  submitting.value = true;
  try {
    await auth.login(collectBody(descriptors, values));
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
                  <OasFormField
                    v-for="descriptor in descriptors"
                    :key="descriptor.name"
                    v-model="values[descriptor.name]"
                    :descriptor="descriptor"
                    :invalid="fieldErrors[descriptor.name]"
                  />
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
