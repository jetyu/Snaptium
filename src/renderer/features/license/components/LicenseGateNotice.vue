<template>
  <div class="license-gate-notice">
    <div class="notice-main">
      <div class="notice-icon-wrapper">
        <IconLock :size="18" />
      </div>
      <div class="notice-copy">
        <h4 class="notice-title">{{ t(titleKey) }}</h4>
        <p class="notice-description">{{ t(descriptionKey) }}</p>
      </div>
    </div>
    
    <button
      type="button"
      class="action-button notice-action-btn"
      @click="openLicenseDialog"
    >
      {{ t('license.gate.action') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { IconLock } from '@tabler/icons-vue';
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
  padding: 14px 16px;
  border: 1px solid color-mix(in srgb, #f59e0b 25%, var(--panel-border));
  border-radius: 12px;
  background: linear-gradient(135deg, color-mix(in srgb, #f59e0b 6%, var(--panel)), var(--panel));
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.03);
}

.notice-main {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.notice-icon-wrapper {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(245, 158, 11, 0.12);
  color: #d97706;
  flex-shrink: 0;
}

[data-theme='dark'] .notice-icon-wrapper {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
}

.notice-copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.notice-title {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notice-description {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-muted);
  line-height: 1.35;
}

.notice-action-btn {
  white-space: nowrap;
  flex-shrink: 0;
}

@media (max-width: 960px) {
  .license-gate-notice {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .notice-action-btn {
    width: 100%;
    text-align: center;
  }
}
</style>
