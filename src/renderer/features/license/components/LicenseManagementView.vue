<template>
  <div class="management-view">
    <div class="license-summary-card" :class="store.displayStatus">
      <div class="summary-top">
        <div class="summary-plan">
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
          <div class="summary-status" :class="store.displayStatus">
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
            </button>
          </div>
        </div>
      </div>

      <span v-if="!store.canManage && localizedErrorMessage" class="summary-error-msg">
        {{ localizedErrorMessage }}
      </span>
    </div>

    <!-- Key Metrics Grid -->
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-header">
          <IconCalendarClock :size="18" class="metric-icon time" />
          <span class="metric-label">{{ t('license.management.expiresAt') }}</span>
        </div>
        <div class="metric-value">{{ formatDate(store.state.expiresAt) }}</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <IconDevices :size="18" class="metric-icon device" />
          <span class="metric-label">{{ t('license.management.activatedDevicesCount') }}</span>
        </div>
        <div class="metric-value-container">
          <div class="metric-value">
            {{ store.activatedDevices }} <span class="metric-divider">/</span> {{ store.maxDevices ?? '-' }}
          </div>

          <div class="device-progress" v-if="store.maxDevices">
            <div class="device-progress-bar"
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
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.license-summary-card.expired,
.license-summary-card.invalid {
  border-color: color-mix(in srgb, var(--danger) 22%, var(--panel-border));
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
    linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(243, 246, 250, 0.9));
  color: var(--text-muted);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.78),
    0 1px 2px rgba(15, 23, 42, 0.06);
}

.plan-icon.trial {
  color: #b45309;
  background: linear-gradient(180deg, rgba(255, 251, 235, 0.98), rgba(254, 243, 199, 0.9));
  border-color: rgba(217, 119, 6, 0.18);
}

.plan-icon.insider {
  color: #245ea8;
  background: linear-gradient(180deg, rgba(239, 246, 255, 0.98), rgba(219, 234, 254, 0.9));
  border-color: rgba(37, 99, 235, 0.18);
}

.plan-icon.pro {
  color: #1d5f8f;
  background: linear-gradient(180deg, rgba(245, 249, 255, 0.98), rgba(222, 235, 255, 0.92));
  border-color: rgba(59, 130, 246, 0.2);
}

.plan-icon.ultimate {
  color: #8b5a00;
  background: linear-gradient(180deg, rgba(255, 251, 235, 0.98), rgba(254, 240, 198, 0.92));
  border-color: rgba(202, 138, 4, 0.22);
}

.plan-icon.enterprise {
  color: #0f766e;
  background: linear-gradient(180deg, rgba(240, 253, 250, 0.98), rgba(204, 251, 241, 0.9));
  border-color: rgba(13, 148, 136, 0.18);
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

.summary-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
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

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
}

[data-theme='dark'] .status-dot {
  background: #34d399;
}

.summary-status.expired .status-dot,
.summary-status.invalid .status-dot {
  background: var(--danger);
}

.summary-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.summary-action-btn {
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-hover);
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;
}

.summary-action-btn:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--panel);
  color: var(--accent);
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
  border-color: color-mix(in srgb, var(--accent) 30%, var(--panel-border));
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
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
}

.metric-icon.device {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
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
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
  border-radius: 999px;
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

  .metrics-grid {
    grid-template-columns: 1fr;
  }
}
</style>
