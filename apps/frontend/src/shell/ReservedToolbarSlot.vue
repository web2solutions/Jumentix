<script setup lang="ts">
defineProps<{ slotId: string }>();
</script>

<template>
  <span class="d-none" :data-toolbar-reserved="slotId" aria-hidden="true" />
</template>
