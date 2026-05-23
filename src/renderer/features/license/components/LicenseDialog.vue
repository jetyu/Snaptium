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
            <button type="button" class="license-close-btn" :aria-label="t('button.close')" @click="closeLicenseDialog">
              <Close theme="outline" size="18" />
            </button>
          </div>

          <div class="license-content">
            <LicenseManagementView v-if="panelMode === 'management'" />
            <LicenseActivationView v-else />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Close } from '@icon-park/vue-next';
import { useLicenseDialog } from '../composables/useLicenseDialog';
import { useLicenseStore } from '../store/license.store';
import { licenseService } from '../services/license.service';
import LicenseActivationView from './LicenseActivationView.vue';
import LicenseManagementView from './LicenseManagementView.vue';

type LicensePanelMode = 'management' | 'activation';

const { t } = useI18n();
const store = useLicenseStore();
const { isVisible, closeLicenseDialog, initMainProcessListeners } = useLicenseDialog();
const overlayRef = ref<HTMLElement | null>(null);
const panelMode = ref<LicensePanelMode>('activation');
let removeMainMenuListener: (() => void) | null = null;

watch(isVisible, async (visible) => {
  if (!visible) {
    return;
  }

  panelMode.value = store.canManage ? 'management' : 'activation';
  await nextTick();
  overlayRef.value?.focus();
  if (store.canManage) {
    await licenseService.refreshDevices().catch(() => undefined);
  }
});

watch(
  () => store.canManage,
  (canManage) => {
    if (!isVisible.value) {
      return;
    }
    if (canManage) {
      panelMode.value = 'management';
    }
  },
);
onMounted(async () => {
  await licenseService.initialize();
  removeMainMenuListener = initMainProcessListeners();
});

onUnmounted(() => {
  licenseService.dispose();
  if (removeMainMenuListener) {
    removeMainMenuListener();
    removeMainMenuListener = null;
  }
});
</script>

<style scoped>
.license-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  outline: none;
}

.license-modal {
  width: min(760px, calc(100vw - 32px));
  max-height: calc(100vh - 40px);
  overflow: auto;
  background: #ffffff;
  border: 1px solid #dbe3ef;
  border-radius: 16px;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.28);
  position: relative;
}

.license-modal-header {
  display: flex;
  justify-content: flex-end;
  padding: 10px 10px 0 10px;
}

.license-close-btn {
  width: 30px;
  height: 30px;
  border: 1px solid #c7d3e3;
  border-radius: 9px;
  background: #ffffff;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
  cursor: pointer;
  color: #334155;
  transition: border-color 0.16s ease, background-color 0.16s ease;
}

.license-close-btn:hover {
  border-color: #8fb6f1;
  background: #eef5ff;
}

.license-close-btn :deep(svg) {
  display: block;
}

.license-content {
  padding: 12px 20px 18px 20px;
}

:deep(.license-btn) {
  min-width: 118px;
  min-height: 34px;
  height: 34px;
  border-radius: 8px;
  padding: 0 14px;
  font-size: 0.86rem;
  font-weight: 500;
}

@media (max-width: 640px) {
  .license-modal {
    width: calc(100vw - 16px);
    max-height: calc(100vh - 20px);
    border-radius: 12px;
  }

  .license-content {
    padding: 10px 16px 16px 16px;
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
