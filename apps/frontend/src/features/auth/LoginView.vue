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
import { useI18n } from '@/i18n';
import { useAuthStore } from '@/stores/auth';
import { useProfileStore } from '@/stores/profile';

const router = useRouter();
const auth = useAuthStore();
const profile = useProfileStore();
const { t } = useI18n();

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
    profile.reset(); // a new session never inherits the previous account's roles (JUM-781)
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
                  <h1>{{ t('auth.login.title') }}</h1>
                  <p class="text-body-secondary">{{ t('auth.login.subtitle') }}</p>
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
                        {{ submitting ? t('auth.login.submitting') : t('auth.login.submit') }}
                      </CButton>
                    </CCol>
                    <CCol :xs="6" class="text-end">
                      <RouterLink to="/register" custom v-slot="{ href, navigate }">
                        <CButton color="link" class="px-0" :href="href" @click="navigate">
                          {{ t('auth.login.needAccount') }}
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
