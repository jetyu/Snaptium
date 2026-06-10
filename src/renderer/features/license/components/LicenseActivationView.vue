<template>
  <div class="activation-view">
    <div class="activation-header">
      <div class="header-icon-container">
        <div class="icon-glow-ring"></div>
        <Key theme="filled" size="28" class="header-icon" />
      </div>
      <div class="title-group">
        <h2 class="title">{{ t('license.activation.title') }}</h2>
        <p class="description">{{ t('license.activation.description') }}</p>
      </div>
    </div>

    <div class="feature-section">
      <p class="feature-title">{{ t('license.activation.featuresTitle') }}</p>
      
      <div class="feature-grid">
        <div class="feature-card src-card">
          <div class="feature-icon-wrapper">
            <Cpu theme="outline" size="18" />
          </div>
          <span class="feature-name">{{ t('license.feature.aiSources') }}</span>
        </div>

        <div class="feature-card assistant-card">
          <div class="feature-icon-wrapper">
            <Edit theme="outline" size="18" />
          </div>
          <span class="feature-name">{{ t('license.feature.aiAssistant') }}</span>
        </div>

        <div class="feature-card rag-card">
          <div class="feature-icon-wrapper">
            <Brain theme="outline" size="18" />
          </div>
          <span class="feature-name">{{ t('license.feature.rag') }}</span>
        </div>

        <div class="feature-card sync-card">
          <div class="feature-icon-wrapper">
            <DatabaseSync theme="outline" size="18" />
          </div>
          <span class="feature-name">{{ t('license.feature.sync') }}</span>
        </div>
      </div>
    </div>

    <div class="activation-form">
      <div class="field">
        <span class="field-label">{{ t('license.activation.inputLabel') }}</span>
        <div class="input-container">
          <Key theme="outline" size="16" class="input-key-icon" />
          <input
            ref="licenseKeyInputRef"
            v-model="licenseKey"
            type="text"
            class="license-key-input"
            :placeholder="t('license.activation.placeholder')"
            autocomplete="off"
            @keydown.enter="handleActivate"
          />
        </div>
      </div>

      <div class="action-row">
        <button
          type="button"
          class="action-button primary-btn activate-btn"
          :disabled="isSubmitting || licenseKey.trim().length === 0"
          @click="handleActivate"
        >
          <span v-if="isSubmitting" class="spinner small"></span>
          <span v-else>{{ t('license.activation.button') }}</span>
        </button>
        <a
          class="action-button secondary-btn buy-btn"
          :href="LICENSE_PURCHASE_URL"
          target="_blank"
          rel="noopener noreferrer nofollow"
        >
          <span>{{ t('license.activation.purchase') }}</span>
          <LinkOne theme="outline" size="14" />
        </a>
      </div>
    </div>

    <Transition name="fade-slide">
      <p v-if="errorMessage" class="error-banner">{{ errorMessage }}</p>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Key, Cpu, Edit, Brain, DatabaseSync, LinkOne } from '@icon-park/vue-next';
import { licenseService, normalizeLicenseErrorMessage } from '../services/license.service';

const { t } = useI18n();
const LICENSE_PURCHASE_URL = 'https://snaptium.com';
const licenseKey = ref('');
const licenseKeyInputRef = ref<HTMLInputElement | null>(null);
const isSubmitting = ref(false);
const errorMessage = ref('');

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
  gap: 20px;
}

.activation-header {
  display: flex;
  align-items: center;
  gap: 16px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 8%, var(--panel)), var(--panel));
  border: 1px solid var(--panel-border);
  border-radius: 12px;
  padding: 16px;
}

.header-icon-container {
  position: relative;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--accent) 15%, var(--panel));
  border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--panel-border));
  border-radius: 12px;
  color: var(--accent);
  flex-shrink: 0;
}

.icon-glow-ring {
  position: absolute;
  inset: -4px;
  border-radius: 16px;
  background: var(--accent);
  opacity: 0.12;
  filter: blur(4px);
}

.header-icon {
  z-index: 2;
  filter: drop-shadow(0 2px 4px rgba(var(--accent-hover), 0.2));
}

.title-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text);
}

.description {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.88rem;
  line-height: 1.4;
}

.feature-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.feature-title {
  margin: 0;
  font-weight: 650;
  color: var(--text);
  font-size: 0.88rem;
  padding-left: 2px;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.feature-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--panel-border);
  background: var(--panel);
  border-radius: 10px;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.feature-card:hover {
  border-color: var(--accent);
}

.feature-icon-wrapper {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* Individual Icon Colors */
.src-card .feature-icon-wrapper {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}
.assistant-card .feature-icon-wrapper {
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
}
.rag-card .feature-icon-wrapper {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}
.sync-card .feature-icon-wrapper {
  background: rgba(236, 72, 153, 0.1);
  color: #ec4899;
}

.feature-name {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text);
}

.activation-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: var(--panel-hover);
  border: 1px solid var(--panel-border);
  border-radius: 12px;
  padding: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 0.82rem;
  color: var(--text-muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.input-container {
  position: relative;
  display: flex;
  align-items: center;
}

.input-key-icon {
  position: absolute;
  left: 12px;
  color: var(--text-muted);
  pointer-events: none;
  transition: color 0.2s ease;
}

.license-key-input {
  width: 100%;
  height: 38px;
  padding: 0 12px 0 36px;
  border-radius: 8px;
  border: 1px solid var(--panel-border);
  background: var(--panel);
  color: var(--text);
  font-size: 0.9rem;
  font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
  letter-spacing: 0.02em;
  outline: none;
  transition: all 0.2s ease;
}

.input-container:focus-within .input-key-icon {
  color: var(--accent);
}

.license-key-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent);
  background: var(--panel);
}

.action-row {
  display: flex;
  gap: 10px;
}

.action-button {
  flex: 1;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 8px;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;
  text-decoration: none;
  border: 1px solid transparent;
}

.primary-btn {
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%);
  color: #ffffff;
}

.primary-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--accent-hover) 0%, var(--accent) 100%);
}

.primary-btn:active:not(:disabled) {
  opacity: 0.9;
}

.primary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.secondary-btn {
  background: var(--panel);
  border-color: var(--panel-border);
  color: var(--text);
}

.secondary-btn:hover {
  background: var(--panel-hover);
  border-color: var(--accent);
  color: var(--accent);
}

.secondary-btn:active {
  opacity: 0.9;
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

@media (max-width: 640px) {
  .feature-grid {
    grid-template-columns: 1fr;
  }
  
  .action-row {
    flex-direction: column;
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
