<template>
  <div class="management-view">
    <div class="license-summary-card" :class="[store.displayStatus, `plan-${store.plan}`]">
      <div class="summary-top">
        <div class="summary-plan" :class="`plan-${store.plan}`">
          <span v-if="planIcon" class="plan-icon" :class="store.plan" aria-hidden="true">
            <component :is="planIcon" :size="22" :stroke="1.8" />
          </span>
          <div class="plan-copy">
            <span class="plan-kicker">
              {{ audienceKey ? t(audienceKey) : t('license.management.planType') }}
            </span>
            <h2 class="plan-title">{{ t(`license.badge.${store.plan}`) }}</h2>
          </div>
        </div>

        <div class="summary-side">
          <div class="summary-status" :class="[store.displayStatus, `plan-${store.plan}`]">
            <span class="status-dot"></span>
            <span>{{ t(store.getStatusTextKey(store.displayStatus)) }}</span>
          </div>

          <div class="summary-actions">
            <button
              type="button"
              class="summary-action-btn"
              :disabled="isRefreshing || !store.canManage"
              :title="t('license.management.refresh')"
              :aria-label="t('license.management.refresh')"
              @click="handleRefresh"
            >
              <IconRefresh :size="15" :class="{ 'animate-spin': isRefreshing }" />
              <span>{{ t('license.management.refresh') }}</span>
            </button>

            <button
              type="button"
              class="summary-action-btn"
              :disabled="isRefreshing || !store.canManage"
              :title="t('license.management.validate')"
              :aria-label="t('license.management.validate')"
              @click="handleValidate"
            >
              <IconDeviceDesktopCheck :size="15" />
              <span>{{ t('license.management.validate') }}</span>
            </button>

            <button
              type="button"
              class="summary-action-btn danger-btn"
              :disabled="isClearing || !store.canManage"
              :title="t('license.management.clear')"
              :aria-label="t('license.management.clear')"
              @click="handleClear"
            >
              <IconTrash :size="15" />
              <span>{{ t('license.management.clear') }}</span>
            </button>
          </div>
        </div>
      </div>

      <span v-if="localizedErrorMessage" class="summary-error-msg">
        {{ localizedErrorMessage }}
      </span>
    </div>

    <!-- Key Metrics Grid -->
    <div class="metrics-grid">
      <div class="metric-card" :class="`plan-${store.plan}`">
        <div class="metric-header">
          <IconCalendarClock :size="18" class="metric-icon time" :class="`plan-${store.plan}`" />
          <span class="metric-label">{{ t('license.management.expiresAt') }}</span>
        </div>
        <div class="metric-value">{{ formatDate(store.state.expiresAt) }}</div>
      </div>

      <div class="metric-card" :class="`plan-${store.plan}`">
        <div class="metric-header">
          <IconDevices :size="18" class="metric-icon device" :class="`plan-${store.plan}`" />
          <span class="metric-label">{{ t('license.management.activatedDevicesCount') }}</span>
        </div>
        <div class="metric-value-container">
          <div class="metric-value">
            {{ store.activatedDevices }} <span class="metric-divider">/</span> {{ store.maxDevices ?? '-' }}
          </div>

          <div class="device-progress" v-if="store.maxDevices" :class="`plan-${store.plan}`">
            <div class="device-progress-bar" :class="`plan-${store.plan}`"
               :style="{ width: `${Math.min(100, (store.activatedDevices / store.maxDevices) * 100)}%` }"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Devices List Table -->
    <div class="devices-section">
      <div class="devices-section-header">
        <h3>{{ t('license.management.activatedDevicesList') }}</h3>
      </div>
      <LicenseDeviceList :devices="store.devices" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, type Component } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  IconBuilding,
  IconCalendarClock,
  IconCrown,
  IconDeviceDesktopCheck,
  IconDevices,
  IconNotebook,
  IconRefresh,
  IconSparkle2,
  IconSparkles2,
  IconTimeDuration0,
  IconTrash,
} from '@tabler/icons-vue';
import {
  LICENSE_PLANS,
  type LicensePlan,
} from '@shared/license.constants';
import { licenseService, normalizeLicenseStateError } from '../services/license.service';
import { useLicenseStore } from '../store/license.store';
import LicenseDeviceList from './LicenseDeviceList.vue';

