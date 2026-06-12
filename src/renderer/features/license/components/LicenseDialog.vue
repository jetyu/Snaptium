<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="isVisible"
        ref="overlayRef"
        class="license-overlay"
        tabindex="0"
        @keydown.esc="closeLicenseDialog"
      >
        <div class="license-modal" @click.stop>
          <div class="license-modal-header">
            <button type="button" class="license-close-btn dialog-close-button" :aria-label="t('button.close')" @click="closeLicenseDialog">
              <IconX :size="18" />
            </button>
          </div>

          <div class="license-content">
            <LicenseManagementView v-if="panelMode === 'management'" />
            <LicenseActivationView v-else ref="activationViewRef" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { IconX } from '@tabler/icons-vue';
import { useLicenseStore } from '../store/license.store';
import { licenseService } from '../services/license.service';
import { useLicenseDialog } from '../composables/useLicenseDialog';
import LicenseActivationView from './LicenseActivationView.vue';
import LicenseManagementView from './LicenseManagementView.vue';

type LicensePanelMode = 'management' | 'activation';
type LicenseActivationViewInstance = InstanceType<typeof LicenseActivationView>;

const { t } = useI18n();
const store = useLicenseStore();
const { isVisible, closeLicenseDialog } = useLicenseDialog();
const overlayRef = ref<HTMLElement | null>(null);
const activationViewRef = ref<LicenseActivationViewInstance | null>(null);
const panelMode = ref<LicensePanelMode>('activation');

async function focusActivationInput(): Promise<void> {
  await nextTick();
  await activationViewRef.value?.focusInput();
}

watch(isVisible, async (visible) => {
  if (!visible) {
    return;
  }

  panelMode.value = store.canManage ? 'management' : 'activation';
  await nextTick();
  overlayRef.value?.focus();
  if (store.canManage) {
    await licenseService.refreshDevices().catch(() => undefined);
    return;
  }

  await focusActivationInput();
});

watch(
  () => store.canManage,
  async (canManage) => {
    if (!isVisible.value) {
      return;
    }
    if (canManage) {
      panelMode.value = 'management';
      return;
    }

    panelMode.value = 'activation';
    await focusActivationInput();
  },
);
</script>

<style scoped>
.license-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--dialog-overlay-bg);
  backdrop-filter: var(--dialog-overlay-backdrop-filter);
  outline: none;
}

.license-modal {
  width: min(680px, calc(100vw - 32px));
  max-height: calc(100vh - 40px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: 16px;
  box-shadow: 
    0 10px 25px -5px rgba(0, 0, 0, 0.1),
    0 25px 50px -12px rgba(0, 0, 0, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  position: relative;
}

.license-modal-header {
  display: flex;
  justify-content: flex-end;
  padding: 14px 14px 0 14px;
  z-index: 15;
}

.license-close-btn :deep(svg) {
  display: block;
}

.license-content {
  padding: 8px 24px 24px 24px;
  overflow-y: auto;
  flex: 1;
}



:deep(.license-btn) {
  min-width: 120px;
  min-height: 36px;
  height: 36px;
  border-radius: 8px;
  padding: 0 16px;
  font-size: 0.88rem;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid var(--panel-border);
  background: var(--panel);
  color: var(--text);
  cursor: pointer;
  transition: all 0.15s ease;
}

:deep(.license-btn:hover:not(:disabled)) {
  background: var(--panel-hover);
  border-color: var(--accent);
  color: var(--accent);
}

:deep(.license-btn:active:not(:disabled)) {
  transform: scale(0.98);
}

:deep(.license-btn:disabled) {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .license-modal {
    width: calc(100vw - 16px);
    max-height: calc(100vh - 20px);
    border-radius: 12px;
  }

  .license-content {
    padding: 8px 16px 16px 16px;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
