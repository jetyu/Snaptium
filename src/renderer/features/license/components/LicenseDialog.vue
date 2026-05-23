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
          <div class="license-close-btn-wrapper">
            <button type="button" class="license-close-btn" :aria-label="t('button.close')" @click="closeLicenseDialog">
              &times;
            </button>
          </div>

          <div class="license-content">
            <LicenseManagementView v-if="store.canManage" />
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
import { useLicenseDialog } from '../composables/useLicenseDialog';
import { useLicenseStore } from '../store/license.store';
import { licenseService } from '../services/license.service';
import LicenseActivationView from './LicenseActivationView.vue';
import LicenseManagementView from './LicenseManagementView.vue';

const { t } = useI18n();
const store = useLicenseStore();
const { isVisible, closeLicenseDialog, initMainProcessListeners } = useLicenseDialog();
const overlayRef = ref<HTMLElement | null>(null);
let removeMainMenuListener: (() => void) | null = null;

watch(isVisible, async (visible) => {
  if (!visible) {
    return;
  }

  await nextTick();
  overlayRef.value?.focus();
  await licenseService.refreshDevices().catch(() => undefined);
});

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
  background: rgba(15, 23, 42, 0.52);
  outline: none;
}

.license-modal {
  width: min(760px, calc(100vw - 32px));
  max-height: calc(100vh - 40px);
  overflow: auto;
  background: #ffffff;
  border: 1px solid #dbe3ef;
  border-radius: 14px;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.28);
  position: relative;
}

.license-close-btn-wrapper {
  position: absolute;
  top: 10px;
  right: 10px;
}

.license-close-btn {
  width: 28px;
  height: 28px;
  border: 1px solid #d1d9e6;
  border-radius: 7px;
  background: #ffffff;
  cursor: pointer;
}

.license-content {
  padding: 20px;
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


