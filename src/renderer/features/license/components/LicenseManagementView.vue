<template>
  <div class="management-view">
    <div class="header">
      <div>
        <h2 class="title">{{ t(`license.badge.${store.plan}`) }}</h2>
        <p class="status">{{ t(store.getStatusTextKey(store.status)) }}</p>
      </div>
      <div class="actions">
        <button type="button" class="action-button secondary" :disabled="isRefreshing" @click="handleRefresh">
          <span v-if="isRefreshing" class="spinner small"></span>
          <span v-else>{{ t('license.management.refresh') }}</span>
        </button>
        <button type="button" class="action-button secondary" :disabled="isRefreshing" @click="handleValidate">
          {{ t('license.management.validate') }}
        </button>
        <button type="button" class="action-button secondary danger" :disabled="isClearing" @click="handleClear">
          {{ t('license.management.clear') }}
        </button>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-item">
        <span class="label">{{ t('license.management.expiresAt') }}</span>
        <span class="value">{{ formatDate(store.state.expiresAt) }}</span>
      </div>
      <div class="meta-item">
        <span class="label">{{ t('license.management.graceExpiresAt') }}</span>
        <span class="value">{{ formatDate(store.state.graceExpiresAt) }}</span>
      </div>
      <div class="meta-item">
        <span class="label">{{ t('license.management.activatedDevices') }}</span>
        <span class="value">{{ store.activatedDevices }} / {{ store.maxDevices ?? '-' }}</span>
      </div>
      <div class="meta-item">
        <span class="label">{{ t('license.management.lastValidatedAt') }}</span>
        <span class="value">{{ formatTimestamp(store.lastValidatedAt) }}</span>
      </div>
    </div>

    <LicenseDeviceList :devices="store.devices" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { licenseService } from '../services/license.service';
import { useLicenseStore } from '../store/license.store';
import LicenseDeviceList from './LicenseDeviceList.vue';

const { t } = useI18n();
const store = useLicenseStore();
const isRefreshing = ref(false);
const isClearing = ref(false);

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
    await licenseService.refreshDevices();
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
    await licenseService.validate();
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
  gap: 14px;
}

.header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.title {
  margin: 0;
  font-size: 1.2rem;
}

.status {
  margin: 6px 0 0 0;
  color: #475569;
}

.actions {
  display: flex;
  gap: 8px;
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.meta-item {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 0.84rem;
}

.meta-item .label {
  color: #64748b;
}

.meta-item .value {
  color: #0f172a;
}

.danger {
  border-color: #fecaca;
  color: #b91c1c;
}

@media (max-width: 920px) {
  .header {
    flex-direction: column;
  }

  .meta-grid {
    grid-template-columns: 1fr;
  }
}
</style>

