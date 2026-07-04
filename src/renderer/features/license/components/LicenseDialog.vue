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
        <div ref="dialogRef" class="license-modal" :style="dialogStyle" @click.stop>
          <div ref="dragHandleRef" class="license-modal-header dialog-drag-handle" @pointerdown="onDragHandlePointerDown">
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
import { useDraggableDialog } from '@renderer/core/composables/useDraggableDialog';
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
const dialogRef = ref<HTMLElement | null>(null);
const dragHandleRef = ref<HTMLElement | null>(null);
const activationViewRef = ref<LicenseActivationViewInstance | null>(null);
const panelMode = ref<LicensePanelMode>('activation');
const { dialogStyle, onDragHandlePointerDown } = useDraggableDialog({
  isOpen: isVisible,
  overlayRef,
  dialogRef,
  handleRef: dragHandleRef,
});

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
  width: min(760px, calc(100vw - 32px));
  max-height: calc(100vh - 40px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--surface-subtle);
  border: 1px solid color-mix(in srgb, var(--panel-border) 86%, transparent);
  border-radius: 18px;
  box-shadow:
    var(--shadow-lg),
    inset 0 1px 0 color-mix(in srgb, #fff 44%, transparent);
  position: relative;
}

.license-modal-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-height: 42px;
  padding: 10px 10px 0;
  z-index: 15;
  cursor: move;
}

.license-close-btn {
  color: var(--text-tertiary);
}

.license-close-btn :deep(svg) {
  display: block;
}

.license-content {
  padding: 0 26px 26px;
  overflow-y: auto;
  flex: 1;
}

@media (max-width: 640px) {
  .license-modal {
    width: calc(100vw - 16px);
    max-height: calc(100vh - 20px);
    border-radius: 12px;
  }

  .license-content {
    padding: 0 16px 16px;
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
