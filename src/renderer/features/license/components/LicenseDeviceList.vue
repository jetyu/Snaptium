<template>
  <div class="license-device-list">
    <div class="device-header">
      <span>{{ t('license.devices.name') }}</span>
      <span>{{ t('license.devices.platform') }}</span>
      <span>{{ t('license.devices.status') }}</span>
      <span>{{ t('license.devices.lastSeen') }}</span>
      <span>{{ t('license.devices.action') }}</span>
    </div>

    <div v-if="devices.length === 0" class="device-empty">
      {{ t('license.devices.empty') }}
    </div>

    <div v-for="device in devices" :key="device.id" class="device-row">
      <span class="name">
        {{ device.name }}
        <span v-if="device.current" class="current-badge">{{ t('license.devices.current') }}</span>
      </span>
      <span>{{ device.platform || '-' }}</span>
      <span>{{ device.status }}</span>
      <span>{{ formatDate(device.lastSeenAt) }}</span>
      <span>
        <button
          type="button"
          class="deactivate-btn"
          :disabled="processingDeviceId === device.id"
          @click="handleDeactivate(device.id, device.current)"
        >
          {{ t('license.devices.deactivate') }}
        </button>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { LicenseDevice } from '@shared/license.constants';
import { licenseService } from '../services/license.service';

interface Props {
  devices: LicenseDevice[];
}

defineProps<Props>();

const { t } = useI18n();
const processingDeviceId = ref<string | null>(null);

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

async function handleDeactivate(deviceId: string, current: boolean): Promise<void> {
  const confirmKey = current ? 'license.devices.deactivateCurrentConfirm' : 'license.devices.deactivateConfirm';
  if (!window.confirm(t(confirmKey))) {
    return;
  }

  processingDeviceId.value = deviceId;
  try {
    await licenseService.deactivateDevice(deviceId);
  } finally {
    processingDeviceId.value = null;
  }
}
</script>

<style scoped>
.license-device-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.device-header,
.device-row {
  display: grid;
  grid-template-columns: 1.4fr 0.8fr 0.8fr 1fr 0.7fr;
  gap: 8px;
  align-items: center;
}

.device-header {
  padding: 6px 8px;
  font-size: 0.78rem;
  color: #64748b;
}

.device-row {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px;
  font-size: 0.82rem;
}

.name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.current-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 0.72rem;
  color: #0f4b8a;
  background: #e5f2ff;
}

.deactivate-btn {
  border: 1px solid #fecaca;
  background: #fff1f2;
  color: #be123c;
  border-radius: 6px;
  padding: 4px 8px;
  cursor: pointer;
}

.deactivate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.device-empty {
  font-size: 0.84rem;
  color: #64748b;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  padding: 12px;
}
</style>

