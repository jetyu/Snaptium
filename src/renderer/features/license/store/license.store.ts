import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import {
  DEFAULT_LICENSE_STATE,
  PLAN_FEATURES,
  type LicensedFeature,
  type LicenseState,
  type LicenseStatus,
  isPaidPlan,
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
  const initialized = ref(false);

  const plan = computed(() => state.value.plan);
  const status = computed(() => state.value.status);
  const activated = computed(() => state.value.activated);
  const valid = computed(() => state.value.valid);
  const devices = computed(() => state.value.devices);
  const activatedDevices = computed(() => state.value.activatedDevices);
  const maxDevices = computed(() => state.value.maxDevices);
  const currentDeviceId = computed(() => state.value.currentDeviceId);
  const lastValidatedAt = computed(() => state.value.lastValidatedAt);
  const lastHeartbeatAt = computed(() => state.value.lastHeartbeatAt);
  const lastErrorCode = computed(() => state.value.lastErrorCode);
  const lastErrorMessage = computed(() => state.value.lastErrorMessage);

  const isPaid = computed(() => isPaidPlan(state.value.plan));
  const isGraceMode = computed(() => status.value === 'offline_grace' || status.value === 'session_grace');
  const canManage = computed(() => isPaid.value && (activated.value || isGraceMode.value));

  function canUse(feature: LicensedFeature): boolean {
    if (!PLAN_FEATURES[state.value.plan][feature]) {
      return false;
    }

    return status.value === 'active' || status.value === 'offline_grace' || status.value === 'session_grace';
  }

  function updateState(nextState: LicenseState): void {
    state.value = cloneLicenseState(nextState);
    initialized.value = true;
  }

  function resetState(): void {
    state.value = cloneLicenseState(DEFAULT_LICENSE_STATE);
  }

  function setInitialized(value: boolean): void {
    initialized.value = value;
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
    initialized,
    plan,
    status,
    activated,
    valid,
    devices,
    activatedDevices,
    maxDevices,
    currentDeviceId,
    lastValidatedAt,
    lastHeartbeatAt,
    lastErrorCode,
    lastErrorMessage,
    isPaid,
    isGraceMode,
    canManage,
    canUse,
    updateState,
    resetState,
    setInitialized,
    openDialog,
    closeDialog,
    getStatusTextKey,
  };
});

