<template>
  <div class="appearance-settings">
    <h3 class="panel-title">{{ pageTitle }}</h3>

    <div class="appearance-config-content">
      <component :is="currentViewComponent" :key="activeView" @back="handleBack"
        @edit-trusted-hosts="handleEditTrustedHosts" />
    </div>

    <div v-if="activeView !== 'dashboard'" class="appearance-footer">
      <div class="footer-buttons">
        <button class="action-button secondary" @click="handleBack">
          {{ t('dialog.cancel') }}
        </button>
        <button class="action-button primary" @click="handleBack">
          {{ t('dialog.ok') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import PreviewSettingsDashboard from './preview/PreviewSettingsDashboard.vue';
import TrustedHostsConfig from './preview/TrustedHostsConfig.vue';

const { t } = useI18n();

const activeView = ref<'dashboard' | 'trusted-hosts'>('dashboard');

const pageTitle = computed(() => {
  if (activeView.value === 'trusted-hosts') {
    return t('label.previewTrustedSources');
  }
  return t('pref.pane.preview');
});

const currentViewComponent = computed(() => {
  if (activeView.value === 'trusted-hosts') {
    return TrustedHostsConfig;
  }
  return PreviewSettingsDashboard;
});

const handleEditTrustedHosts = () => {
  activeView.value = 'trusted-hosts';
};

const handleBack = () => {
  activeView.value = 'dashboard';
};
</script>

<style scoped>
.appearance-settings {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.appearance-config-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.appearance-footer {
  margin-top: auto;
  padding-top: 20px;
  flex-shrink: 0;
}

.footer-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
