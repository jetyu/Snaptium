<template>
  <div class="management-view">
    <!-- Premium Membership Hero Card -->
    <div class="membership-card" :class="store.displayStatus">
      <div class="card-top">
        <div class="card-plan">
          <span v-if="planIcon" class="plan-icon" :class="store.plan" aria-hidden="true">
            <component :is="planIcon" :size="24" :stroke="1.8" />
          </span>
          <div class="card-info">
            <span class="card-label">{{ t('license.management.planType') }}</span>
            <h2 class="plan-title">{{ t(`license.badge.${store.plan}`) }}</h2>
          </div>
        </div>
        <div class="card-status-stack">
          <div class="card-status" :class="store.displayStatus">
            <span class="status-dot"></span>
            <span class="status-name">{{ t(store.getStatusTextKey(store.displayStatus)) }}</span>
          </div>
          <span v-if="audienceKey" class="audience-pill">{{ t(audienceKey) }}</span>
        </div>
      </div>

      <div class="card-benefits">
        <div class="card-benefits-title">{{ t('license.management.benefitsTitle') }}</div>
        <div class="benefit-list">
          <div
            v-for="benefitKey in benefitKeys"
            :key="benefitKey"
            class="benefit-chip"
            :title="t(benefitKey)"
          >
            <IconCircleCheck :size="16" class="benefit-icon" />
            <span>{{ t(benefitKey) }}</span>
          </div>
        </div>
      </div>

      <div class="card-bottom">

        <span v-if="!store.canManage && localizedErrorMessage" class="card-error-msg">
          {{ localizedErrorMessage }}
        </span>
      </div>
    </div>

    <!-- Management Toolbar Actions -->
    <div class="management-toolbar">
      <button type="button" class="toolbar-btn" :disabled="isRefreshing || !store.canManage" @click="handleRefresh">
        <IconRefresh :size="14" :class="{ 'animate-spin': isRefreshing }" />
        <span>{{ t('license.management.refresh') }}</span>
      </button>

      <button type="button" class="toolbar-btn" :disabled="isRefreshing || !store.canManage" @click="handleValidate">
        <IconDeviceDesktopCheck :size="14" />
        <span>{{ t('license.management.validate') }}</span>
      </button>


      <button type="button" class="toolbar-btn danger-btn" :disabled="isClearing || !store.canManage"
        @click="handleClear">
        <IconTrash :size="14" />
        <span>{{ t('license.management.clear') }}</span>
      </button>
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
  IconCircleCheck,
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
const COMMON_BENEFIT_KEYS = [
  'license.management.benefits.aiWriting',
  'license.management.benefits.knowledgeQa',
  'license.management.benefits.encryptedSync',
] as const;
const PLAN_BENEFIT_KEYS: Partial<Record<LicensePlan, readonly string[]>> = {
  [LICENSE_PLANS.INSIDER]: [
    ...COMMON_BENEFIT_KEYS,
    'license.management.benefits.insiderDeviceLimit',
  ],
  [LICENSE_PLANS.PRO]: [
    ...COMMON_BENEFIT_KEYS,
    'license.management.benefits.proDeviceLimit',
  ],
  [LICENSE_PLANS.TRIAL]: [
    ...COMMON_BENEFIT_KEYS,
    'license.management.benefits.trialDeviceLimit',
  ],
  [LICENSE_PLANS.ULTIMATE]: [
    ...COMMON_BENEFIT_KEYS,
    'license.management.benefits.ultimateDeviceLimit',
  ],
};
const AUDIENCE_KEYS: Partial<Record<LicensePlan, string>> = {
  [LICENSE_PLANS.INSIDER]: 'license.management.audience.insider',
  [LICENSE_PLANS.PRO]: 'license.management.audience.pro',
  [LICENSE_PLANS.TRIAL]: 'license.management.audience.trial',
  [LICENSE_PLANS.ULTIMATE]: 'license.management.audience.ultimate',
};
const benefitKeys = computed(() => PLAN_BENEFIT_KEYS[store.plan] ?? []);
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

