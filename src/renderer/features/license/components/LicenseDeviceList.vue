<template>
  <div class="license-device-list">
    <div v-if="devices.length === 0" class="device-empty">
      {{ t('license.devices.empty') }}
    </div>

    <div v-else class="device-cards">
      <article v-for="device in devices" :key="device.id" class="device-card" :class="{ 'is-current': device.current }">
        <div class="device-main">
          <div class="device-hardware-icon" :class="{ 'is-current-icon': device.current }">
            <component :is="getDeviceIcon(device.platform)" size="20" />
          </div>

          <div class="device-details">
            <div class="device-title-row">
              <span class="device-name" :title="device.name">{{ device.name }}</span>
              <span v-if="device.current" class="current-badge">
                {{ t('license.devices.current') }}
              </span>
            </div>

            <div class="device-sub-row">
              <span class="device-platform">{{ device.platform || t('common.unknown') }}</span>
              <span class="device-dot-separator">•</span>
              <span class="device-last-seen" :title="formatDate(device.lastSeenAt)">
                {{ t('license.devices.lastSeen') }}: {{ formatRelativeTime(device.lastSeenAt) }}
              </span>
            </div>
          </div>
        </div>

        <div class="device-actions">
          <span class="status-pill" :class="getStatusToneClass(device.status)">
            <span class="status-indicator-dot"></span>
            {{ getStatusLabel(device.status) }}
          </span>

          <button type="button" class="deactivate-btn" :disabled="processingDeviceId === device.id"
            @click="handleDeactivate(device.id, device.current)">
            <span v-if="processingDeviceId === device.id" class="spinner small"></span>
            <span v-else>{{ t('license.devices.deactivate') }}</span>
          </button>
        </div>
      </article>
    </div>

    <Transition name="fade-slide">
      <p v-if="errorMessage" class="device-error-banner">{{ errorMessage }}</p>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { IconDeviceDesktop, IconBrandWindows, IconBrandApple, IconDeviceMobile } from '@tabler/icons-vue';
import type { LicenseDevice } from '@shared/license.constants';
import { licenseService, normalizeLicenseErrorMessage } from '../services/license.service';

interface Props {
  devices: LicenseDevice[];
}

defineProps<Props>();

const { t, te } = useI18n();
const processingDeviceId = ref<string | null>(null);
const errorMessage = ref('');

function getDeviceIcon(platform: string | null) {
  if (!platform) {
    return IconDeviceDesktop;
  }
  const p = platform.toLowerCase();
  if (p.includes('win') || p.includes('windows')) {
    return IconBrandWindows;
  }
  if (p.includes('mac') || p.includes('os x') || p.includes('darwin')) {
    return IconBrandApple;
  }
  if (p.includes('phone') || p.includes('android') || p.includes('ios') || p.includes('iphone')) {
    return IconDeviceMobile;
  }
  return IconDeviceDesktop;
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Date(timestamp).toLocaleString();
}

function formatRelativeTime(value: string | null): string {
  if (!value) return '-';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;

  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return t('saveStatus.justNow');
  if (diffMin < 60) return t('saveStatus.minutesAgo', { minutes: diffMin });
  if (diffHour < 24) return t('statusBar.savedHoursAgo', `${diffHour}小时前`); // Fallback formatting
  if (diffDay === 1) return '昨天';
  if (diffDay < 30) return `${diffDay}天前`;

  return new Date(timestamp).toLocaleDateString();
}

function getStatusToneClass(value: string): string {
  const status = value.trim().toLowerCase();
  if (status === 'active') return 'is-active';
  if (status === 'inactive') return 'is-inactive';
  if (status === 'revoked') return 'is-revoked';
  return 'is-default';
}

function getStatusLabel(value: string): string {
  const status = value.trim().toLowerCase();
  const key = `license.deviceStatus.${status}`;
  return te(key) ? t(key) : value;
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
    errorMessage.value = normalizeLicenseErrorMessage(error);
  } finally {
    processingDeviceId.value = null;
  }
}
</script>

