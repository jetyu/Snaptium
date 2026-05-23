<template>
  <div class="activation-view">
    <h2 class="title">{{ t('license.activation.title') }}</h2>
    <p class="description">{{ t('license.activation.description') }}</p>

    <div class="feature-list">
      <p>{{ t('license.activation.featuresTitle') }}</p>
      <ul>
        <li>{{ t('license.feature.aiSources') }}</li>
        <li>{{ t('license.feature.aiAssistant') }}</li>
        <li>{{ t('license.feature.rag') }}</li>
        <li>{{ t('license.feature.sync') }}</li>
      </ul>
    </div>

    <label class="field">
      <span>{{ t('license.activation.inputLabel') }}</span>
      <input
        v-model="licenseKey"
        type="text"
        class="settings-input"
        :placeholder="t('license.activation.placeholder')"
        autocomplete="off"
      />
    </label>

    <button type="button" class="action-button primary" :disabled="isSubmitting || licenseKey.trim().length === 0" @click="handleActivate">
      <span v-if="isSubmitting" class="spinner small"></span>
      <span v-else>{{ t('license.activation.button') }}</span>
    </button>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { getErrorMessage } from '@shared/utils/error.utils';
import { licenseService } from '../services/license.service';

const { t } = useI18n();
const licenseKey = ref('');
const isSubmitting = ref(false);
const errorMessage = ref('');

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
    errorMessage.value = getErrorMessage(error, t('license.activation.failed'));
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<style scoped>
.activation-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.title {
  margin: 0;
  font-size: 1.2rem;
}

.description {
  margin: 0;
  color: #475569;
}

.feature-list {
  border: 1px solid #dbe5f2;
  background: #f7fbff;
  border-radius: 10px;
  padding: 10px 12px;
}

.feature-list p {
  margin: 0 0 8px 0;
  font-weight: 600;
}

.feature-list ul {
  margin: 0;
  padding-left: 18px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.error {
  margin: 0;
  color: #be123c;
  font-size: 0.86rem;
}
</style>