/* Membership Hero Card */
.membership-card {
  position: relative;
  background: var(--panel-hover);
  border: 1px solid var(--panel-border);
  border-left: 4px solid var(--accent);
  border-radius: 12px;
  padding: 20px 24px;
  color: var(--text);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.membership-card.expired,
.membership-card.invalid {
  border-left-color: var(--danger);
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  z-index: 2;
}

.card-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.card-plan {
  display: flex;
  align-items: center;
  gap: 12px;
}

.plan-icon {
  width: 42px;
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: 10px;
  border: 1px solid var(--panel-border);
  background: var(--panel);
  color: var(--accent);
}

.plan-icon.trial {
  color: #d97706;
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.26);
}

.plan-icon.insider {
  color: #0f4b8a;
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.24);
}

.plan-icon.pro {
  color: #2f6b0f;
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.24);
}

.plan-icon.ultimate {
  color: #9d174d;
  background: rgba(236, 72, 153, 0.1);
  border-color: rgba(236, 72, 153, 0.24);
}

.plan-icon.enterprise {
  color: #155e75;
  background: rgba(6, 182, 212, 0.1);
  border-color: rgba(6, 182, 212, 0.24);
}

.card-label {
  font-size: 0.74rem;
  color: var(--text-muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.plan-title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 750;
  color: var(--text);
  letter-spacing: -0.01em;
}

.card-status-stack {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.card-status {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
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

.card-status.expired .status-dot,
.card-status.invalid .status-dot {
  background: var(--danger);
}

.audience-pill {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  border: 1px solid color-mix(in srgb, var(--accent) 22%, var(--panel-border));
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 7%, var(--panel));
  color: var(--accent);
  padding: 3px 10px;
  font-size: 0.74rem;
  font-weight: 650;
  white-space: nowrap;
}

.card-benefits {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 18px;
  z-index: 2;
}

.card-benefits-title {
  color: var(--text-muted);
  font-size: 0.78rem;
  font-weight: 650;
}

.benefit-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.benefit-chip {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
  min-height: 34px;
  border: 1px solid color-mix(in srgb, var(--accent) 18%, var(--panel-border));
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent) 6%, var(--panel));
  color: var(--text);
  padding: 7px 10px;
  font-size: 0.82rem;
  font-weight: 600;
}

.benefit-chip span {
  min-width: 0;
  line-height: 1.35;
}

.benefit-icon {
  flex: 0 0 auto;
  color: var(--accent);
  margin-top: 1px;
}

.card-bottom {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-top: 12px;
  z-index: 2;
}

.card-serial {
  font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace;
  font-size: 0.84rem;
  color: var(--text-muted);
  letter-spacing: 0.08em;
}

.card-error-msg {
  font-size: 0.8rem;
  color: var(--danger);
  font-weight: 500;
  background: color-mix(in srgb, var(--danger) 8%, var(--panel));
  border: 1px solid color-mix(in srgb, var(--danger) 15%, var(--panel-border));
  padding: 4px 10px;
  border-radius: 6px;
}

/* Management Toolbar */
.management-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--panel-hover);
  border: 1px solid var(--panel-border);
  border-radius: 12px;
  padding: 8px;
}

.toolbar-btn {
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid var(--panel-border);
  background: var(--panel);
  color: var(--text);
  font-size: 0.8rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;
}

.toolbar-btn:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--panel-hover);
  color: var(--accent);
}

.toolbar-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toolbar-divider {
  width: 1px;
  height: 18px;
  background: var(--panel-border);
  margin: 0 4px;
}

.danger-btn {
  border-color: color-mix(in srgb, var(--danger) 30%, var(--panel-border));
  background: color-mix(in srgb, var(--danger) 8%, var(--panel));
  color: var(--danger);
  margin-left: auto;
}

.danger-btn:hover:not(:disabled) {
  border-color: var(--danger);
  background: color-mix(in srgb, var(--danger) 15%, var(--panel));
  color: var(--danger);
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
  .metrics-grid {
    grid-template-columns: 1fr;
  }

  .benefit-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .management-toolbar {
    flex-wrap: wrap;
  }
}
</style>
