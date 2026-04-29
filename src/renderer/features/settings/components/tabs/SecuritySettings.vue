<template>
  <div class="settings-subview">
    <h3 class="panel-title">{{ pageTitle }}</h3>

    <div class="settings-subview-content scrollable">
      <template v-if="activeView === 'dashboard'">
        <div class="settings-grid">
          <!-- 安全状态模块 -->
          <section class="setting-card security-card">
            <div class="setting-copy security-copy">
              <div class="security-title-row">
                <p class="setting-label">{{ t('e2ee.securityTitle') }}</p>
                <span class="status-pill security-inline-status" :class="securityStatusToneClass">
                  {{ securityStatusLabel }}
                </span>
              </div>
              <p class="setting-description">{{ securityDescription }}</p>
            </div>

            <div class="settings-card-actions security-actions" v-if="isE2eeAvailable">
              <button v-if="!e2eeHasKeySlots" type="button" class="action-button primary" :disabled="e2eeLoading"
                @click="openView('setup')">
                {{ t('e2ee.setupPassword') }}
              </button>

              <template v-else-if="e2eeIsUnlocked">
                <button type="button" class="action-button secondary" :disabled="e2eeLoading" @click="handleLockE2ee">
                  {{ t('e2ee.lock') }}
                </button>
              </template>

              <template v-else>
                <button type="button" class="action-button primary" :disabled="e2eeLoading" @click="openView('unlock')">
                  {{ t('e2ee.unlock') }}
                </button>
              </template>
            </div>
          </section>

          <!-- 修改主密码模块 -->
          <section v-if="e2eeHasKeySlots" class="setting-card">
            <div class="setting-copy">
              <p class="setting-label">{{ t('e2ee.changePassword') }}</p>
              <p class="setting-description">
                {{ t('e2ee.masterPasswordDesc') }}
              </p>
            </div>
            <div class="settings-card-actions security-actions">
              <button type="button" class="action-button secondary" :disabled="e2eeLoading || !e2eeIsUnlocked"
                @click="openView('change')">
                {{ t('e2ee.changePassword') }}
              </button>
            </div>
          </section>

          <!-- 恢复密钥管理模块 -->
          <section v-if="e2eeHasKeySlots" class="setting-card">
            <div class="setting-copy">
              <p class="setting-label">{{ t('e2ee.recoveryKey.title') }}</p>
              <p class="setting-description">
                {{ t('e2ee.recoveryKey.description') }}
              </p>
            </div>
            <div class="settings-card-actions security-actions">
              <button type="button" class="action-button secondary" :disabled="e2eeLoading || !e2eeIsUnlocked"
                @click="openView('regenerate-key')">
                {{ t('e2ee.recoveryKey.regenerate') }}
              </button>
            </div>
          </section>
        </div>

      </template>

      <template v-else>
        <div v-if="isUnlockFlowView" class="settings-grid security-unlock-layout">
          <E2eeUnlockModule :mode="unlockModuleMode" :password="unlockPassword" :recovery-key="recoveryKeyInput"
            :disabled="formSubmitting" @update:password="unlockPassword = $event"
            @update:recoveryKey="recoveryKeyInput = $event" @switch-mode="openView" @submit="handleSubmit" />
        </div>

        <section v-else class="setting-card vertical-layout security-form-card">
          <div class="setting-copy">
            <p class="setting-description">{{ formDescription }}</p>
          </div>

          <div v-if="generatedRecoveryKey" class="recovery-key-block">
            <p class="recovery-key-label">{{ t('e2ee.recoveryKey.displayLabel') }}</p>
            <div class="recovery-key-value">{{ generatedRecoveryKey }}</div>
            <div class="settings-row">
              <button type="button" class="action-button secondary" @click="copyRecoveryKey">
                {{ t('contextMenu.copy') }}
              </button>
              <button type="button" class="action-button secondary" @click="exportRecoveryKeyToTxt">
                {{ t('e2ee.recoveryKey.exportTxt') }}
              </button>
            </div>
          </div>

          <template v-else>
            <template v-if="activeView === 'setup'">
              <div class="security-inline-form">
                <div class="security-input-group">
                  <label class="setting-label">{{ t('e2ee.enterPassword') }}</label>
                  <input v-model="setupPassword" type="password" class="settings-input"
                    :placeholder="t('e2ee.enterPassword')" autocomplete="new-password" />
                </div>
                <div class="security-input-group">
                  <label class="setting-label">{{ t('e2ee.confirmPassword') }}</label>
                  <input v-model="setupConfirmPassword" type="password" class="settings-input"
                    :placeholder="t('e2ee.confirmPassword')" autocomplete="new-password" />
                </div>
              </div>
            </template>

            <template v-else-if="activeView === 'regenerate-key'">
              <div class="security-inline-form">
                <div class="security-input-group">
                  <label class="setting-label">{{ t('e2ee.enterPassword') }}</label>
                  <p class="setting-description" style="margin-bottom: 0.5rem;">{{
                    t('e2ee.recoveryKey.regenerateVerifyDesc') }}</p>
                  <input v-model="unlockPassword" type="password" class="settings-input"
                    :placeholder="t('e2ee.enterPassword')" autocomplete="current-password"
                    @keyup.enter="handleSubmit" />
                </div>
              </div>
            </template>

            <template v-else-if="activeView === 'reset-password'">
              <div class="security-inline-form">
                <div class="security-input-group">
                  <label class="setting-label">{{ t('e2ee.recoveryKey.title') }}</label>
                  <input v-model="recoveryKeyInput" type="text" class="settings-input" :placeholder="'ABCD-EFGH-...'"
                    autocomplete="off" />
                </div>
                <div class="security-input-group">
                  <label class="setting-label">{{ t('e2ee.newPassword') }}</label>
                  <input v-model="changeNewPassword" type="password" class="settings-input"
                    :placeholder="t('e2ee.newPassword')" autocomplete="new-password" />
                </div>
                <div class="security-input-group">
                  <label class="setting-label">{{ t('e2ee.confirmPassword') }}</label>
                  <input v-model="changeConfirmPassword" type="password" class="settings-input"
                    :placeholder="t('e2ee.confirmPassword')" autocomplete="new-password" />
                </div>
              </div>
            </template>
            <template v-else-if="activeView === 'change'">
              <div class="security-inline-form">
                <div class="security-input-group">
                  <label class="setting-label">{{ t('e2ee.oldPassword') }}</label>
                  <input v-model="changeOldPassword" type="password" class="settings-input"
                    :placeholder="t('e2ee.oldPassword')" autocomplete="current-password" />
                </div>
                <div class="security-input-group">
                  <label class="setting-label">{{ t('e2ee.newPassword') }}</label>
                  <input v-model="changeNewPassword" type="password" class="settings-input"
                    :placeholder="t('e2ee.newPassword')" autocomplete="new-password" />
                </div>
                <div class="security-input-group">
                  <label class="setting-label">{{ t('e2ee.confirmPassword') }}</label>
                  <input v-model="changeConfirmPassword" type="password" class="settings-input"
                    :placeholder="t('e2ee.confirmPassword')" autocomplete="new-password" />
                </div>
              </div>
            </template>

          </template>

        </section>
      </template>
    </div>

    <div v-if="activeView !== 'dashboard'" class="settings-subview-footer with-divider">
      <div class="settings-subview-footer-buttons between">
        <div class="settings-subview-footer-left">
          <button v-if="activeView === 'setup' && !generatedRecoveryKey" type="button" class="unlock-link-button"
            @click="openView('reset-password')">
            {{ t('e2ee.alreadyHaveRecoveryKey') }}
          </button>
        </div>
        <div class="settings-subview-footer-main">
          <button class="action-button secondary" @click="handleBack">
            {{ t('button.cancel') }}
          </button>
          <button class="action-button primary" :disabled="!canSubmit" @click="handleSubmit">
            {{ generatedRecoveryKey ? t('common.close') : t('common.confirm') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { getErrorMessage } from '@shared/utils/error.utils';
import { systemDialog } from '@renderer/features/settings/services/system-dialog.service';
import {
  E2eeUnlockModule,
  securityService,
  normalizeSecurityError,
  type E2eeStatus,
  type SecurityError,
} from '@renderer/features/security';

type SecuritySubview = 'dashboard' | 'setup' | 'unlock' | 'recovery' | 'change' | 'reset-password' | 'regenerate-key';


const { t } = useI18n();

const activeView = ref<SecuritySubview>('dashboard');
const e2eeState = ref<E2eeStatus | null>(null);
const e2eeLoading = ref(false);

const formSubmitting = ref(false);
const generatedRecoveryKey = ref('');

const setupPassword = ref('');
const setupConfirmPassword = ref('');
const unlockPassword = ref('');
const recoveryKeyInput = ref('');
const changeOldPassword = ref('');
const changeNewPassword = ref('');
const changeConfirmPassword = ref('');

const isE2eeAvailable = computed(() => securityService.isAvailable());
const e2eeHasKeySlots = computed(() => Boolean(e2eeState.value?.hasKeySlots));
const e2eeIsUnlocked = computed(() => Boolean(e2eeState.value?.isUnlocked));
const isUnlockFlowView = computed(() => activeView.value === 'unlock' || activeView.value === 'recovery');
const unlockModuleMode = computed<'unlock' | 'recovery'>(() => (
  activeView.value === 'recovery' ? 'recovery' : 'unlock'
));
const pageTitle = computed(() => {
  switch (activeView.value) {
    case 'setup':
      return t('e2ee.dialog.setupTitle');
    case 'unlock':
      return t('e2ee.dialog.unlockTitle');
    case 'recovery':
      return t('e2ee.dialog.recoveryTitle');
    case 'change':
      return t('e2ee.dialog.changeTitle');
    case 'reset-password':
      return t('e2ee.dialog.resetPasswordTitle');
    case 'regenerate-key':
      return t('e2ee.dialog.regenerateKeyTitle');
    default:
      return t('pref.pane.security');
  }
});

const formDescription = computed(() => {
  if (generatedRecoveryKey.value) {
    return t('e2ee.recoveryKey.description');
  }

  switch (activeView.value) {
    case 'setup':
      return t('e2ee.masterPasswordRequired');
    case 'unlock':
      return t('e2ee.unlockVerificationDescription');
    case 'recovery':
      return t('e2ee.recoveryKey.description');
    case 'change':
      return t('e2ee.changePassword');
    case 'reset-password':
      return t('e2ee.resetPasswordDescription');
    case 'regenerate-key':
      return t('e2ee.recoveryKey.regenerateVerifyDesc');
    default:
      return '';
  }
});

const setupPasswordMismatch = computed(() => (
  setupPassword.value.length > 0
  && setupConfirmPassword.value.length > 0
  && setupPassword.value !== setupConfirmPassword.value
));

const changePasswordMismatch = computed(() => (
  changeNewPassword.value.length > 0
  && changeConfirmPassword.value.length > 0
  && changeNewPassword.value !== changeConfirmPassword.value
));

const canSubmit = computed(() => {
  if (formSubmitting.value) {
    return false;
  }

  if (generatedRecoveryKey.value) {
    return true;
  }

  switch (activeView.value) {
    case 'setup':
      return (
        setupPassword.value.trim().length > 0
        && setupConfirmPassword.value.trim().length > 0
        && !setupPasswordMismatch.value
      );
    case 'unlock':
      return unlockPassword.value.trim().length > 0;
    case 'recovery':
      return recoveryKeyInput.value.trim().length > 0;
    case 'change':
      return (
        changeOldPassword.value.trim().length > 0
        && changeNewPassword.value.trim().length > 0
        && changeConfirmPassword.value.trim().length > 0
        && !changePasswordMismatch.value
      );
    case 'reset-password':
      return (
        recoveryKeyInput.value.trim().length > 0
        && changeNewPassword.value.trim().length > 0
        && changeConfirmPassword.value.trim().length > 0
        && !changePasswordMismatch.value
      );
    case 'regenerate-key':
      return unlockPassword.value.trim().length > 0;
    default:
      return false;
  }
});

const securityStatusToneClass = computed(() => {
  if (e2eeLoading.value) {
    return 'is-syncing';
  }
  if (!isE2eeAvailable.value || !e2eeHasKeySlots.value) {
    return 'is-warning';
  }
  return e2eeIsUnlocked.value ? 'is-idle' : 'is-error';
});

const securityStatusLabel = computed(() => {
  if (e2eeLoading.value) {
    return t('changelog.loading');
  }
  if (!isE2eeAvailable.value || !e2eeHasKeySlots.value) {
    return t('e2ee.status.notConfigured');
  }
  return e2eeIsUnlocked.value ? t('e2ee.status.unlockedShort') : t('e2ee.status.lockedShort');
});

const securityDescription = computed(() => {
  if (!isE2eeAvailable.value) {
    return t('e2ee.unavailable');
  }
  if (!e2eeHasKeySlots.value) {
    return t('e2ee.securityStatusUnconfiguredDesc');
  }
  if (!e2eeIsUnlocked.value) {
    return t('e2ee.locked');
  }
  return t('e2ee.securityDescription');
});


function resolveSecurityErrorMessage(error: SecurityError): string {
  const keyByCode: Record<string, string> = {
    WRONG_PASSWORD: 'e2ee.error.wrongPassword',
    KEY_SLOTS_CORRUPTED: 'e2ee.error.keySlotsCorrupted',
    RECOVERY_KEY_INVALID: 'e2ee.error.recoveryKeyInvalid',
    SETUP_FAILED: 'e2ee.error.setupFailed',
    DEK_NOT_UNLOCKED: 'e2ee.error.dekNotUnlocked',
    MASTER_PASSWORD_REQUIRED: 'e2ee.error.masterPasswordRequired',
  };

  const key = keyByCode[error.code];
  return key ? t(key) : error.message;
}

function resetForms(): void {
  generatedRecoveryKey.value = '';
  setupPassword.value = '';
  setupConfirmPassword.value = '';
  unlockPassword.value = '';
  recoveryKeyInput.value = '';
  changeOldPassword.value = '';
  changeNewPassword.value = '';
  changeConfirmPassword.value = '';
}

function openView(view: SecuritySubview): void {
  activeView.value = view;
  resetForms();
}

function handleBack(): void {
  activeView.value = 'dashboard';
  resetForms();
}

async function showSecurityDialog(
  type: 'info' | 'warning' | 'error',
  message: string,
): Promise<void> {
  const payload = {
    title: t('pref.pane.security'),
    message,
  };
  if (type === 'info') {
    await systemDialog.info(payload);
    return;
  }
  if (type === 'warning') {
    await systemDialog.warning(payload);
    return;
  }
  await systemDialog.error(payload);
}

async function refreshE2eeState(): Promise<void> {
  if (!isE2eeAvailable.value) {
    return;
  }

  e2eeLoading.value = true;
  try {
    e2eeState.value = await securityService.getStatus();
  } catch {
    // Security status pill and description remain the primary status indicators.
  } finally {
    e2eeLoading.value = false;
  }
}


async function handleLockE2ee(): Promise<void> {
  try {
    await securityService.lock();
    await refreshE2eeState();
  } catch (error: unknown) {
    const normalized = normalizeSecurityError(error);
    await showSecurityDialog('error', resolveSecurityErrorMessage(normalized));
  }
}

async function handleSubmit(): Promise<void> {
  if (generatedRecoveryKey.value) {
    handleBack();
    return;
  }

  formSubmitting.value = true;

  try {
    switch (activeView.value) {
      case 'setup':
        generatedRecoveryKey.value = await securityService.setupPassword(setupPassword.value);
        await refreshE2eeState();
        break;
      case 'unlock':
        await securityService.unlock(unlockPassword.value);
        await refreshE2eeState();
        handleBack();
        break;
      case 'recovery':
        await securityService.unlockWithRecovery(recoveryKeyInput.value);
        await refreshE2eeState();
        handleBack();
        break;
      case 'change':
        generatedRecoveryKey.value = await securityService.changePassword(
          changeOldPassword.value,
          changeNewPassword.value,
        );
        await refreshE2eeState();
        break;
      case 'reset-password':
        generatedRecoveryKey.value = await securityService.resetPassword(
          recoveryKeyInput.value,
          changeNewPassword.value,
        );
        await refreshE2eeState();
        break;
      case 'regenerate-key':
        // Reuse changePassword logic but with same password to just get a new key
        // Or better, we should have a specific regenerateKey method.
        // For now, changePassword works if we use the same password.
        generatedRecoveryKey.value = await securityService.changePassword(
          unlockPassword.value,
          unlockPassword.value,
        );
        await refreshE2eeState();
        break;
      default:
        break;
    }
  } catch (error: unknown) {
    const normalized = normalizeSecurityError(error);
    await showSecurityDialog('error', resolveSecurityErrorMessage(normalized));
  } finally {
    formSubmitting.value = false;
  }
}

async function copyRecoveryKey(): Promise<void> {
  if (!generatedRecoveryKey.value) {
    return;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(generatedRecoveryKey.value);
    } else if (window.electronAPI?.editor) {
      await window.electronAPI.editor.writeClipboard(generatedRecoveryKey.value);
    } else {
      throw new Error(t('common.unknown'));
    }

    await showSecurityDialog('info', t('e2ee.recoveryKey.copied'));
  } catch (error: unknown) {
    await showSecurityDialog('error', getErrorMessage(error, t('common.unknown')));
  }
}

async function exportRecoveryKeyToTxt(): Promise<void> {
  if (!generatedRecoveryKey.value) {
    return;
  }

  try {
    const result = await securityService.exportRecoveryKey(generatedRecoveryKey.value);
    if (result.canceled) {
      return;
    }
    await showSecurityDialog('info', t('e2ee.recoveryKey.exported'));
  } catch (error: unknown) {
    const normalized = normalizeSecurityError(error);
    await showSecurityDialog('error', resolveSecurityErrorMessage(normalized));
  }
}

onMounted(async () => {
  await refreshE2eeState();
});
</script>

<style scoped>
.security-card {
  align-items: center;
}

.security-copy {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.security-copy .setting-description,
.security-form-card .setting-description {
  white-space: pre-wrap;
  line-height: 1.6;
}

.security-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.security-inline-status {
  padding: 2px 8px;
  font-size: 0.75rem;
}

.security-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  flex-shrink: 0;
}


.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  font-weight: 600;
  border: 1px solid transparent;
}

