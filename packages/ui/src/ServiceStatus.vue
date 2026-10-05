<script setup lang="ts">
import { t } from '@snaptium/i18n';
defineProps<{ status: 'checking' | 'available' | 'unavailable' }>();
</script>

<template>
  <span
    class="status-pill"
    :class="`status-${status}`"
    role="status"
    aria-live="polite"
  >{{ t(status) }}</span>
</template>
