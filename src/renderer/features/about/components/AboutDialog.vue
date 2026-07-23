<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="isOpen" class="about-overlay" @keydown.esc="closeAbout" tabindex="0" ref="overlayRef">
        <div ref="dialogRef" class="about-modal" :style="dialogStyle" @click.stop>
          <div class="about-close-btn-wrapper">
            <button @click="closeAbout" class="about-close-btn dialog-close-button" :aria-label="t('button.close')">
              <IconX :size="16" />
            </button>
          </div>

          <div class="about-content">
            <header ref="dragHandleRef" class="about-hero dialog-drag-handle" @pointerdown="onDragHandlePointerDown">
              <img src="@assets/logo/app-logo-512.png" :alt="appName" class="about-logo" />

              <div class="about-identity">
                <h1 class="about-title">{{ appName }}</h1>
                <p class="about-description">{{ t('about.description') }}</p>

                <div class="about-meta-row">
                  <span class="version-chip">
                    <span class="version-chip__label">{{ t('about.version') }}</span>
                    <span class="version-chip__value">{{ appVersion }}</span>
                  </span>

                  <button v-if="isMicrosoftStoreDistribution" type="button" class="store-badge"
                    :aria-label="t('about.microsoftStore')" @click="openStorePage">
                    <img src="@assets/logo/store_logo.svg" alt="" aria-hidden="true" class="store-badge__logo" />
                    <span>{{ t('about.microsoftStore') }}</span>
                  </button>

                  <button type="button" class="website-link" @click="openWebsite">
                    <span>{{ t('menu.help.website') }}</span>
                    <IconExternalLink :size="14" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </header>

            <details class="technical-details">
              <summary class="technical-summary">
                <span>{{ t('noteProperties.technicalInfo') }}</span>
                <IconChevronRight class="technical-chevron" :size="16" aria-hidden="true" />
              </summary>

              <dl class="runtime-grid">
                <div class="runtime-item">
                  <dt>{{ t('about.electron') }}</dt>
                  <dd>{{ envVersion.electron }}</dd>
                </div>
                <div class="runtime-item">
                  <dt>{{ t('about.nodejs') }}</dt>
                  <dd>{{ envVersion.node }}</dd>
                </div>
                <div class="runtime-item">
                  <dt>{{ t('about.chromium') }}</dt>
                  <dd>{{ envVersion.chrome }}</dd>
                </div>
                <div class="runtime-item">
                  <dt>{{ t('about.v8') }}</dt>
                  <dd>{{ envVersion.v8 }}</dd>
                </div>
              </dl>

              <div class="diagnostic-actions">
                <button type="button" class="copy-diagnostic-button" :class="{ 'is-copied': isDiagnosticCopied }"
                  @click="handleCopyDiagnosticInfo">
                  <IconCheck v-if="isDiagnosticCopied" :size="14" aria-hidden="true" />
                  <IconCopy v-else :size="14" aria-hidden="true" />
                  <span>{{ isDiagnosticCopied ? t('preview.codeCopied') : t('noteProperties.copyInfo') }}</span>
                </button>
              </div>
            </details>

            <footer class="about-footer">
              <div class="about-footer-meta">
                <span>
                  <span class="footer-meta-label">{{ t('about.author') }}</span>
                  Snaptium Team
                </span>
                <span class="footer-meta-divider" aria-hidden="true">•</span>
                <span>
                  <span class="footer-meta-label">{{ t('about.license') }}</span>
                  Apache 2.0
                </span>
              </div>
              <p>{{ t('about.copyrights') }}</p>
            </footer>
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
import {
  IconCheck,
  IconChevronRight,
  IconCopy,
  IconExternalLink,
  IconX,
} from '@tabler/icons-vue';
import { electronApi } from '@renderer/core/bridge/electronApi';
import { useDraggableDialog } from '@renderer/core/composables/useDraggableDialog';

const { t } = useI18n();
const {
  isOpen,
  appVersion,
  appName,
  envVersion,
  isMicrosoftStoreDistribution,
  closeAbout,
  loadVersionInfo,
  copyDiagnosticInfo,
  initMainProcessListeners,
} = useAbout();

const overlayRef = ref<HTMLElement | null>(null);
const dialogRef = ref<HTMLElement | null>(null);
const dragHandleRef = ref<HTMLElement | null>(null);
const isDiagnosticCopied = ref(false);
let removeListener: (() => void) | null = null;
let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null;
const { dialogStyle, onDragHandlePointerDown } = useDraggableDialog({
  isOpen,
  overlayRef,
  dialogRef,
  handleRef: dragHandleRef,
});

watch(isOpen, async (newVal) => {
  if (!newVal) {
    resetCopyFeedback();
    return;
  }

  await loadVersionInfo();
  await nextTick();
  overlayRef.value?.focus();
});

onMounted(() => {
  removeListener = initMainProcessListeners();
});

onUnmounted(() => {
  if (removeListener) {
    removeListener();
  }
  clearCopyFeedbackTimer();
});

const openStorePage = async (): Promise<void> => {
  await electronApi.app.openStorePage();
};

function openWebsite(): void {
  window.open('https://snaptium.com');
}

async function handleCopyDiagnosticInfo(): Promise<void> {
  if (!(await copyDiagnosticInfo())) {
    return;
  }

  isDiagnosticCopied.value = true;
  clearCopyFeedbackTimer();
  copyFeedbackTimer = setTimeout(() => {
    isDiagnosticCopied.value = false;
    copyFeedbackTimer = null;
  }, 2000);
}

