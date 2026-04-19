<template>
  <div class="preview-dashboard">
    <div class="settings-grid">
      <div class="settings-row-grid">
        <section class="setting-card">
          <div class="setting-copy">
            <p class="setting-label">{{ t('label.previewFontSize') }}</p>
            <p class="setting-description">{{ t('text.previewFontSize') }}</p>
          </div>
          <div class="number-input-container">
            <input type="number" class="settings-input number-input"
              :value="settingsStore.config.previewAppearance.fontSize" @change="handleFontSizeChange" min="10" max="32"
              step="1" />
          </div>
        </section>

        <section class="setting-card">
          <div class="setting-copy">
            <p class="setting-label">{{ t('label.previewFont') }}</p>
            <p class="setting-description">{{ t('text.previewFont') }}</p>
          </div>
          <label class="select-shell">
            <select class="settings-select" :value="settingsStore.config.previewAppearance.fontFamily"
              @change="handleFontChange">
              <option v-for="font in fontOptions" :key="font.id" :value="font.value">
                {{ font.label }}
              </option>
            </select>
          </label>
        </section>
      </div>
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.previewAllowHtml') }}</p>
          <p class="setting-description">{{ t('text.previewAllowHtml') }}</p>
        </div>
        <button type="button" class="startup-switch"
          :class="{ enabled: settingsStore.config.previewAppearance.allowHtml }"
          :aria-pressed="settingsStore.config.previewAppearance.allowHtml" @click="togglePreviewSetting('allowHtml')">
          <span class="startup-switch-track">
            <span class="startup-switch-thumb" />
          </span>
          <span class="startup-switch-text">
            {{ settingsStore.config.previewAppearance.allowHtml ? t('checkbox.status.enabled') :
              t('checkbox.status.disabled') }}
          </span>
        </button>
      </section>

      <!-- SVG 渲染开关 -->
      <section class="setting-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.previewAllowInlineSvg') }}</p>
          <p class="setting-description">{{ t('text.previewAllowInlineSvg') }}</p>
        </div>
        <button type="button" class="startup-switch"
          :class="{ enabled: settingsStore.config.previewAppearance.allowInlineSvg }"
          :aria-pressed="settingsStore.config.previewAppearance.allowInlineSvg"
          :disabled="!settingsStore.config.previewAppearance.allowHtml" @click="togglePreviewSetting('allowInlineSvg')">
          <span class="startup-switch-track">
            <span class="startup-switch-thumb" />
          </span>
          <span class="startup-switch-text">
            {{ settingsStore.config.previewAppearance.allowInlineSvg ? t('checkbox.status.enabled') :
              t('checkbox.status.disabled') }}
          </span>
        </button>
      </section>

      <!-- 远程图片配置 -->
      <section class="setting-card entry-card">
        <div class="setting-copy">
          <p class="setting-label">{{ t('label.previewRemoteImages') }}</p>
          <p class="setting-description">
            {{ dynamicDescription }}
          </p>
        </div>

        <div class="mode-control">
          <label class="select-shell">
            <select class="settings-select" :value="settingsStore.config.previewAppearance.remoteImageMode"
              @change="handleRemoteImageModeChange">
              <option value="blocked">{{ t('option.previewRemoteImages.blocked') }}</option>
              <option value="trusted">{{ t('option.previewRemoteImages.trusted') }}</option>
              <option value="all">{{ t('option.previewRemoteImages.all') }}</option>
            </select>
          </label>

          <button class="nav-btn" :disabled="settingsStore.config.previewAppearance.remoteImageMode !== 'trusted'"
            @click="emit('edit-trusted-hosts')" :title="t('label.previewTrustedSources')">
            <edit theme="outline" size="16" />
          </button>
        </div>
      </section>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Edit } from '@icon-park/vue-next';
import { useSettingsStore, type PreviewAppearanceSettings } from '../../../store/settings.store';
import fontProvider from '@renderer/config/font-provider.json';

const { t } = useI18n();
const settingsStore = useSettingsStore();

const fontOptions = fontProvider;

const emit = defineEmits(['edit-trusted-hosts']);

const dynamicDescription = computed(() => {
  const mode = settingsStore.config.previewAppearance.remoteImageMode;
  return t(`text.previewRemoteImages.${mode}`);
});

const togglePreviewSetting = async (key: 'allowHtml' | 'allowInlineSvg') => {
  await settingsStore.updatePreviewAppearanceSetting(
    key,
    !settingsStore.config.previewAppearance[key] as PreviewAppearanceSettings[typeof key],
  );
};

const handleRemoteImageModeChange = async (event: Event) => {
  const target = event.target as HTMLSelectElement;
  await settingsStore.updatePreviewAppearanceSetting(
    'remoteImageMode',
    target.value as PreviewAppearanceSettings['remoteImageMode'],
  );
};

const handleFontSizeChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const val = parseInt(target.value, 10);
  if (!isNaN(val) && val >= 10 && val <= 32) {
    await settingsStore.updatePreviewAppearanceSetting('fontSize', val);
  }
};

const handleFontChange = async (event: Event) => {
  const target = event.target as HTMLSelectElement;
  await settingsStore.updatePreviewAppearanceSetting('fontFamily', target.value);
};
</script>

<style scoped>
.preview-dashboard {
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

.mode-control {
  display: flex;
  align-items: center;
  gap: 12px;
}

.select-shell.wide {
  min-width: 200px;
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: #eff6ff;
  border: 1px solid #bfd3ff;
  border-radius: 8px;
  color: #0f6cbd;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.nav-btn:hover:not(:disabled) {
  background: #dbeafe;
  border-color: #7aa7ff;
}

.nav-btn:disabled {
  background: #f3f4f6;
  border-color: #e5e7eb;
  color: #9ca3af;
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
