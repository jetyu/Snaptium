<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="isOpen" class="about-overlay" @keydown.esc="closeAbout" tabindex="0" ref="overlayRef">
        <div class="about-modal" @click.stop>
          <div class="about-close-btn-wrapper">
            <button @click="closeAbout" class="about-close-btn dialog-close-button" :aria-label="t('close')">
              <IconX :size="16" />
            </button>
          </div>

          <div class="about-content">
            <div class="about-header">
              <img src="@assets/logo/app-logo-512.png" alt="Snaptium Logo" class="about-logo" />
              <h1 class="about-title">{{ appName }}</h1>
              <p class="about-version">{{ t('about.version') }}: {{ appVersion }}</p>
              <button
                v-if="isMicrosoftStoreDistribution"
                type="button"
                class="store-badge"
                :aria-label="t('about.microsoftStore')"
                @click="openStorePage"
              >
                <img
                  src="@assets/logo/store_logo.svg"
                  alt=""
                  aria-hidden="true"
                  class="store-badge__logo"
                />
                <span>{{ t('about.microsoftStore') }}</span>
              </button>
            </div>

            <div class="about-description">
              <p>{{ t('about.description') }}</p>
            </div>

            <div class="about-env-info">
              <div class="env-item">
                <span class="env-label">{{ t('about.electron') }}:</span>
                <span class="env-value">{{ envVersion.electron }}</span>
              </div>
              <div class="env-item">
                <span class="env-label">{{ t('about.nodejs') }}:</span>
                <span class="env-value">{{ envVersion.node }}</span>
              </div>
              <div class="env-item">
                <span class="env-label">{{ t('about.chromium') }}:</span>
                <span class="env-value">{{ envVersion.chrome }}</span>
              </div>
              <div class="env-item">
                <span class="env-label">{{ t('about.v8') }}:</span>
                <span class="env-value">{{ envVersion.v8 }}</span>
              </div>
            </div>

            <div class="about-info">
              <div class="info-badge">
                <span class="badge-label">{{ t('about.author') }}</span>
                <span class="badge-value">Jet</span>
              </div>
              <div class="info-badge">
                <span class="badge-label">{{ t('about.license') }}</span>
                <span class="badge-value">Apache 2.0</span>
              </div>
            </div>

            <div class="about-footer">
              <p>{{ t('about.copyrights') }}</p>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAbout } from '../composables/useAbout';
import { IconX } from '@tabler/icons-vue';
import { electronApi } from '@renderer/core/bridge/electronApi';

const { t } = useI18n();
const {
  isOpen,
  appVersion,
  appName,
  envVersion,
  isMicrosoftStoreDistribution,
  closeAbout,
  loadVersionInfo,
  initMainProcessListeners,
} = useAbout();

const overlayRef = ref<HTMLElement | null>(null);
let removeListener: (() => void) | null = null;

watch(isOpen, async (newVal) => {
  if (newVal) {
    await loadVersionInfo();
    await nextTick();
    if (overlayRef.value) {
      overlayRef.value.focus();
    }
  }
});

onMounted(() => {
  removeListener = initMainProcessListeners();
});

onUnmounted(() => {
  if (removeListener) {
    removeListener();
  }
});

const openStorePage = async (): Promise<void> => {
  await electronApi.app.openStorePage();
};
</script>

<style scoped>
.about-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: var(--dialog-overlay-bg);
  backdrop-filter: var(--dialog-overlay-backdrop-filter);
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
}

.about-modal {
  position: relative;
  width: 500px;
  background-color: var(--surface-raised);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  color: var(--text-primary);
}

.about-close-btn-wrapper {
  position: absolute;
  top: 15px;
  right: 15px;
  z-index: 2000;
}

.about-close-btn {
  color: var(--text-secondary);
}

.icon-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.about-content {
  padding: 32px 36px 24px;
}

.about-header {
  text-align: center;
  margin-bottom: 18px;
}

.about-logo {
  width: 76px;
  height: 76px;
  margin-bottom: 12px;
}

.about-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 6px 0;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.about-version {
  font-size: 0.875rem;
  color: var(--text-tertiary);
  margin: 0;
  font-weight: 400;
}

.store-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.55rem;
  padding: 0.3rem 0.55rem;
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  background: var(--surface-raised);
  color: var(--text-primary);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  appearance: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

.store-badge:hover {
  border-color: var(--input-border-focus);
}

.store-badge:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.store-badge:active {
  transform: translateY(1px);
}

.store-badge__logo {
  display: block;
  width: 0.96rem;
  height: 0.96rem;
  flex: 0 0 auto;
}

.about-description {
  text-align: center;
  margin-bottom: 18px;
  padding: 0 10px;
}

.about-description p {
  font-size: 0.875rem;
  line-height: 1.55;
  color: var(--text-secondary);
  margin: 0;
}

.about-env-info {
  background: var(--surface-subtle);
  border: 1px solid var(--border-muted);
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 14px;
}

.env-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 0.8125rem;
}

.env-item:not(:last-child) {
  border-bottom: 1px solid var(--border-muted);
}

.env-label {
  color: var(--text-tertiary);
  font-weight: 500;
}

.env-value {
  color: var(--text-primary);
  font-family: ui-monospace, 'SF Mono', 'Cascadia Code', 'Segoe UI Mono', Consolas, monospace;
  font-size: 0.8125rem;
  font-weight: 400;
}

.about-info {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.info-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 5px;
  overflow: hidden;
  font-size: 0.75rem;
  border: 1px solid var(--border-muted);
  background: var(--surface-subtle);
}

.badge-label {
  background: var(--surface-soft);
  color: var(--text-tertiary);
  padding: 5px 9px;
  font-weight: 500;
  border-right: 1px solid var(--border-muted);
}

.badge-value {
  background: var(--surface-subtle);
  color: var(--text-primary);
  padding: 5px 11px;
  font-weight: 400;
}

.about-footer {
  text-align: center;
  padding-top: 14px;
  border-top: 1px solid var(--border-muted);
}

.about-footer p {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.4;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
