<template>
  <div class="management-view">
    <section class="summary-panel">
      <div class="summary-main">
        <h2 class="title">{{ t('license.management.planType') }}: {{ t(`license.badge.${store.plan}`) }}</h2>
        <p class="status-text">
          {{ t('license.devices.status') }}: {{ t(store.getStatusTextKey(store.status)) }}
          <span v-if="!store.canManage && localizedErrorMessage" class="status-inline-reason"> {{ localizedErrorMessage }}</span>
        </p>
      </div>
      <div class="actions">
        <button type="button" class="action-button secondary license-btn" :disabled="isRefreshing || !store.canManage" @click="handleRefresh">
          <span v-if="isRefreshing" class="spinner small"></span>
          <span v-else>{{ t('license.management.refresh') }}</span>
        </button>
        <button type="button" class="action-button secondary license-btn" :disabled="isRefreshing || !store.canManage" @click="handleValidate">
          {{ t('license.management.validate') }}
        </button>
        <button
          type="button"
          class="action-button secondary license-btn is-danger"
          :disabled="isClearing || !store.canManage"
          @click="handleClear"
        >
          {{ t('license.management.clear') }}
        </button>
      </div>
    </section>

    <section class="meta-grid">
      <article class="meta-item">
        <span class="label">{{ t('license.management.expiresAt') }}</span>
        <span class="value">{{ formatDate(store.state.expiresAt) }}</span>
      </article>
      <article class="meta-item">
        <span class="label">{{ t('license.management.graceExpiresAt') }}</span>
        <span class="value">{{ formatDate(store.state.graceExpiresAt) }}</span>
      </article>
      <article class="meta-item">
        <span class="label">{{ t('license.management.activatedDevices') }}</span>
        <span class="value">{{ store.activatedDevices }} / {{ store.maxDevices ?? '-' }}</span>
      </article>
      <article class="meta-item">
        <span class="label">{{ t('license.management.lastValidatedAt') }}</span>
        <span class="value">{{ formatTimestamp(store.lastValidatedAt) }}</span>
      </article>
    </section>

    <section class="device-panel">
      <LicenseDeviceList :devices="store.devices" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { licenseService, normalizeLicenseStateError } from '../services/license.service';
import { useLicenseStore } from '../store/license.store';
import LicenseDeviceList from './LicenseDeviceList.vue';

const { t } = useI18n();
const store = useLicenseStore();
const isRefreshing = ref(false);
const isClearing = ref(false);
const localizedErrorMessage = computed(() => normalizeLicenseStateError(store.lastErrorCode, store.lastErrorMessage));

function formatDate(value: string | null): string {
  if (!value) {
    return '-';
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return value;
  }

  return new Date(timestamp).toLocaleString();
}

function formatTimestamp(value: number | null): string {
  if (!value) {
    return '-';
  }
  return new Date(value).toLocaleString();
}

async function handleRefresh(): Promise<void> {
  if (isRefreshing.value) {
    return;
  }

  isRefreshing.value = true;
  try {
    await licenseService.refreshDevices(true);
  } finally {
    isRefreshing.value = false;
  }
}

async function handleValidate(): Promise<void> {
  if (isRefreshing.value) {
    return;
  }

  isRefreshing.value = true;
  try {
    await licenseService.validate(true);
  } finally {
    isRefreshing.value = false;
  }
}

async function handleClear(): Promise<void> {
  if (isClearing.value) {
    return;
  }

  if (!window.confirm(t('license.management.clearConfirm'))) {
    return;
  }

  isClearing.value = true;
  try {
    await licenseService.clear();
  } finally {
    isClearing.value = false;
  }
}
</script>

<style scoped>
.management-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.summary-panel {
  border: 1px solid #e7eaf0;
  border-radius: 10px;
  padding: 14px;
  background: #fbfbfc;
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-start;
}

.summary-main {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.title {
  margin: 0;
  font-size: 1.16rem;
  line-height: 1.2;
  color: #0f172a;
}

.status-text {
  margin: 0;
  color: #475569;
  font-size: 0.9rem;
  font-weight: 500;
  line-height: 1.4;
  word-break: break-word;
}

.status-inline-reason {
  color: #be123c;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.license-btn.is-danger {
  border-color: #fecaca;
  color: #be123c;
  background: #fff1f2;
}

.license-btn.is-danger:hover:not(:disabled) {
  border-color: #fca5a5;
  background: #ffe4e6;
  color: #9f1239;
}

.meta-grid {
  border: 1px solid #e7eaf0;
  border-radius: 10px;
  background: #fbfbfc;
  padding: 10px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.meta-item {
  border: 1px solid #e7eaf0;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 0.85rem;
  background: #ffffff;
}

.meta-item .label {
  color: #5f6b7a;
  font-weight: 500;
}

.meta-item .value {
  color: #0f172a;
  font-weight: 600;
}

.device-panel {
  border: 1px solid #e7eaf0;
  border-radius: 10px;
  background: #ffffff;
  padding: 10px;
}

@media (max-width: 920px) {
  .summary-panel {
    flex-direction: column;
  }

  .meta-grid {
    grid-template-columns: 1fr;
  }

  .actions {
    width: 100%;
  }

  .actions .license-btn {
    flex: 1 1 calc(50% - 8px);
  }
}

@media (max-width: 640px) {
  .actions .license-btn {
    flex-basis: 100%;
  }
}
</style>
