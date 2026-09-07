<template>
  <CRow class="justify-content-center">
    <CCol :md="6">
      <div class="text-center py-5">
        <h1 class="display-3">404</h1>
        <p class="text-body-secondary">A página que você procurou não existe neste app.</p>
        <RouterLink to="/dashboard">Voltar ao dashboard</RouterLink>
      </div>
    </CCol>
  </CRow>
</template>

<script setup lang="ts">
import { CCol, CRow } from '@coreui/vue'
</script>
