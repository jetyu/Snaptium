<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="isOpen" class="about-overlay" @keydown.esc="closeAbout" tabindex="0" ref="overlayRef">
        <div class="about-modal" @click.stop>
          <div class="about-close-btn-wrapper">
            <button @click="closeAbout" class="about-close-btn" :aria-label="t('close')">
              <IconX :size="16" />
            </button>
          </div>

          <div class="about-content">
            <div class="about-header">
              <img src="@assets/logo/app-logo-512.png" alt="Snaptium Logo" class="about-logo" />
              <h1 class="about-title">{{ appName }}</h1>
              <p class="about-version">{{ t('about.version') }}: {{ appVersion }}</p>
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

const { t } = useI18n();
const { isOpen, appVersion, appName, envVersion, closeAbout, loadVersionInfo, initMainProcessListeners } = useAbout();

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
  background-color: var(--bg-primary, #ffffff);
  border-radius: 12px;
  box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  color: #111827;
}

.about-close-btn-wrapper {
  position: absolute;
  top: 15px;
  right: 15px;
  z-index: 2000;
}

.about-close-btn {
  background: transparent;
  border: none;
  border-radius: 4px;
  padding: 4px;
  color: var(--text-secondary, #4b5563);
  cursor: pointer;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.about-close-btn:hover {
  background-color: var(--bg-hover, #f3f4f6);
  color: #111827;
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
  color: #111827;
  letter-spacing: -0.01em;
}

.about-version {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
  font-weight: 400;
}

.about-description {
  text-align: center;
  margin-bottom: 18px;
  padding: 0 10px;
}

.about-description p {
  font-size: 0.875rem;
  line-height: 1.55;
  color: #6b7280;
  margin: 0;
}

.about-env-info {
  background: #fafbfc;
  border: 1px solid #e5e8ec;
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
  border-bottom: 1px solid #eff1f3;
}

.env-label {
  color: #6b7280;
  font-weight: 500;
}

.env-value {
  color: #374151;
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
  border: 1px solid #e5e8ec;
  background: #fafbfc;
}

.badge-label {
  background: #f5f6f7;
  color: #6b7280;
  padding: 5px 9px;
  font-weight: 500;
  border-right: 1px solid #e5e8ec;
}

.badge-value {
  background: #fafbfc;
  color: #374151;
  padding: 5px 11px;
  font-weight: 400;
}

.about-footer {
  text-align: center;
  padding-top: 14px;
  border-top: 1px solid #e5e8ec;
}

.about-footer p {
  font-size: 0.75rem;
  color: var(--text-secondary, #9ca3af);
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