const { t } = useI18n();
const store = useLicenseStore();
const isRefreshing = ref(false);
const isClearing = ref(false);
const localizedErrorMessage = computed(() => normalizeLicenseStateError(store.lastErrorCode, store.lastErrorMessage));
const PLAN_ICONS: Partial<Record<LicensePlan, Component>> = {
  [LICENSE_PLANS.FREE]: IconNotebook,
  [LICENSE_PLANS.TRIAL]: IconTimeDuration0,
  [LICENSE_PLANS.INSIDER]: IconSparkle2,
  [LICENSE_PLANS.PRO]: IconSparkles2,
  [LICENSE_PLANS.ULTIMATE]: IconCrown,
  [LICENSE_PLANS.ENTERPRISE]: IconBuilding,
};
const planIcon = computed(() => PLAN_ICONS[store.plan] ?? null);
const AUDIENCE_KEYS: Partial<Record<LicensePlan, string>> = {
  [LICENSE_PLANS.INSIDER]: 'license.management.audience.insider',
  [LICENSE_PLANS.PRO]: 'license.management.audience.pro',
  [LICENSE_PLANS.TRIAL]: 'license.management.audience.trial',
  [LICENSE_PLANS.ULTIMATE]: 'license.management.audience.ultimate',
};
const audienceKey = computed(() => AUDIENCE_KEYS[store.plan] ?? null);

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
  gap: 20px;
}

.license-summary-card {
  position: relative;
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: 12px;
  padding: 18px 20px;
  color: var(--text);
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: var(--shadow-soft);
}

.license-summary-card.expired,
.license-summary-card.invalid {
  border-color: color-mix(in srgb, var(--danger) 22%, var(--panel-border));
}

.license-summary-card.plan-free {
  background: linear-gradient(180deg, color-mix(in srgb, var(--surface-soft) 72%, white), var(--panel));
}

.license-summary-card.plan-pro {
  background: linear-gradient(180deg, color-mix(in srgb, var(--license-plan-pro-bg) 80%, var(--surface-raised)), var(--panel));
}

.license-summary-card.plan-trial {
  background: linear-gradient(180deg, color-mix(in srgb, var(--license-plan-pro-bg) 80%, var(--surface-raised)), var(--panel));
}

.license-summary-card.plan-ultimate {
  background: linear-gradient(180deg, color-mix(in srgb, var(--status-warning-bg) 88%, var(--surface-raised)), var(--panel));
}

.summary-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.summary-plan {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.plan-icon {
  width: 50px;
  height: 50px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--panel-border) 88%, white);
  background:
    linear-gradient(180deg, var(--surface-overlay), var(--surface-scrim));
  color: var(--text-muted);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 78%, transparent),
    var(--shadow-soft);
}

.plan-icon.free {
  color: var(--status-neutral-text);
  background: linear-gradient(180deg, color-mix(in srgb, var(--status-neutral-bg) 60%, var(--surface-raised)), var(--surface-soft));
  border-color: var(--status-neutral-border);
}

.plan-icon.insider {
  color: var(--status-success-text);
  background: linear-gradient(180deg, color-mix(in srgb, var(--status-success-bg) 70%, var(--surface-raised)), var(--surface-soft));
  border-color: var(--status-success-border);
}

.plan-icon.pro {
  color: var(--license-plan-pro-text);
  background: linear-gradient(180deg, color-mix(in srgb, var(--license-plan-pro-bg) 70%, var(--surface-raised)), var(--surface-soft));
  border-color: var(--license-plan-pro-border);
}

.plan-icon.trial {
  color: var(--license-plan-pro-text);
  background: linear-gradient(180deg, color-mix(in srgb, var(--license-plan-pro-bg) 70%, var(--surface-raised)), var(--surface-soft));
  border-color: var(--license-plan-pro-border);
}