<style scoped>
.license-device-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.device-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.device-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  border: 1px solid var(--panel-border);
  background: var(--panel);
  border-radius: 12px;
  padding: 12px 16px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.device-card:hover {
  border-color: color-mix(in srgb, var(--accent) 35%, var(--panel-border));
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
}

.device-card.is-current {
  border-color: color-mix(in srgb, var(--accent) 50%, var(--panel-border));
  background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 4%, var(--panel)), var(--panel));
}

.device-main {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  flex: 1;
}

.device-hardware-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--panel-hover);
  color: var(--text-muted);
  border: 1px solid var(--panel-border);
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.device-card:hover .device-hardware-icon {
  color: var(--text);
  border-color: var(--text-muted);
}

.device-hardware-icon.is-current-icon {
  background: color-mix(in srgb, var(--accent) 12%, var(--panel));
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 30%, var(--panel-border));
}

.device-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.device-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.device-name {
  font-weight: 650;
  color: var(--text);
  font-size: 0.88rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.current-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, var(--panel));
  border: 1px solid color-mix(in srgb, var(--accent) 25%, var(--panel-border));
}

.device-sub-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  color: var(--text-muted);
}

.device-platform {
  font-weight: 500;
}

.device-dot-separator {
  opacity: 0.5;
}

.device-last-seen {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.device-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.76rem;
  border: 1px solid transparent;
  font-weight: 600;
  text-transform: capitalize;
}

.status-indicator-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.status-pill.is-active {
  color: #166534;
  background: #ecfdf3;
  border-color: #bbf7d0;
}

[data-theme='dark'] .status-pill.is-active {
  color: #4ade80;
  background: rgba(22, 101, 52, 0.2);
  border-color: rgba(74, 222, 128, 0.3);
}

.status-pill.is-active .status-indicator-dot {
  background: #166534;
}

[data-theme='dark'] .status-pill.is-active .status-indicator-dot {
  background: #4ade80;
}

.status-pill.is-inactive {
  color: var(--text-muted);
  background: var(--panel-hover);
  border-color: var(--panel-border);
}

.status-pill.is-inactive .status-indicator-dot {
  background: var(--text-muted);
}

.status-pill.is-revoked {
  color: #9f1239;
  background: #fff1f2;
  border-color: #fecdd3;
}

[data-theme='dark'] .status-pill.is-revoked {
  color: #fb7185;
  background: rgba(159, 18, 57, 0.2);
  border-color: rgba(251, 113, 133, 0.3);
}

.status-pill.is-revoked .status-indicator-dot {
  background: #9f1239;
}

[data-theme='dark'] .status-pill.is-revoked .status-indicator-dot {
  background: #fb7185;
}

.status-pill.is-default {
  color: var(--text-muted);
  background: var(--panel-hover);
  border-color: var(--panel-border);
}

.status-pill.is-default .status-indicator-dot {
  background: var(--text-muted);
}

.deactivate-btn {
  border: 1px solid color-mix(in srgb, var(--danger) 25%, var(--panel-border));
  background: color-mix(in srgb, var(--danger) 6%, var(--panel));
  color: var(--danger);
  min-width: 60px;
  height: 28px;
  border-radius: 6px;
  padding: 0 10px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.deactivate-btn:hover:not(:disabled) {
  border-color: var(--danger);
  background: color-mix(in srgb, var(--danger) 12%, var(--panel));
  color: var(--danger);
}

.deactivate-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.device-empty {
  font-size: 0.84rem;
  color: var(--text-muted);
  border: 1px dashed var(--panel-border);
  border-radius: 10px;
  padding: 18px;
  text-align: center;
  background: var(--panel);
}

.device-error-banner {
  margin: 10px 0 0 0;
  border: 1px solid color-mix(in srgb, var(--danger) 20%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--danger) 6%, var(--panel));
  color: var(--danger);
  font-size: 0.82rem;
  padding: 8px 12px;
  font-weight: 500;
}

@media (max-width: 640px) {
  .device-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .device-actions {
    width: 100%;
    justify-content: space-between;
    border-top: 1px solid var(--panel-border);
    padding-top: 8px;
  }
}

/* Transitions */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.25s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
