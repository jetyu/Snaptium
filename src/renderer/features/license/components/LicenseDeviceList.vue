<template>
  <div class="license-device-list">
    <div v-if="devices.length === 0" class="device-empty">
      {{ t('license.devices.empty') }}
    </div>

    <div v-else class="device-table">
      <div class="device-header">
        <span>{{ t('license.devices.name') }}</span>
        <span>{{ t('license.devices.platform') }}</span>
        <span>{{ t('license.devices.status') }}</span>
        <span>{{ t('license.devices.lastSeen') }}</span>
        <span>{{ t('license.devices.action') }}</span>
      </div>

      <article v-for="device in devices" :key="device.id" class="device-row">
        <div class="name">
          <span class="device-name">{{ device.name }}</span>
          <span v-if="device.current" class="current-badge">{{ t('license.devices.current') }}</span>
        </div>
        <span class="platform-text">{{ device.platform || '-' }}</span>
        <span>
          <span class="status-pill" :class="getStatusToneClass(device.status)">
            {{ device.status }}
          </span>
        </span>
        <span class="timestamp">{{ formatDate(device.lastSeenAt) }}</span>
        <span class="action-cell">
          <button
            type="button"
            class="action-button secondary deactivate-btn"
            :disabled="processingDeviceId === device.id"
            @click="handleDeactivate(device.id, device.current)"
          >
            {{ t('license.devices.deactivate') }}
          </button>
        </span>
      </article>
    </div>

    <p v-if="errorMessage" class="device-error">{{ errorMessage }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { getErrorMessage } from '@shared/utils/error.utils';
import type { LicenseDevice } from '@shared/license.constants';
import { licenseService } from '../services/license.service';

interface Props {
  devices: LicenseDevice[];
}

defineProps<Props>();

const { t } = useI18n();
const processingDeviceId = ref<string | null>(null);
const errorMessage = ref('');

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

function getStatusToneClass(value: string): string {
  const status = value.trim().toLowerCase();
  if (status === 'active') {
    return 'is-active';
  }
  if (status === 'inactive') {
    return 'is-inactive';
  }
  if (status === 'revoked') {
    return 'is-revoked';
  }
  return 'is-default';
}

async function handleDeactivate(deviceId: string, current: boolean): Promise<void> {
  errorMessage.value = '';
  const confirmKey = current ? 'license.devices.deactivateCurrentConfirm' : 'license.devices.deactivateConfirm';
  if (!window.confirm(t(confirmKey))) {
    return;
  }

  processingDeviceId.value = deviceId;
  try {
    await licenseService.deactivateDevice(deviceId);
  } catch (error) {
    errorMessage.value = getErrorMessage(error, t('license.activation.failed'));
  } finally {
    processingDeviceId.value = null;
  }
}
</script>

<style scoped>
.license-device-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.device-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.device-header,
.device-row {
  display: grid;
  grid-template-columns: minmax(180px, 1.4fr) minmax(120px, 0.95fr) minmax(100px, 0.75fr) minmax(130px, 1fr) minmax(120px, 0.8fr);
  gap: 8px;
  align-items: center;
}

.device-header {
  padding: 6px 8px;
  font-size: 0.78rem;
  color: #5f6b7a;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.device-row {
  border: 1px solid #e7eaf0;
  border-radius: 8px;
  padding: 8px;
  font-size: 0.82rem;
  background: #ffffff;
  transition: border-color 0.15s ease;
}

.device-row:hover {
  border-color: #d4dbe6;
}

.name {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.device-name {
  font-weight: 600;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.current-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 3px 9px;
  font-size: 0.72rem;
  color: #0f4b8a;
  background: #eff6ff;
  border: 1px solid #bfd3ff;
}

.platform-text {
  color: #334155;
}

.timestamp {
  color: #475569;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.74rem;
  border: 1px solid transparent;
  font-weight: 600;
}

.status-pill.is-active {
  color: #166534;
  background: #ecfdf3;
  border-color: #bbf7d0;
}

.status-pill.is-inactive {
  color: #334155;
  background: #f8fafc;
  border-color: #d2dae7;
}

.status-pill.is-revoked {
  color: #9f1239;
  background: #fff1f2;
  border-color: #fecdd3;
}

.status-pill.is-default {
  color: #475569;
  background: #f8fafc;
  border-color: #e2e8f0;
}

.action-cell {
  display: flex;
  justify-content: flex-start;
}

.deactivate-btn {
  border: 1px solid #fecaca;
  background: #fff6f6;
  color: #be123c;
  min-width: 76px;
  min-height: 28px;
  height: 28px;
  border-radius: 6px;
  padding: 0 8px;
  font-size: 0.76rem;
  font-weight: 500;
}

.deactivate-btn:hover:not(:disabled) {
  border-color: #fca5a5;
  background: #ffe4e6;
  color: #9f1239;
}

.deactivate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.device-empty {
  font-size: 0.85rem;
  color: #5f6b7a;
  border: 1px dashed #d3dae5;
  border-radius: 8px;
  padding: 14px 12px;
  background: #ffffff;
}

.device-error {
  margin: 0;
  border: 1px solid #fecaca;
  border-radius: 8px;
  background: #fff1f2;
  color: #be123c;
  font-size: 0.82rem;
  padding: 8px 10px;
}

@media (max-width: 840px) {
  .device-header {
    display: none;
  }

  .device-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .name {
    justify-content: space-between;
  }

  .action-cell {
    justify-content: flex-start;
  }

  .deactivate-btn {
    width: 100%;
  }
}
</style>
