<template>
  <div class="license-gate-notice">
    <div class="notice-copy">
      <p class="notice-title">{{ t(titleKey) }}</p>
      <p class="notice-description">{{ t(descriptionKey) }}</p>
    </div>
    <button type="button" class="action-button primary" @click="openLicenseDialog">
      {{ t('license.gate.action') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useLicenseDialog } from '../composables/useLicenseDialog';

interface Props {
  titleKey?: string;
  descriptionKey?: string;
}

withDefaults(defineProps<Props>(), {
  titleKey: 'license.gate.title',
  descriptionKey: 'license.gate.description',
});

const { t } = useI18n();
const { openLicenseDialog } = useLicenseDialog();
</script>

<style scoped>
.license-gate-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border: 1px solid #e4d9b4;
  border-radius: 10px;
  background: #fff8e6;
}

.notice-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.notice-title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
  color: #8a5a00;
}

.notice-description {
  margin: 0;
  font-size: 0.82rem;
  color: #8a5a00;
}

@media (max-width: 960px) {
  .license-gate-notice {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

