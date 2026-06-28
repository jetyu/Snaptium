<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="isVisible"
        ref="overlayRef"
        class="access-control-overlay"
        tabindex="0"
        @keydown.esc.prevent
      >
        <div ref="dialogRef" class="access-control-panel" :style="dialogStyle" @click.stop>
          <div ref="dragHandleRef" class="access-control-header dialog-drag-handle" @pointerdown="onDragHandlePointerDown">
            <h2 class="access-control-title">{{ t('e2ee.accessControl.unlockTitle') }}</h2>
            <p class="access-control-description">{{ t('e2ee.accessControl.unlockDescription') }}</p>
          </div>

          <div class="dialog-form-group">
            <label>{{ t('e2ee.accessControl.unlockPassword') }}</label>
            <PasswordInput
              ref="passwordInputRef"
              v-model="password"
              :placeholder="t('e2ee.accessControl.unlockPassword')"
              autocomplete="current-password"
              @keyup.enter="handleUnlock"
            />
          </div>

          <div class="access-control-actions">
            <button
              type="button"
              class="action-button primary"
              :disabled="isSubmitting || password.trim().length === 0"
              @click="handleUnlock"
            >
              {{ t('e2ee.accessControl.unlock') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { normalizeSecurityError, securityService, type SecurityError } from '../services/security.service';
import { systemDialog } from '@renderer/features/settings/services/system-dialog.service';
import PasswordInput from '@renderer/features/settings/components/PasswordInput.vue';
import { useDraggableDialog } from '@renderer/core/composables/useDraggableDialog';

const { t } = useI18n();

const isVisible = ref(false);
const password = ref('');
const isSubmitting = ref(false);
const overlayRef = ref<HTMLElement | null>(null);
const dialogRef = ref<HTMLElement | null>(null);
const dragHandleRef = ref<HTMLElement | null>(null);
const passwordInputRef = ref<{ focus: () => void } | null>(null);
const { dialogStyle, onDragHandlePointerDown } = useDraggableDialog({
  isOpen: isVisible,
  overlayRef,
  dialogRef,
  handleRef: dragHandleRef,
});

let removeListener: (() => void) | null = null;

const isAccessControlAvailable = computed(() => securityService.isAccessControlAvailable());

function resolveSecurityErrorMessage(error: SecurityError): string {
  const keyByCode: Record<string, string> = {
    WRONG_PASSWORD: 'e2ee.error.wrongPassword',
    KEY_SLOTS_CORRUPTED: 'e2ee.error.keySlotsCorrupted',
    RECOVERY_KEY_INVALID: 'e2ee.error.recoveryKeyInvalid',
    MASTER_PASSWORD_REQUIRED: 'e2ee.error.masterPasswordRequired',
  };

  const key = keyByCode[error.code];
  return key ? t(key) : error.message;
}

function resetForm(): void {
  password.value = '';
}

async function refreshLockState(): Promise<void> {
  if (!isAccessControlAvailable.value) {
    isVisible.value = false;
    resetForm();
    return;
  }

  try {
    const status = await securityService.getAccessControlStatus();
    const shouldShow = status.config.enabled && status.isLocked;
    isVisible.value = shouldShow;

    if (!shouldShow) {
      resetForm();
    }
  } catch {
    isVisible.value = false;
  }
}

async function handleUnlock(): Promise<void> {
  if (isSubmitting.value || password.value.trim().length === 0) {
    return;
  }

  isSubmitting.value = true;

  try {
    await securityService.unlockAccessControl(password.value);
    await refreshLockState();
    resetForm();
  } catch (error: unknown) {
    const normalized = normalizeSecurityError(error);
    await systemDialog.warning({
      title: t('e2ee.accessControl.unlockTitle'),
      message: resolveSecurityErrorMessage(normalized),
    });
  } finally {
    isSubmitting.value = false;
  }
}

watch(isVisible, async (visible) => {
  if (!visible) {
    return;
  }

  await nextTick();
  overlayRef.value?.focus();
  passwordInputRef.value?.focus();
});

onMounted(async () => {
  await refreshLockState();

  removeListener = securityService.onAccessControlStateChanged(() => {
    void refreshLockState();
  });
});

onUnmounted(() => {
  if (removeListener) {
    removeListener();
    removeListener = null;
  }
});
</script>

<style scoped>
.access-control-overlay {
  position: fixed;
  inset: 0;
  z-index: 12000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--dialog-overlay-bg);
  backdrop-filter: var(--dialog-overlay-backdrop-filter);
  outline: none;
}

.access-control-panel {
  width: min(460px, calc(100vw - 32px));
  border-radius: 14px;
  border: 1px solid #dbe3f0;
  background: #ffffff;
  box-shadow: 0 24px 60px rgba(2, 6, 23, 0.2);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.access-control-header {
  display: grid;
  gap: 6px;
}

.access-control-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: #111827;
}

.access-control-description {
  margin: 0;
  font-size: 0.9rem;
  color: #4b5563;
}

.dialog-form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dialog-form-group label {
  font-size: 0.86rem;
  font-weight: 600;
  color: #111827;
}

.access-control-actions {
  display: flex;
  justify-content: flex-end;
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


