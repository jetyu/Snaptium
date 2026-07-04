<template>
  <div class="activation-view">
    <div class="activation-header">
      <div class="header-icon-container">
        <IconShieldCheck size="28" class="header-icon" />
      </div>
      <div class="title-group">
        <h2 class="title">{{ t('license.activation.title') }}</h2>
        <p class="description">{{ t('license.activation.description') }}</p>
      </div>
      <div class="header-purchase">
        <a class="header-purchase-link" :href="LICENSE_PURCHASE_URL" target="_blank" rel="noopener noreferrer nofollow">
          <span>{{ t('license.activation.purchase') }}</span>
          <IconLink :size="14" />
        </a>
        <p class="header-purchase-hint">{{ t('license.activation.purchaseHint') }}</p>
      </div>
    </div>

    <div class="comparison-section">
      <p class="comparison-section-title">{{ t('license.activation.compareTitle') }}</p>

      <div class="comparison-grid">
        <article v-for="plan in comparisonPlans" :key="plan.id" class="comparison-card" :class="`plan-${plan.id}`">
          <div class="comparison-heading">
            <span class="comparison-icon-wrapper" aria-hidden="true">
              <component :is="plan.icon" :size="18" :stroke="1.8" />
            </span>
            <h3 class="comparison-title">{{ t(plan.titleKey) }}</h3>
          </div>

          <ul class="comparison-list">
            <li v-for="featureKey in plan.featureKeys" :key="featureKey" class="comparison-feature">
              <IconCircleCheck :size="14" class="comparison-check" />
              <span>{{ t(featureKey) }}</span>
            </li>
          </ul>
        </article>
      </div>
    </div>

    <div class="activation-form">
      <div class="field">
        <span class="field-label">{{ t('license.activation.inputLabel') }}</span>
        <div class="input-container">
          <IconKey :size="16" class="input-key-icon" />
          <input ref="licenseKeyInputRef" v-model="licenseKey" type="text" class="license-key-input"
            :placeholder="t('license.activation.placeholder')" autocomplete="off" :disabled="isBusy"
            @input="handleLicenseKeyInput" @keydown.enter="handleActivate" />
        </div>
      </div>

      <div class="action-row">
        <button type="button" class="action-button activate-btn" :disabled="isBusy || licenseKey.trim().length === 0"
          @click="handleActivate">
          <span v-if="isSubmitting" class="spinner small"></span>
          <span v-else>{{ t('license.activation.button') }}</span>
        </button>
      </div>
    </div>

    <Transition name="fade-slide">
      <p v-if="errorMessage" class="error-banner">{{ errorMessage }}</p>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, type Component } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  IconCircleCheck,
  IconCrown,
  IconKey,
  IconLink,
  IconNotebook,
  IconShieldCheck,
  IconSparkles2,
} from '@tabler/icons-vue';
import {
  licenseService,
  normalizeLicenseErrorMessage,
} from '../services/license.service';

interface ComparisonPlan {
  id: 'free' | 'pro' | 'ultimate';
  titleKey: string;
  icon: Component;
  featureKeys: readonly string[];
}

const { t } = useI18n();
const LICENSE_PURCHASE_URL = 'https://snaptium.com/#pricing';
const comparisonPlans: readonly ComparisonPlan[] = [
  {
    id: 'free',
    titleKey: 'license.activation.compare.free.title',
    icon: IconNotebook,
    featureKeys: [
      'license.activation.compare.free.markdown',
      'license.activation.compare.free.workbench',
      'license.activation.compare.free.history',
      'license.activation.compare.free.security',
      'license.activation.compare.free.backup',
    ],
  },
  {
    id: 'pro',
    titleKey: 'license.activation.compare.pro.title',
    icon: IconSparkles2,
    featureKeys: [
      'license.activation.compare.pro.includesFree',
      'license.activation.compare.pro.aiWriting',
      'license.activation.compare.pro.knowledgeQa',
      'license.activation.compare.pro.encryptedSync',
      'license.activation.compare.pro.deviceLimit',
    ],
  },
  {
    id: 'ultimate',
    titleKey: 'license.activation.compare.ultimate.title',
    icon: IconCrown,
    featureKeys: [
      'license.activation.compare.ultimate.includesPro',
      'license.activation.compare.ultimate.lifetimeLicense',
      'license.activation.compare.ultimate.updates',
      'license.activation.compare.ultimate.support',
      'license.activation.compare.ultimate.deviceLimit',
    ],
  },
] as const;
const licenseKey = ref('');
const licenseKeyInputRef = ref<HTMLInputElement | null>(null);
const isSubmitting = ref(false);
const errorMessage = ref('');
const isBusy = isSubmitting;

