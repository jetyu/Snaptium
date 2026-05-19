<template>
  <div class="settings-subview">
    <h3 class="panel-title">{{ pageTitle }}</h3>

    <div class="settings-subview-content scrollable">
      <template v-if="activeView === 'dashboard'">
        <div class="settings-grid">
          <!-- Card 1: 访问控制主开关 -->
          <section class="setting-card">
            <div class="setting-copy">
              <p class="setting-label">{{ t('e2ee.accessControl.title') }}</p>
              <p class="setting-description">{{ AccessControlDescription }}</p>
            </div>

            <div class="settings-card-actions" v-if="isAccessControlAvailable">
              <button v-if="AccessControlIsLocked" type="button" class="action-button primary"
                :disabled="AccessControlLoading || !accessControlConfig.enabled"
                @click="openView('accessControlUnlock')">
                {{ t('e2ee.accessControl.unlock') }}
              </button>
              <button v-else type="button" class="action-button secondary"
                :disabled="AccessControlLoading || !accessControlConfig.enabled" @click="handleLockAccessControlNow">
                {{ t('e2ee.accessControl.lockNow') }}
              </button>

              <button type="button" class="startup-switch" :class="{ enabled: accessControlConfig.enabled }"
                :aria-pressed="accessControlConfig.enabled" :disabled="AccessControlActionDisabled"
                @click="handleToggleAccessControlEnabled">
                <span class="startup-switch-track">
                  <span class="startup-switch-thumb" />
                </span>
                <span class="startup-switch-text">
                  {{ accessControlConfig.enabled ? t('checkbox.status.enabled') : t('checkbox.status.disabled') }}
                </span>
              </button>
            </div>
          </section>

          <!-- Card 2: 启动时锁定访问 -->
          <section class="setting-card">
            <div class="setting-copy">
              <p class="setting-label">{{ t('e2ee.accessControl.lockOnStartup') }}</p>
              <p class="setting-description">{{ t('e2ee.accessControl.lockOnStartupDesc') || '' }}</p>
            </div>
            <div class="settings-card-actions">
              <button type="button" class="startup-switch" :class="{ enabled: accessControlConfig.lockOnStartup }"
                :aria-pressed="accessControlConfig.lockOnStartup" :disabled="AccessControlControlDisabled"
                @click="handleLockOnStartupChange">
                <span class="startup-switch-track">
                  <span class="startup-switch-thumb" />
                </span>
              </button>
            </div>
          </section>

          <!-- Card 3: 自动锁定超时 -->
          <section class="setting-card">
            <div class="setting-copy">
              <p class="setting-label">{{ t('e2ee.accessControl.autoLockTimeout') }}</p>
              <p class="setting-description">{{ t('e2ee.accessControl.autoLockTimeoutDesc') || '' }}</p>
            </div>
            <div class="settings-card-actions">
              <label class="select-shell security-timeout-select" :class="{ disabled: AccessControlControlDisabled }">
                <select class="settings-select" :value="accessControlConfig.autoLockTimeoutMinutes"
                  :disabled="AccessControlControlDisabled" @change="handleAutoLockTimeoutChange">
                  <option v-for="option in AccessControlTimeoutOptions" :key="option.value" :value="option.value">
                    {{ t(option.labelKey) }}
                  </option>
                </select>
              </label>
            </div>
          </section>
        </div>
      </template>

      <template v-else-if="activeView === 'accessControlUnlock'">
        <section class="setting-card vertical-layout security-form-card">
          <div class="setting-copy">
            <p class="setting-description">{{ formDescription }}</p>
          </div>

          <div class="security-inline-form">
            <div class="security-input-group">
              <label class="setting-label">{{ t('e2ee.accessControl.unlockPassword') }}</label>
              <PasswordInput v-model="accessControlUnlockPassword" :placeholder="t('e2ee.accessControl.unlockPassword')"
                autocomplete="current-password"
                @keyup.enter="handleSubmit" />
            </div>
          </div>
        </section>
      </template>
    </div>

    <div v-if="activeView !== 'dashboard'" class="settings-subview-footer with-divider">
      <div class="settings-subview-footer-buttons between">
        <div class="settings-subview-footer-left" />
        <div class="settings-subview-footer-main">
          <button class="action-button secondary" @click="handleBack">
            {{ t('button.cancel') }}
          </button>
          <button class="action-button primary" :disabled="!canSubmit" @click="handleSubmit">
            {{ t('common.confirm') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ACCESS_CONTROL_TIMEOUT_OPTIONS, type AccessControlTimeout } from '@shared/e2ee.constants';
import { systemDialog } from '@renderer/features/settings/services/system-dialog.service';
import PasswordInput from '../PasswordInput.vue';
import {
  securityService,
  normalizeSecurityError,
  type AccessControlStatus,
  type E2eeStatus,
  type SecurityError,
} from '@renderer/features/security';
import { type AccessControlConfig } from '@renderer/core/bridge/electronApi';

interface AccessControlOption {
  value: AccessControlTimeout;
  labelKey: string;
}

type AccessControlSubview = 'dashboard' | 'accessControlUnlock';

const defaultAccessControlConfig = {
  enabled: false,
  lockOnStartup: false,
  autoLockTimeoutMinutes: ACCESS_CONTROL_TIMEOUT_OPTIONS.DISABLED,
};

const AccessControlTimeoutOptions: AccessControlOption[] = [
  { value: ACCESS_CONTROL_TIMEOUT_OPTIONS.DISABLED, labelKey: 'e2ee.accessControl.timeout.disabled' },
  { value: ACCESS_CONTROL_TIMEOUT_OPTIONS.ONE_MINUTE, labelKey: 'e2ee.accessControl.timeout.oneMinute' },
  { value: ACCESS_CONTROL_TIMEOUT_OPTIONS.FIVE_MINUTES, labelKey: 'e2ee.accessControl.timeout.fiveMinutes' },
  { value: ACCESS_CONTROL_TIMEOUT_OPTIONS.FIFTEEN_MINUTES, labelKey: 'e2ee.accessControl.timeout.fifteenMinutes' },
  { value: ACCESS_CONTROL_TIMEOUT_OPTIONS.THIRTY_MINUTES, labelKey: 'e2ee.accessControl.timeout.thirtyMinutes' },
  { value: ACCESS_CONTROL_TIMEOUT_OPTIONS.ONE_HOUR, labelKey: 'e2ee.accessControl.timeout.oneHour' },
];

const { t } = useI18n();

const activeView = ref<AccessControlSubview>('dashboard');
const e2eeState = ref<E2eeStatus | null>(null);
const AccessControlState = ref<AccessControlStatus | null>(null);
const AccessControlLoading = ref(false);
const formSubmitting = ref(false);
const accessControlUnlockPassword = ref('');

let removeAccessControlListener: (() => void) | null = null;

const isAccessControlAvailable = computed(() => securityService.isAccessControlAvailable());
const e2eeHasKeySlots = computed(() => Boolean(e2eeState.value?.hasKeySlots));
const accessControlConfig = computed(() => AccessControlState.value?.config ?? defaultAccessControlConfig);
const AccessControlIsLocked = computed(() => Boolean(AccessControlState.value?.isLocked));

const pageTitle = computed(() => {
  if (activeView.value === 'accessControlUnlock') {
    return t('e2ee.accessControl.unlockTitle');
  }
  return t('pref.pane.accessControl');
});

const formDescription = computed(() => {
  if (activeView.value === 'accessControlUnlock') {
    return t('e2ee.accessControl.unlockDescription');
  }
  return '';
});

const canSubmit = computed(() => {
  if (formSubmitting.value) return false;
  if (activeView.value === 'accessControlUnlock') {
    return accessControlUnlockPassword.value.trim().length > 0;
  }
  return false;
});

const AccessControlConfigDisabled = computed(() => (
  !isAccessControlAvailable.value || !e2eeHasKeySlots.value
));

const AccessControlControlDisabled = computed(() => (
  AccessControlLoading.value
  || AccessControlConfigDisabled.value
  || !accessControlConfig.value.enabled
));

const AccessControlActionDisabled = computed(() => (
  AccessControlLoading.value
  || !isAccessControlAvailable.value
  || (!e2eeHasKeySlots.value && !accessControlConfig.value.enabled)
));


const AccessControlDescription = computed(() => {
  if (!isAccessControlAvailable.value) return t('e2ee.accessControl.unavailable');
  if (!e2eeHasKeySlots.value) return t('e2ee.accessControl.requireMasterPassword');
  if (!accessControlConfig.value.enabled) return t('e2ee.accessControl.disabledDescription');
  return AccessControlIsLocked.value ? t('e2ee.accessControl.lockedDescription') : t('e2ee.accessControl.enabledDescription');
});

function resolveSecurityErrorMessage(error: SecurityError): string {
  const keyByCode: Record<string, string> = {
    WRONG_PASSWORD: 'e2ee.error.wrongPassword',
    MASTER_PASSWORD_REQUIRED: 'e2ee.error.masterPasswordRequired',
  };
  const key = keyByCode[error.code];
  return key ? t(key) : error.message;
}

async function showSecurityDialog(type: 'info' | 'warning' | 'error', message: string): Promise<void> {
  const payload = { title: t('pref.pane.accessControl'), message };
  if (type === 'info') await systemDialog.info(payload);
  else if (type === 'warning') await systemDialog.warning(payload);
  else await systemDialog.error(payload);
}

async function refreshE2eeState(): Promise<void> {
  if (!securityService.isAvailable()) return;
  try {
    e2eeState.value = await securityService.getStatus();
  } catch { /* ignore */ }
}

async function refreshAccessControlState(): Promise<void> {
  if (!isAccessControlAvailable.value) return;
  AccessControlLoading.value = true;
  try {
    AccessControlState.value = await securityService.getAccessControlStatus();
  } catch { /* ignore */ }
  finally { AccessControlLoading.value = false; }
}

async function updateAccessControlConfig(nextConfig: AccessControlConfig): Promise<void> {
  try {
    await securityService.updateAccessControlConfig(nextConfig);
    await refreshAccessControlState();
  } catch (error: unknown) {
    const normalized = normalizeSecurityError(error);
    await showSecurityDialog('error', resolveSecurityErrorMessage(normalized));
  }
}

async function handleToggleAccessControlEnabled(): Promise<void> {
  if (!isAccessControlAvailable.value || (!e2eeHasKeySlots.value && !accessControlConfig.value.enabled)) return;
  await updateAccessControlConfig({
    ...accessControlConfig.value,
    enabled: !accessControlConfig.value.enabled,
  });
}

async function handleLockOnStartupChange(): Promise<void> {
  await updateAccessControlConfig({
    ...accessControlConfig.value,
    lockOnStartup: !accessControlConfig.value.lockOnStartup,
  });
}

async function handleAutoLockTimeoutChange(event: Event): Promise<void> {
  const timeoutValue = Number((event.target as HTMLSelectElement).value) as AccessControlTimeout;
  await updateAccessControlConfig({
    ...accessControlConfig.value,
    autoLockTimeoutMinutes: timeoutValue,
  });
}

async function handleLockAccessControlNow(): Promise<void> {
  try {
    await securityService.lockAccessControl();
    await refreshAccessControlState();
  } catch (error: unknown) {
    const normalized = normalizeSecurityError(error);
    await showSecurityDialog('error', resolveSecurityErrorMessage(normalized));
  }
}

function openView(view: AccessControlSubview): void {
  activeView.value = view;
  accessControlUnlockPassword.value = '';
}

function handleBack(): void {
  activeView.value = 'dashboard';
  accessControlUnlockPassword.value = '';
}

async function handleSubmit(): Promise<void> {
  if (activeView.value === 'accessControlUnlock') {
    formSubmitting.value = true;
    try {
      await securityService.unlockAccessControl(accessControlUnlockPassword.value);
      await refreshAccessControlState();
      handleBack();
    } catch (error: unknown) {
      const normalized = normalizeSecurityError(error);
      await showSecurityDialog('error', resolveSecurityErrorMessage(normalized));
    } finally {
      formSubmitting.value = false;
    }
  }
}

onMounted(async () => {
  await refreshE2eeState();
  await refreshAccessControlState();
  removeAccessControlListener = securityService.onAccessControlStateChanged(() => {
    void refreshAccessControlState();
  });
});

onUnmounted(() => {
  if (removeAccessControlListener) {
    removeAccessControlListener();
    removeAccessControlListener = null;
  }
});
</script>

<style scoped>
.security-timeout-select {
  width: 120px;
}

.security-form-card {
  padding: 1.5rem;
  gap: 1.5rem;
}

.security-inline-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.security-input-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>
