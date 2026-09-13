<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { CContainer } from '@coreui/vue'
import { useRouter } from 'vue-router'
import AppFooter from '@/components/AppFooter.vue'
import AppHeader from '@/components/AppHeader.vue'
import AppSidebar from '@/components/AppSidebar.vue'
import { expireIfStaleSession } from '@/contracts/sessionGuard'
import { usePermissions } from '@/contracts/usePermissions'
import { useAuthStore } from '@/stores/auth'

// JUM-772 follow-up: the sidebar filters items by role scopes read from the
// profile record — load it at the shell level so the nav is correct on every
// page, including the dashboard landing right after login.
const permissions = usePermissions()

// Session expiry (auto-redirect): the periodic check catches an idle page
// (no navigation, no API call); 401s are caught globally by installSessionGuard.
const router = useRouter()
const auth = useAuthStore()
let expiryTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  permissions.ensure()
  expiryTimer = setInterval(() => {
    if (expireIfStaleSession(auth)) {
      router.push('/login')
    }
  }, 30000)
})

onUnmounted(() => {
  if (expiryTimer) clearInterval(expiryTimer)
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