async function focusInput(): Promise<void> {
  await nextTick();
  licenseKeyInputRef.value?.focus();
  licenseKeyInputRef.value?.select();
}

defineExpose({
  focusInput,
});

onMounted(() => {
  void focusInput();
});

function handleLicenseKeyInput(): void {
  errorMessage.value = '';
}

async function handleActivate(): Promise<void> {
  if (isSubmitting.value || licenseKey.value.trim().length === 0) {
    return;
  }

  isSubmitting.value = true;
  errorMessage.value = '';
  try {
    await licenseService.activate(licenseKey.value);
    licenseKey.value = '';
  } catch (error) {
    errorMessage.value = normalizeLicenseErrorMessage(error);
    await focusInput();
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<style scoped>
.activation-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.activation-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--surface-raised) 94%, var(--surface-soft)), var(--surface-raised));
  border: 1px solid color-mix(in srgb, var(--panel-border) 86%, transparent);
  border-radius: 14px;
  padding: 18px;
  box-shadow: var(--shadow-soft);
}

.header-icon-container {
  position: relative;
  width: 46px;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--status-info-bg);
  border: 1px solid var(--status-info-border);
  border-radius: 12px;
  color: var(--status-info-text);
  flex-shrink: 0;
}

.header-icon {
  z-index: 1;
}

.title-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.title {
  margin: 0;
  font-size: 1.22rem;
  font-weight: 720;
  color: var(--text-primary);
}

.description {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.88rem;
  line-height: 1.45;
}

.header-purchase {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.header-purchase-link {
  min-width: 80px;
  min-height: 32px;
  padding: 0.4rem 1rem;
  border: 1px solid color-mix(in srgb, var(--accent-solid) 88%, var(--border-strong));
  border-radius: 8px;
  background: var(--accent-solid);
  color: var(--accent-solid-text);
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    transform 0.15s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  text-decoration: none;
  box-shadow: var(--shadow-soft);
}

.header-purchase-hint {
  margin: 0;
  max-width: 210px;
  color: var(--text-tertiary);
  font-size: 0.78rem;
  line-height: 1.35;
  text-align: right;
}

.header-purchase-link:hover {
  background: color-mix(in srgb, var(--accent-solid) 88%, var(--accent-hover));
  border-color: color-mix(in srgb, var(--accent-solid) 78%, var(--accent-hover));
  color: var(--accent-solid-text);
  transform: translateY(-1px);
}

.comparison-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.comparison-section-title {
  margin: 0;
  font-weight: 650;
  color: var(--text-secondary);
  font-size: 0.88rem;
  padding-left: 2px;
}

.comparison-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.comparison-card {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 188px;
  padding: 14px;
  border: 1px solid color-mix(in srgb, var(--panel-border) 86%, transparent);
  background: var(--surface-raised);
  border-radius: 10px;
  box-shadow: var(--shadow-soft);
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    box-shadow 0.15s ease;
}

.comparison-card::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--border-muted);
}

.comparison-card.plan-pro {
  border-color: color-mix(in srgb, var(--license-plan-pro-border) 76%, var(--panel-border));
}

.comparison-card.plan-ultimate {
  border-color: color-mix(in srgb, var(--status-warning-border) 76%, var(--panel-border));
}

.comparison-card.plan-pro::before {
  background: var(--license-plan-pro-fill);
}

