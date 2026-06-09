import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import {
  canManageLicense,
  canUseLicensedFeature,
  DEFAULT_LICENSE_STATE,
  type LicensedFeature,
  type LicenseState,
  type LicenseStatus,
} from '@shared/license.constants';

function cloneLicenseState(state: LicenseState): LicenseState {
  return {
    ...state,
    devices: state.devices.map((device) => ({ ...device })),
  };
}

export const useLicenseStore = defineStore('license', () => {
  const state = ref<LicenseState>(cloneLicenseState(DEFAULT_LICENSE_STATE));
  const dialogVisible = ref(false);

  const plan = computed(() => state.value.plan);
  const status = computed(() => state.value.status);
  const activated = computed(() => state.value.activated);
  const valid = computed(() => state.value.valid);
  const devices = computed(() => state.value.devices);
  const activatedDevices = computed(() => state.value.activatedDevices);
  const maxDevices = computed(() => state.value.maxDevices);
  const lastValidatedAt = computed(() => state.value.lastValidatedAt);
  const lastErrorCode = computed(() => state.value.lastErrorCode);
  const lastErrorMessage = computed(() => state.value.lastErrorMessage);

  const canManage = computed(() => canManageLicense(state.value));

  function canUse(feature: LicensedFeature): boolean {
    return canUseLicensedFeature(state.value, feature);
  }

  function updateState(nextState: LicenseState): void {
    state.value = cloneLicenseState(nextState);
  }

  function openDialog(): void {
    dialogVisible.value = true;
  }

  function closeDialog(): void {
    dialogVisible.value = false;
  }

  function getStatusTextKey(value: LicenseStatus): string {
    return `license.status.${value}`;
  }

  return {
    state,
    dialogVisible,
    plan,
    status,
    activated,
    valid,
    devices,
    activatedDevices,
    maxDevices,
    lastValidatedAt,
    lastErrorCode,
    lastErrorMessage,
    canManage,
    canUse,
    updateState,
    openDialog,
    closeDialog,
    getStatusTextKey,
  };
});

