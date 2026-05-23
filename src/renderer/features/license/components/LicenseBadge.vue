<template>
  <button type="button" class="license-badge" :class="[store.plan, toneClass]" @click="openLicenseDialog">
    <span class="label">{{ t(`license.badge.${store.plan}`) }}</span>
    <span v-if="store.status === 'offline_grace'" class="hint">{{ t('license.badge.offline') }}</span>
    <span v-else-if="store.status === 'session_grace'" class="hint">{{ t('license.badge.grace') }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useLicenseStore } from '../store/license.store';
import { useLicenseDialog } from '../composables/useLicenseDialog';

const { t } = useI18n();
const store = useLicenseStore();
const { openLicenseDialog } = useLicenseDialog();

const toneClass = computed(() => {
  if (store.status === 'expired' || store.status === 'invalid') {
    return 'is-expired';
  }

  if (store.status === 'offline_grace' || store.status === 'session_grace') {
    return 'is-grace';
  }

  return 'is-normal';
});
</script>

<style scoped>
.license-badge {
  -webkit-app-region: no-drag;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 0.74rem;
  cursor: pointer;
  transition: all 0.2s ease;
  background: rgba(100, 116, 139, 0.08);
  color: #334155;
}

.license-badge:hover {
  transform: translateY(-1px);
}

.license-badge.free {
  border-color: #cbd5e1;
}

.license-badge.insider {
  background: #e5f2ff;
  border-color: #b8dcff;
  color: #0f4b8a;
}

.license-badge.pro {
  background: #f2ffe9;
  border-color: #c9e9b2;
  color: #2f6b0f;
}

.license-badge.trial {
  background: #fff7e8;
  border-color: #fed7aa;
  color: #9a3412;
}

.license-badge.ultimate {
  background: #fff1f8;
  border-color: #f9a8d4;
  color: #9d174d;
}

.license-badge.enterprise {
  background: #ecfeff;
  border-color: #a5f3fc;
  color: #155e75;
}

.license-badge.is-expired {
  background: #fff1f2;
  border-color: #fecdd3;
  color: #be123c;
}

.hint {
  opacity: 0.76;
  font-size: 0.7rem;
}
</style>
