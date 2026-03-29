<template>
  <div class="security-settings">
    <h3 class="panel-title">{{ t('paneSecurity') }}</h3>
    <div class="settings-grid">
      <div class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('labelSecurityPlaceholder', 'Security Settings') }}</p>
          <p class="setting-description">Settings placeholders will go here.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
</script>
