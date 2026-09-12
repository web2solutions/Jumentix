<script setup lang="ts">
import { onMounted } from 'vue'
import { CContainer } from '@coreui/vue'
import AppFooter from '@/components/AppFooter.vue'
import AppHeader from '@/components/AppHeader.vue'
import AppSidebar from '@/components/AppSidebar.vue'
import { usePermissions } from '@/contracts/usePermissions'

// JUM-772 follow-up: the sidebar filters items by role scopes read from the
// profile record — load it at the shell level so the nav is correct on every
// page, including the dashboard landing right after login.
const permissions = usePermissions()
onMounted(() => {
  permissions.ensure()
})
</script>

<template>
  <div>
    <AppSidebar />
    <div class="wrapper d-flex flex-column min-vh-100">
      <AppHeader />
      <div class="body flex-grow-1">
        <CContainer class="px-4" lg>
          <router-view />
        </CContainer>
      </div>
      <AppFooter />
    </div>
  </div>
</template>
