<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CContainer,
  CForm,
  CRow
} from '@coreui/vue';

import OasFormField from '@/components/OasFormField.vue';
import { fieldDescriptors } from '@/contracts/formSchema';
import { collectBody, validateAll } from '@/contracts/oasForm';
import { useI18n } from '@/i18n';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const auth = useAuthStore();
const { t } = useI18n();

// The form is built from the OAS RequestRegister schema at runtime (JUM-766).
const descriptors = fieldDescriptors('RequestRegister');
const values = reactive<Record<string, unknown>>({});
const repeatPassword = ref('');
const errorMessage = ref('');
const submitting = ref(false);

const submit = async () => {
  errorMessage.value = '';
  const invalid = validateAll(descriptors, values);
  if (invalid) {
    errorMessage.value = invalid;
    return;
  }
  if (values.password !== repeatPassword.value) {
    errorMessage.value = t('auth.register.passwordMismatch');
    return;
  }
  submitting.value = true;
  try {
    await auth.register(collectBody(descriptors, values));
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
                <h1>{{ t('auth.register.title') }}</h1>
                <p class="text-body-secondary">{{ t('auth.register.subtitle') }}</p>
                <CAlert v-if="errorMessage" color="danger" role="alert">
                  {{ errorMessage }}
                </CAlert>
                <OasFormField
                  v-for="descriptor in descriptors"
                  :key="descriptor.name"
                  v-model="values[descriptor.name]"
                  :descriptor="descriptor"
                />
                <div class="mb-4">
                  <label class="form-label" for="register-password-repeat">{{ t('auth.register.repeatPassword') }}</label>
                  <input
                    id="register-password-repeat"
                    v-model="repeatPassword"
                    type="password"
                    class="form-control"
                    autocomplete="new-password"
                    required
                  />
                </div>
                <div class="d-grid gap-2">
                  <CButton color="success" type="submit" :disabled="submitting">
                    {{ submitting ? t('auth.register.submitting') : t('auth.register.submit') }}
                  </CButton>
                  <RouterLink to="/login" custom v-slot="{ href, navigate }">
                    <CButton color="link" :href="href" @click="navigate">
                      {{ t('auth.register.haveAccount') }}
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
