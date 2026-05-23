import { computed } from 'vue';
import { electronApi } from '@renderer/core/bridge/electronApi';
import { useLicenseStore } from '../store/license.store';

export function useLicenseDialog() {
  const store = useLicenseStore();

  function openLicenseDialog(): void {
    store.openDialog();
  }

  function closeLicenseDialog(): void {
    store.closeDialog();
  }

  function initMainProcessListeners(): (() => void) | null {
    if (!electronApi.menu.isAvailable()) {
      return null;
    }

    return electronApi.menu.onOpenLicense(() => {
      openLicenseDialog();
    });
  }

  return {
    isVisible: computed(() => store.dialogVisible),
    openLicenseDialog,
    closeLicenseDialog,
    initMainProcessListeners,
  };
}
