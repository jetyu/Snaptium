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
  box-shadow: var(--shadow-soft);
}



.badge-icon {
  flex-shrink: 0;
  display: block;
}

/* Free Plan */
.license-badge.free {
  border-color: var(--panel-border);
  background: var(--panel-hover);
  color: var(--status-neutral-text);
}

.license-badge.free:hover {
  border-color: var(--status-neutral-border);
  background: var(--status-neutral-bg);
  color: var(--status-neutral-text);
}

/* Insider Plan */
.license-badge.insider {
  background: var(--status-success-bg);
  border-color: var(--status-success-border);
  color: var(--status-success-text);
}

.license-badge.insider:hover {
  border-color: color-mix(in srgb, var(--status-success-border) 100%, var(--border-strong));
  background: color-mix(in srgb, var(--status-success-bg) 88%, var(--surface-raised));
  color: var(--status-success-text);
}

/* Pro Plan */
.license-badge.pro {
  background: var(--status-info-bg);
  border-color: var(--status-info-border);
  color: var(--status-info-text);
}

.license-badge.pro:hover {
  border-color: color-mix(in srgb, var(--status-info-border) 100%, var(--border-strong));
  background: color-mix(in srgb, var(--status-info-bg) 88%, var(--surface-raised));
  color: var(--status-info-text);
}

/* Trial Plan */
.license-badge.trial {
  background: var(--status-info-bg);
  border-color: var(--status-info-border);
  color: var(--status-info-text);
}

.license-badge.trial:hover {
  border-color: color-mix(in srgb, var(--status-info-border) 100%, var(--border-strong));
  background: color-mix(in srgb, var(--status-info-bg) 88%, var(--surface-raised));
  color: var(--status-info-text);
}

/* Ultimate Plan */
.license-badge.ultimate {
  background: var(--status-warning-bg);
  border-color: var(--status-warning-border);
  color: var(--status-warning-text);
}

.license-badge.ultimate:hover {
  border-color: color-mix(in srgb, var(--status-warning-border) 100%, var(--border-strong));
  background: color-mix(in srgb, var(--status-warning-bg) 88%, var(--surface-raised));
  color: var(--status-warning-text);
}

/* Enterprise Plan */
.license-badge.enterprise {
  background: var(--status-success-bg);
  border-color: var(--status-success-border);
  color: var(--status-success-text);
}

/* Expired States */
.license-badge.is-expired {
  background: var(--status-danger-bg);
  border-color: var(--status-danger-border);
  color: var(--status-danger-text);
}
</style>
