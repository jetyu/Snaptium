<template>
  <div class="activation-view">
    <div class="title-group">
      <h2 class="title">{{ t('license.activation.title') }}</h2>
      <p class="description">{{ t('license.activation.description') }}</p>
    </div>

    <section class="feature-list">
      <p class="feature-title">{{ t('license.activation.featuresTitle') }}</p>
      <ul class="feature-items">
        <li>{{ t('license.feature.aiSources') }}</li>
        <li>{{ t('license.feature.aiAssistant') }}</li>
        <li>{{ t('license.feature.rag') }}</li>
        <li>{{ t('license.feature.sync') }}</li>
      </ul>
    </section>

    <label class="field">
      <span class="field-label">{{ t('license.activation.inputLabel') }}</span>
      <input
        ref="licenseKeyInputRef"
        v-model="licenseKey"
        type="text"
        class="settings-input license-key-input"
        :placeholder="t('license.activation.placeholder')"
        autocomplete="off"
      />
    </label>

    <div class="action-row">
      <button
        type="button"
        class="action-button primary license-btn activate-btn"
        :disabled="isSubmitting || licenseKey.trim().length === 0"
        @click="handleActivate"
      >
        <span v-if="isSubmitting" class="spinner small"></span>
        <span v-else>{{ t('license.activation.button') }}</span>
      </button>
      <a
        class="action-button secondary license-btn buy-btn"
        :href="LICENSE_PURCHASE_URL"
        target="_blank"
        rel="noopener noreferrer nofollow"
      >
        {{ t('license.activation.purchase') }}
      </a>
    </div>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { licenseService, normalizeLicenseErrorMessage } from '../services/license.service';

const { t } = useI18n();
const LICENSE_PURCHASE_URL = 'https://snaptium.com';
const licenseKey = ref('');
const licenseKeyInputRef = ref<HTMLInputElement | null>(null);
const isSubmitting = ref(false);
const errorMessage = ref('');

async function focusInput(): Promise<void> {
  await nextTick();
  licenseKeyInputRef.value?.focus();
  licenseKeyInputRef.value?.select();
}

defineExpose({
  focusInput,
});

onMounted(() => {
  void focusInput();
});

async function handleActivate(): Promise<void> {
  if (isSubmitting.value || licenseKey.value.trim().length === 0) {
    return;
  }

  isSubmitting.value = true;
  errorMessage.value = '';
  try {
    await licenseService.activate(licenseKey.value);
    licenseKey.value = '';
  } catch (error) {
    errorMessage.value = normalizeLicenseErrorMessage(error);
    await focusInput();
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<style scoped>
.activation-view {
  display: flex;
  flex-direction: column;
  gap: 14px;
  border: 1px solid #e7eaf0;
  border-radius: 10px;
  padding: 14px;
  background: #fbfbfc;
}

.title-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.title {
  margin: 0;
  font-size: 1.24rem;
  line-height: 1.2;
}

.description {
  margin: 0;
  color: #475569;
  font-size: 0.93rem;
}

.feature-list {
  border: 1px solid #e7eaf0;
  background: #ffffff;
  border-radius: 8px;
  padding: 12px;
}

.feature-title {
  margin: 0 0 8px 0;
  font-weight: 600;
  color: #111827;
  font-size: 0.88rem;
}

.feature-items {
  margin: 0;
  padding-left: 18px;
  color: #334155;
}

.feature-items li {
  margin: 0 0 4px 0;
}

.feature-items li:last-child {
  margin-bottom: 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 0.86rem;
  color: #334155;
  font-weight: 600;
}

.license-key-input {
  height: 36px;
  border-radius: 8px;
  border-color: #c9d1dc;
  background: #ffffff;
  font-size: 0.9rem;
}

.license-key-input:focus {
  border-color: #7aa7ff;
  box-shadow: 0 0 0 3px rgba(122, 167, 255, 0.2);
}

.action-row {
  display: flex;
  gap: 8px;
}

.activate-btn,
.buy-btn {
  flex: 1 1 0;
  min-width: 0;
  justify-content: center;
}

.buy-btn {
  text-decoration: none;
}

@media (max-width: 640px) {
  .action-row {
    flex-direction: column;
  }
}

.error {
  margin: 0;
  color: #be123c;
  font-size: 0.85rem;
  border: 1px solid #fecaca;
  border-radius: 8px;
  background: #fff1f2;
  padding: 8px 10px;
}
</style>