.is-idle {
  background: rgba(16, 185, 129, 0.08);
  border-color: rgba(16, 185, 129, 0.2);
  color: #03865d;
}

.is-syncing {
  background: rgba(59, 130, 246, 0.08);
  border-color: rgba(59, 130, 246, 0.2);
  color: #2563eb;
}

.is-error {
  background: rgba(244, 63, 94, 0.08);
  border-color: rgba(244, 63, 94, 0.2);
  color: #e11d48;
}

.is-warning {
  background: rgba(245, 158, 11, 0.08);
  border-color: rgba(245, 158, 11, 0.2);
  color: #b45309;
}

.security-form-card {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  align-items: stretch;
  padding: 1.5rem;
}

.security-inline-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.security-input-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.security-input-group .setting-label {
  margin: 0;
  font-size: 0.85rem;
}

.security-unlock-layout {
  align-content: start;
}

.recovery-key-block {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
}

.recovery-key-label {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: #4b5563;
}

.security-setup-header {
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.unlock-link-button {
  border: none;
  background: transparent;
  padding: 0;
  color: #3b82f6;
  font-size: 0.84rem;
  line-height: 1.4;
  cursor: pointer;
  white-space: nowrap;
}

.unlock-link-button:hover {
  color: #2563eb;
  text-decoration: underline;
}

.security-locked-hint {
  color: #e11d48;
  margin-left: 4px;
  font-size: 0.84rem;
}
</style>