.plan-icon.ultimate {
  color: var(--status-warning-text);
  background: linear-gradient(180deg, color-mix(in srgb, var(--status-warning-bg) 72%, var(--surface-raised)), var(--surface-soft));
  border-color: var(--status-warning-border);
}

.plan-icon.enterprise {
  color: var(--status-success-text);
  background: linear-gradient(180deg, color-mix(in srgb, var(--status-success-bg) 70%, var(--surface-raised)), var(--surface-soft));
  border-color: var(--status-success-border);
}

.plan-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.plan-kicker {
  font-size: 0.78rem;
  color: var(--text-muted);
  font-weight: 600;
  line-height: 1.2;
}

.plan-title {
  margin: 0;
  font-size: 1.34rem;
  font-weight: 720;
  color: var(--text);
  letter-spacing: -0.01em;
}

.summary-plan.plan-free .plan-kicker,
.summary-plan.plan-free .plan-title {
  color: var(--status-neutral-text);
}

.summary-plan.plan-pro .plan-kicker,
.summary-plan.plan-pro .plan-title {
  color: var(--license-plan-pro-text);
}

.summary-plan.plan-trial .plan-kicker,
.summary-plan.plan-trial .plan-title {
  color: var(--license-plan-pro-text);
}

.summary-plan.plan-ultimate .plan-kicker,
.summary-plan.plan-ultimate .plan-title {
  color: var(--status-warning-text);
}

.summary-plan.plan-insider .plan-kicker,
.summary-plan.plan-insider .plan-title {
  color: var(--status-success-text);
}

.summary-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}

.summary-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--panel-hover);
  border: 1px solid var(--panel-border);
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text);
}

.summary-status.plan-free {
  background: var(--status-neutral-bg);
  border-color: var(--status-neutral-border);
  color: var(--status-neutral-text);
}

.summary-status.plan-pro {
  background: var(--license-plan-pro-bg);
  border-color: var(--license-plan-pro-border);
  color: var(--license-plan-pro-text);
}

.summary-status.plan-trial {
  background: var(--license-plan-pro-bg);
  border-color: var(--license-plan-pro-border);
  color: var(--license-plan-pro-text);
}

.summary-status.plan-ultimate {
  background: var(--status-warning-bg);
  border-color: var(--status-warning-border);
  color: var(--status-warning-text);
}

.summary-status.plan-insider {
  background: var(--status-success-bg);
  border-color: var(--status-success-border);
  color: var(--status-success-text);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--status-success-text);
}

.summary-status.plan-free .status-dot {
  background: var(--status-neutral-text);
}

.summary-status.plan-pro .status-dot {
  background: var(--license-plan-pro-text);
}

.summary-status.plan-trial .status-dot {
  background: var(--license-plan-pro-text);
}

.summary-status.plan-ultimate .status-dot {
  background: var(--status-warning-text);
}

.summary-status.plan-insider .status-dot {
  background: var(--status-success-text);
}

.summary-status.expired .status-dot,
.summary-status.invalid .status-dot {
  background: var(--danger);
}

.summary-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.summary-action-btn {
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-hover);
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
}

.summary-action-btn:hover:not(:disabled) {
  border-color: var(--border-strong);
  background: var(--panel);
  color: var(--text);
}

.summary-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.summary-action-btn.danger-btn {
  border-color: color-mix(in srgb, var(--danger) 28%, var(--panel-border));
  color: var(--danger);
}

.summary-action-btn.danger-btn:hover:not(:disabled) {
  border-color: var(--danger);
  background: color-mix(in srgb, var(--danger) 10%, var(--panel));
  color: var(--danger);
}

.summary-error-msg {
  font-size: 0.8rem;
  color: var(--danger);
  font-weight: 500;
  background: color-mix(in srgb, var(--danger) 8%, var(--panel));
  border: 1px solid color-mix(in srgb, var(--danger) 15%, var(--panel-border));
  padding: 4px 10px;
  border-radius: 6px;
}