.comparison-card.plan-ultimate::before {
  background: var(--status-warning-text);
}

.comparison-card:hover {
  border-color: color-mix(in srgb, var(--border-strong) 72%, var(--panel-border));
  background: color-mix(in srgb, var(--surface-soft) 72%, var(--surface-raised));
  box-shadow: var(--shadow-md);
}

.comparison-heading {
  display: flex;
  align-items: center;
  gap: 8px;
}

.comparison-icon-wrapper {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--surface-subtle);
  color: var(--text-secondary);
  border: 1px solid color-mix(in srgb, var(--panel-border) 80%, transparent);
}

.plan-free .comparison-icon-wrapper {
  background: var(--status-neutral-bg);
  color: var(--status-neutral-text);
}

.plan-pro .comparison-icon-wrapper {
  background: var(--license-plan-pro-bg);
  color: var(--license-plan-pro-text);
}

.plan-ultimate .comparison-icon-wrapper {
  background: var(--status-warning-bg);
  color: var(--status-warning-text);
}

.comparison-title {
  margin: 0;
  min-width: 0;
  color: var(--text-primary);
  font-size: 0.9rem;
  font-weight: 700;
}

.comparison-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.comparison-feature {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
  color: var(--text-secondary);
  font-size: 0.78rem;
  font-weight: 500;
  line-height: 1.35;
}

.comparison-check {
  flex: 0 0 auto;
  margin-top: 1px;
  color: color-mix(in srgb, var(--text-muted) 88%, var(--text));
}

.plan-pro .comparison-check {
  color: var(--license-plan-pro-text);
}

.plan-ultimate .comparison-check {
  color: var(--status-warning-text);
}

.activation-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--surface-raised);
  border: 1px solid color-mix(in srgb, var(--panel-border) 86%, transparent);
  border-radius: 14px;
  padding: 16px;
  box-shadow: var(--shadow-soft);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 0.82rem;
  color: var(--text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0;
}

.input-container {
  position: relative;
  display: flex;
  align-items: center;
}

.input-key-icon {
  position: absolute;
  left: 12px;
  color: var(--text-tertiary);
  pointer-events: none;
  transition: color 0.2s ease;
}

.license-key-input {
  width: 100%;
  height: 40px;
  padding: 0 12px 0 36px;
  border-radius: 8px;
  border: 1px solid var(--input-border);
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 0.9rem;
  font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
  letter-spacing: 0;
  outline: none;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    background-color 0.15s ease;
}

.input-container:focus-within .input-key-icon {
  color: var(--accent);
}

.license-key-input:focus {
  border-color: var(--input-border-focus);
  box-shadow: 0 0 0 3px var(--focus-ring);
  background: var(--input-bg);
}

.action-row {
  display: flex;
  gap: 0;
}

.activate-btn {
  width: 100%;
  min-height: 40px;
  background: var(--accent-solid);
  border-color: color-mix(in srgb, var(--accent-solid) 88%, var(--border-strong));
  color: var(--accent-solid-text);
}

.activate-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent-solid) 88%, var(--accent-hover));
  border-color: color-mix(in srgb, var(--accent-solid) 78%, var(--accent-hover));
  color: var(--accent-solid-text);
}

.error-banner {
  margin: 0;
  color: var(--danger);
  font-size: 0.84rem;
  font-weight: 500;
  border: 1px solid color-mix(in srgb, var(--danger) 20%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--danger) 8%, var(--panel));
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (min-width: 641px) {
  .activation-form {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    gap: 12px;
  }

  .action-row {
    align-items: flex-end;
  }

  .activate-btn {
    width: auto;
    min-width: 128px;
  }
}

@media (max-width: 640px) {
  .activation-header {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .comparison-grid {
    grid-template-columns: 1fr;
  }

  .header-purchase-link {
    width: 100%;
  }

  .header-purchase {
    width: 100%;
    align-items: stretch;
  }

  .header-purchase-hint {
    max-width: none;
    text-align: left;
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
