<template>
  <div class="settings-fade-in">
    <div class="settings-grid">
      <!-- HTML 渲染开关 -->
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

        <div class="settings-mode-control">
          <label class="select-shell">
            <select class="settings-select" :value="settingsStore.config.previewAppearance.remoteImageMode"
              @change="handleRemoteImageModeChange">
              <option value="blocked">{{ t('option.previewRemoteImages.blocked') }}</option>
              <option value="trusted">{{ t('option.previewRemoteImages.trusted') }}</option>
              <option value="all">{{ t('option.previewRemoteImages.all') }}</option>
            </select>
          </label>

          <button class="settings-nav-btn" :disabled="settingsStore.config.previewAppearance.remoteImageMode !== 'trusted'"
            @click="emit('edit-trusted-hosts')" :title="t('label.previewTrustedSources')">
            <IconPencil :size="16" />
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { IconPencil } from '@tabler/icons-vue';
import { useSettingsStore, type PreviewAppearanceSettings } from '../../../store/settings.store';

const { t } = useI18n();
const settingsStore = useSettingsStore();

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
</script>