/* Metrics Grid */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.metric-card {
  border: 1px solid var(--panel-border);
  background: var(--panel);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color 0.15s ease;
}

.metric-card:hover {
  border-color: color-mix(in srgb, var(--border-strong) 72%, var(--panel-border));
}

.metric-card.plan-free:hover {
  border-color: var(--status-neutral-border);
}

.metric-card.plan-pro:hover {
  border-color: var(--license-plan-pro-border);
}

.metric-card.plan-trial:hover {
  border-color: var(--license-plan-pro-border);
}

.metric-card.plan-ultimate:hover {
  border-color: var(--status-warning-border);
}

.metric-card.plan-insider:hover {
  border-color: var(--status-success-border);
}

.metric-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.metric-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
}

.metric-icon.time {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
}

.metric-icon.device {
  background: var(--status-info-bg);
  color: var(--status-info-text);
}

.metric-icon.plan-free {
  background: var(--status-neutral-bg);
  color: var(--status-neutral-text);
}

.metric-icon.plan-pro {
  background: var(--license-plan-pro-bg);
  color: var(--license-plan-pro-text);
}

.metric-icon.plan-trial {
  background: var(--license-plan-pro-bg);
  color: var(--license-plan-pro-text);
}

.metric-icon.plan-ultimate {
  background: var(--status-warning-bg);
  color: var(--status-warning-text);
}

.metric-icon.plan-insider {
  background: var(--status-success-bg);
  color: var(--status-success-text);
}

.metric-label {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-weight: 600;
}

.metric-value-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.metric-value {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text);
}

.metric-divider {
  color: var(--text-muted);
  font-weight: 400;
  font-size: 0.95rem;
  margin: 0 2px;
}

/* Progress bar for device limits */
.device-progress {
  width: 100%;
  height: 6px;
  background: var(--panel-hover);
  border: 1px solid var(--panel-border);
  border-radius: 999px;
  overflow: hidden;
}

.device-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, color-mix(in srgb, var(--license-plan-pro-text) 82%, white), var(--license-plan-pro-fill));
  border-radius: 999px;
}

.device-progress.plan-free .device-progress-bar,
.device-progress-bar.plan-free {
  background: linear-gradient(90deg, color-mix(in srgb, var(--status-neutral-text) 72%, white), var(--status-neutral-text));
}

.device-progress.plan-pro .device-progress-bar,
.device-progress-bar.plan-pro {
  background: linear-gradient(90deg, color-mix(in srgb, var(--license-plan-pro-text) 72%, white), var(--license-plan-pro-fill));
}

.device-progress.plan-trial .device-progress-bar,
.device-progress-bar.plan-trial {
  background: linear-gradient(90deg, color-mix(in srgb, var(--license-plan-pro-text) 72%, white), var(--license-plan-pro-fill));
}

.device-progress.plan-ultimate .device-progress-bar,
.device-progress-bar.plan-ultimate {
  background: linear-gradient(90deg, color-mix(in srgb, var(--status-warning-text) 72%, white), var(--status-warning-text));
}

.device-progress.plan-insider .device-progress-bar,
.device-progress-bar.plan-insider {
  background: linear-gradient(90deg, color-mix(in srgb, var(--status-success-text) 72%, white), var(--status-success-text));
}

/* Devices Section */
.devices-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.devices-section-header {
  border-bottom: 1px solid var(--panel-border);
  padding-bottom: 8px;
  margin-bottom: 4px;
}

.devices-section-header h3 {
  margin: 0;
  font-size: 0.94rem;
  font-weight: 700;
  color: var(--text);
}

/* Animations */
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 800px) {
  .summary-top {
    flex-direction: column;
  }

  .summary-side {
    width: 100%;
    align-items: flex-start;
  }

  .summary-plan {
    align-items: flex-start;
  }

  .summary-actions {
    width: 100%;
  }

  .metrics-grid {
    grid-template-columns: 1fr;
  }
}
</style>
