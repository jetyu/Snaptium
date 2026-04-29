<template>
  <div class="settings-subview">
    <h3 class="panel-title">{{ pageTitle }}</h3>

    <div class="settings-subview-content">
      <component :is="currentViewComponent" :key="activeView" @back="handleBack"
        @edit-trusted-hosts="handleEditTrustedHosts" />
    </div>

    <div v-if="activeView !== 'dashboard'" class="settings-subview-footer">
      <div class="settings-subview-footer-buttons">
        <button class="action-button secondary" @click="handleBack">
          {{ t('button.cancel') }}
        </button>
        <button class="action-button primary" @click="handleBack">
          {{ t('button.confirm') }}
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
