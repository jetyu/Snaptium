<template>
  <div class="license-device-list">
    <div v-if="devices.length === 0" class="device-empty">
      <span class="device-empty-icon" aria-hidden="true">
        <IconDeviceDesktop :size="18" />
      </span>
      <span>{{ t('license.devices.empty') }}</span>
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

          <button
            type="button"
            class="deactivate-btn"
            :disabled="processingDeviceId === device.id"
            @click="handleDeactivate(device)"
          >
            <span v-if="processingDeviceId === device.id" class="deactivate-loading">
              <span class="spinner small"></span>
              <span>{{ t('license.devices.deactivate') }}</span>
            </span>
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

  if (diffSec < 60) return t('workbench.time.justNow');
  if (diffMin < 60) return t('workbench.time.minutesAgo', { count: diffMin });
  if (diffHour < 24) return t('workbench.time.hoursAgo', { count: diffHour });
  if (diffDay < 30) return t('workbench.time.daysAgo', { count: diffDay });

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

async function handleDeactivate(device: LicenseDevice): Promise<void> {
  errorMessage.value = '';
  const confirmKey = device.current
    ? 'license.devices.deactivateCurrentConfirm'
    : 'license.devices.deactivateConfirm';
  if (!window.confirm(t(confirmKey))) {
    return;
  }

  processingDeviceId.value = device.id;
  try {
    await licenseService.deactivateDevice(device.id);
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
  position: relative;
  overflow: hidden;
  min-height: 64px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  border: 1px solid color-mix(in srgb, var(--panel-border) 86%, transparent);
  background: var(--surface-raised);
  border-radius: 10px;
  padding: 12px 16px;
  box-shadow: var(--shadow-soft);
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    box-shadow 0.15s ease;
}

.device-card::before {
  content: '';
  position: absolute;
  inset: 12px auto 12px 0;
  width: 3px;
  border-radius: 0 999px 999px 0;
  background: transparent;
}

.device-card:hover {
  border-color: color-mix(in srgb, var(--border-strong) 72%, var(--panel-border));
  background: color-mix(in srgb, var(--surface-soft) 72%, var(--surface-raised));
  box-shadow: var(--shadow-soft);
}

.device-card.is-current {
  border-color: color-mix(in srgb, var(--license-plan-pro-border) 76%, var(--panel-border));
  background: var(--surface-raised);
}

.device-card.is-current::before {
  background: var(--license-plan-pro-fill);
}

.device-main {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  flex: 1;
}

.device-hardware-icon {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-subtle);
  color: var(--text-secondary);
  border: 1px solid color-mix(in srgb, var(--panel-border) 82%, transparent);
  flex-shrink: 0;
  transition:
    border-color 0.15s ease,
    color 0.15s ease,
    background-color 0.15s ease;
}

.device-card:hover .device-hardware-icon {
  color: var(--text-primary);
  border-color: color-mix(in srgb, var(--border-strong) 72%, var(--panel-border));
}

.device-hardware-icon.is-current-icon {
  background: var(--license-plan-pro-bg);
  color: var(--license-plan-pro-text);
  border-color: var(--license-plan-pro-border);
}

.device-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1 1 auto;
}

.device-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.device-name {
  font-weight: 650;
  color: var(--text-primary);
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
  color: var(--license-plan-pro-text);
  background: color-mix(in srgb, var(--license-plan-pro-bg) 92%, var(--panel));
  border: 1px solid var(--license-plan-pro-border);
}

.device-sub-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 0.78rem;
  color: var(--text-tertiary);
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
  min-width: 0;
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
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 0.76rem;
  border: 1px solid transparent;
  font-weight: 600;
  text-transform: none;
}

.status-indicator-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.status-pill.is-active {
  color: var(--status-success-text);
  background: var(--status-success-bg);
  border-color: var(--status-success-border);
}

.status-pill.is-active .status-indicator-dot {
  background: var(--status-success-text);
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
  color: var(--status-danger-text);
  background: var(--status-danger-bg);
  border-color: var(--status-danger-border);
}

.status-pill.is-revoked .status-indicator-dot {
  background: var(--status-danger-text);
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
  background: color-mix(in srgb, var(--danger) 6%, var(--surface-raised));
  color: var(--danger);
  min-width: 60px;
  height: 30px;
  border-radius: 8px;
  padding: 0 10px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    color 0.15s ease;
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

.deactivate-loading {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.device-empty {
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 0.84rem;
  color: var(--text-secondary);
  border: 1px dashed color-mix(in srgb, var(--panel-border) 86%, transparent);
  border-radius: 10px;
  padding: 16px;
  text-align: center;
  background: var(--surface-raised);
}

.device-empty-icon {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--surface-subtle);
  border: 1px solid color-mix(in srgb, var(--panel-border) 82%, transparent);
  color: var(--text-tertiary);
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
