<template>
  <button type="button" class="license-badge" :class="[store.plan, toneClass]" @click="openLicenseDialog">
    <component :is="planIcon" v-if="planIcon" :size="12" class="badge-icon" />
    <span class="label">{{ t(`license.badge.${store.plan}`) }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue';
import { useI18n } from 'vue-i18n';
import { IconBuilding, IconCrown, IconSparkle2, IconSparkles2, IconTimeDuration0 } from '@tabler/icons-vue';
import { LICENSE_PLANS, type LicensePlan } from '@shared/license.constants';
import { useLicenseStore } from '../store/license.store';
import { useLicenseDialog } from '../composables/useLicenseDialog';

const { t } = useI18n();
const store = useLicenseStore();
const { openLicenseDialog } = useLicenseDialog();

const PLAN_ICONS: Partial<Record<LicensePlan, Component>> = {
  [LICENSE_PLANS.TRIAL]: IconTimeDuration0,
  [LICENSE_PLANS.INSIDER]: IconSparkle2,
  [LICENSE_PLANS.PRO]: IconSparkles2,
  [LICENSE_PLANS.ULTIMATE]: IconCrown,
  [LICENSE_PLANS.ENTERPRISE]: IconBuilding,
};

const planIcon = computed(() => PLAN_ICONS[store.plan] ?? null);

const toneClass = computed(() => {
  if (store.displayStatus === 'expired' || store.displayStatus === 'invalid') {
    return 'is-expired';
  }

  return 'is-normal';
});
</script>

<style scoped>
.license-badge {
  -webkit-app-region: no-drag;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid var(--panel-border);
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  background: var(--panel-hover);
  color: var(--text-muted);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  outline: none;
}

.license-badge:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}



.badge-icon {
  flex-shrink: 0;
  display: block;
}

/* Free Plan */
.license-badge.free {
  border-color: var(--panel-border);
  background: var(--panel-hover);
  color: #6b7280;
}

.license-badge.free:hover {
  border-color: rgba(107, 114, 128, 0.28);
  background: rgba(107, 114, 128, 0.08);
  color: #4b5563;
}

/* Insider Plan */
.license-badge.insider {
  background: rgba(59, 130, 246, 0.08);
  border-color: rgba(59, 130, 246, 0.25);
  color: #3b82f6;
}

[data-theme='dark'] .license-badge.insider {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.35);
  color: #60a5fa;
}

/* Pro Plan */
.license-badge.pro {
  background: rgba(37, 99, 235, 0.08);
  border-color: rgba(37, 99, 235, 0.25);
  color: #245ea8;
}

[data-theme='dark'] .license-badge.pro {
  background: rgba(37, 99, 235, 0.16);
  border-color: rgba(96, 165, 250, 0.35);
  color: #7db5ff;
}

.license-badge.pro:hover {
  border-color: rgba(37, 99, 235, 0.35);
  background: rgba(37, 99, 235, 0.12);
  color: #1d4f91;
}

/* Trial Plan */
.license-badge.trial {
  background: rgba(245, 158, 11, 0.08);
  border-color: rgba(245, 158, 11, 0.25);
  color: #f59e0b;
}

[data-theme='dark'] .license-badge.trial {
  background: rgba(245, 158, 11, 0.15);
  border-color: rgba(245, 158, 11, 0.35);
  color: #fbbf24;
}

/* Ultimate Plan */
.license-badge.ultimate {
  background: rgba(202, 138, 4, 0.1);
  border-color: rgba(202, 138, 4, 0.25);
  color: #8b5a00;
}

[data-theme='dark'] .license-badge.ultimate {
  background: rgba(202, 138, 4, 0.16);
  border-color: rgba(245, 158, 11, 0.35);
  color: #f5c96b;
}

.license-badge.ultimate:hover {
  border-color: rgba(202, 138, 4, 0.36);
  background: rgba(202, 138, 4, 0.14);
  color: #7a5200;
}

/* Enterprise Plan */
.license-badge.enterprise {
  background: rgba(6, 182, 212, 0.08);
  border-color: rgba(6, 182, 212, 0.25);
  color: #06b6d4;
}

[data-theme='dark'] .license-badge.enterprise {
  background: rgba(6, 182, 212, 0.15);
  border-color: rgba(6, 182, 212, 0.35);
  color: #22d3ee;
}

/* Expired States */
.license-badge.is-expired {
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.25);
  color: #ef4849;
}

[data-theme='dark'] .license-badge.is-expired {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.35);
  color: #f87171;
}
</style>
