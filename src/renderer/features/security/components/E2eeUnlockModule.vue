<template>
  <div class="settings-grid">
    <section class="setting-card vertical-layout unlock-card">
      <div class="setting-copy unlock-copy">
        <p class="setting-label">{{ isRecoveryMode ? t('e2ee.dialog.recoveryTitle') : t('e2ee.dialog.unlockTitle') }}</p>
        <p class="setting-description">{{ isRecoveryMode ? t('e2ee.recoveryKey.description') : t('e2ee.unlockVerificationDescription') }}</p>
      </div>
      <div class="unlock-content">
        <div class="setting-copy unlock-input-copy">
          <p class="setting-label">{{ isRecoveryMode ? t('e2ee.recoveryKey.title') : t('e2ee.enterPassword') }}</p>
        </div>
        <div class="input-container unlock-input-container">
          <input
            v-if="isRecoveryMode"
            :value="recoveryKey"
            type="text"
            class="settings-input"
            :placeholder="recoveryKeyPlaceholder"
            autocomplete="off"
            spellcheck="false"
            :disabled="disabled"
            @input="handleRecoveryKeyInput"
            @keyup.enter="emitSubmit"
          />
          <PasswordInput
            v-else
            :model-value="password"
            :placeholder="t('e2ee.enterPassword')"
            autocomplete="current-password"
            :disabled="disabled"
            @update:model-value="handlePasswordUpdate"
            @keyup.enter="emitSubmit"
          />
        </div>
        <div class="unlock-switch-row">
          <button type="button" class="unlock-link-button" :disabled="disabled" @click="handleSwitchMode">
            {{ isRecoveryMode ? t('e2ee.usePassword') : t('e2ee.unlockRecoveryLink') }}
          </button>
          <button v-if="!isRecoveryMode" type="button" class="unlock-link-button secondary-link" :disabled="disabled"
            @click="emit('switch-mode', 'reset-password')">
            {{ t('e2ee.dialog.resetPasswordTitle') }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import PasswordInput from '@renderer/features/settings/components/PasswordInput.vue';

type UnlockMode = 'unlock' | 'recovery';

interface Props {
  mode: UnlockMode;
  password: string;
  recoveryKey: string;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
});

const emit = defineEmits<{
  (e: 'update:password', value: string): void;
  (e: 'update:recoveryKey', value: string): void;
  (e: 'switch-mode', mode: UnlockMode | 'reset-password'): void;
  (e: 'submit'): void;
}>();

const { t } = useI18n();

const isRecoveryMode = computed(() => props.mode === 'recovery');
const recoveryKeyPlaceholder = 'ABCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ';

function handlePasswordUpdate(value: string): void {
  emit('update:password', value);
}

function handleRecoveryKeyInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  emit('update:recoveryKey', target.value);
}

function handleSwitchMode(): void {
  emit('switch-mode', isRecoveryMode.value ? 'unlock' : 'recovery');
}

function emitSubmit(): void {
  emit('submit');
}
</script>

<style scoped>
.unlock-card {
  gap: 0.75rem;
}

.unlock-copy {
  width: 100%;
}

.unlock-content {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  width: 100%;
}

.unlock-input-copy {
  margin-top: 0.2rem;
}

.unlock-input-container {
  width: 100%;
  min-width: 0;
}

.unlock-switch-row {
  margin-top: 0.1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.unlock-link-button {
  border: none;
  background: transparent;
  padding: 0;
  color: var(--accent);
  font-size: 0.84rem;
  line-height: 1.4;
  cursor: pointer;
}

.unlock-link-button.secondary-link {
  color: #64748b;
}

.unlock-link-button:hover:not(:disabled) {
  color: var(--accent);
  text-decoration: underline;
}

.unlock-link-button.secondary-link:hover:not(:disabled) {
  color: #475569;
}

.unlock-link-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 720px) {
  .unlock-switch-row {
    margin-top: 0;
  }
}
</style>
