<template>
  <div class="update-settings">
    <h3 class="text-2xl font-bold mb-6 text-[var(--text-primary)]">{{ t('labelAutoUpdate') }}</h3>
    <div class="space-y-6">
      <div class="setting-item">
        <p class="text-gray-500">Settings placeholders will go here.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
</script>