function resetCopyFeedback(): void {
  isDiagnosticCopied.value = false;
  clearCopyFeedbackTimer();
}

function clearCopyFeedbackTimer(): void {
  if (!copyFeedbackTimer) {
    return;
  }

  clearTimeout(copyFeedbackTimer);
  copyFeedbackTimer = null;
}
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
  width: min(520px, calc(100vw - 32px));
  background-color: var(--surface-raised);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  color: var(--text-primary);
}

.about-close-btn-wrapper {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 2000;
}

.about-close-btn {
  color: var(--text-secondary);
}

.about-content {
  padding: 28px;
}

.about-hero {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 18px;
  padding: 2px 36px 22px 2px;
  border-bottom: 1px solid var(--border-muted);
}

.about-logo {
  display: block;
  width: 72px;
  height: 72px;
  filter: drop-shadow(0 7px 12px color-mix(in srgb, var(--accent) 16%, transparent));
}

.about-identity {
  min-width: 0;
}

.about-title {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.55rem;
  font-weight: 650;
  letter-spacing: -0.025em;
  line-height: 1.2;
}

.about-description {
  margin: 7px 0 14px;
  color: var(--text-secondary);
  font-size: 0.835rem;
  line-height: 1.55;
}

.about-meta-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
}

.version-chip,
.store-badge,
.website-link {
  min-height: 28px;
  border-radius: 999px;
  font-size: 0.75rem;
  line-height: 1;
}

.version-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 10px;
  border: 1px solid var(--border-muted);
  background: var(--surface-subtle);
}

.version-chip__label {
  color: var(--text-tertiary);
}

.version-chip__value {
  color: var(--text-primary);
  font-weight: 600;
}

.store-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 10px;
  border: 1px solid var(--status-info-border);
  background: var(--status-info-bg);
  color: var(--status-info-text);
  font-weight: 600;
  cursor: pointer;
  appearance: none;
  outline: none;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.store-badge:hover {
  border-color: color-mix(in srgb, var(--accent) 36%, var(--status-info-border));
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.store-badge__logo {
  display: block;
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
}

.website-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  font-weight: 500;
  cursor: pointer;
  appearance: none;
  outline: none;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.website-link:hover {
  background: var(--surface-hover);
  color: var(--accent-hover);
}

.store-badge:focus-visible,
.website-link:focus-visible,
.technical-summary:focus-visible,
.copy-diagnostic-button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.technical-details {
  margin-top: 18px;
  background: var(--surface-subtle);
  border: 1px solid var(--border-muted);
  border-radius: 10px;
  overflow: hidden;
}

.technical-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 42px;
  padding: 0 14px;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  list-style: none;
  user-select: none;
}

.technical-summary::-webkit-details-marker {
  display: none;
}

.technical-details[open] .technical-summary {
  border-bottom: 1px solid var(--border-muted);
}

.technical-chevron {
  flex: 0 0 auto;
  color: var(--text-tertiary);
  transition: transform 0.16s ease;
}

.technical-details[open] .technical-chevron {
  transform: rotate(90deg);
}

.runtime-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
  padding: 12px;
}

.runtime-item {
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid var(--border-muted);
  border-radius: 8px;
  background: var(--surface-raised);
}

.runtime-item dt {
  margin: 0 0 5px;
  color: var(--text-tertiary);
  font-size: 0.72rem;
  font-weight: 500;
}

.runtime-item dd {
  margin: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-family: ui-monospace, 'SF Mono', 'Cascadia Code', 'Segoe UI Mono', Consolas, monospace;
  font-size: 0.775rem;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.diagnostic-actions {
  display: flex;
  justify-content: flex-end;
  padding: 0 12px 12px;
}

.copy-diagnostic-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 28px;
  padding: 0 9px;
  border: 1px solid var(--border-muted);
  border-radius: 7px;
  background: var(--surface-raised);
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  appearance: none;
  outline: none;
  transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;
}

.copy-diagnostic-button:hover {
  border-color: color-mix(in srgb, var(--accent) 28%, var(--border-muted));
  background: var(--surface-hover);
  color: var(--accent-hover);
}

.copy-diagnostic-button.is-copied {
  border-color: var(--status-success-border);
  background: var(--status-success-bg);
  color: var(--status-success-text);
}

.about-footer {
  text-align: center;
  margin-top: 18px;
  padding-top: 15px;
  border-top: 1px solid var(--border-muted);
}

.about-footer-meta {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 7px;
  color: var(--text-secondary);
  font-size: 0.775rem;
}

.footer-meta-label {
  margin-right: 4px;
  color: var(--text-tertiary);
}

.footer-meta-divider {
  color: var(--border-strong);
}

.about-footer p {
  margin: 7px 0 0;
  color: var(--text-tertiary);
  font-size: 0.7rem;
  line-height: 1.4;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 560px) {
  .about-content {
    padding: 24px;
  }

  .about-hero {
    grid-template-columns: 1fr;
    justify-items: center;
    padding: 0 28px 20px;
    text-align: center;
  }

  .about-meta-row {
    justify-content: center;
  }

  .runtime-grid {
    grid-template-columns: 1fr;
  }
}
</style>
