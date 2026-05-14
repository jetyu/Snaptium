<template>
  <header class="app-window-frame" :class="{ 'is-maximized': isMaximized }" @dblclick="handleDoubleClickTitle">
    <div class="app-window-frame__drag-region">
      <div class="app-window-frame__brand">
        <div class="app-window-frame__brand-dot" aria-hidden="true"></div>
        <span class="app-window-frame__title">{{ appTitle }}</span>
      </div>
    </div>

    <div class="app-window-frame__controls no-drag">
      <button type="button" class="app-window-frame__control-btn" :title="t('menu.window.minimize')"
        :aria-label="t('menu.window.minimize')" @click.stop="handleMinimize">
        <Minus theme="outline" :size="14" />
      </button>
      <button type="button" class="app-window-frame__control-btn"
        :title="isMaximized ? t('menu.window') : t('menu.window')"
        :aria-label="isMaximized ? t('menu.window') : t('menu.window')" @click.stop="handleToggleMaximize">
        <Square v-if="!isMaximized" theme="outline" :size="13" />
        <Copy v-else theme="outline" :size="13" />
      </button>
      <button type="button" class="app-window-frame__control-btn is-close" :title="t('menu.window.close')"
        :aria-label="t('menu.window.close')" @click.stop="handleClose">
        <Close theme="outline" :size="14" />
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Close, Minus, Square, Copy } from '@icon-park/vue-next';
import { electronApi } from '@renderer/core/bridge/electronApi';

const { t } = useI18n();
const appTitle = ref<string>(t('common.appName'));
const isMaximized = ref<boolean>(false);

let removeWindowStateListener: (() => void) | null = null;

async function syncWindowState(): Promise<void> {
  if (!electronApi.window.isAvailable()) {
    return;
  }
  isMaximized.value = await electronApi.window.isMaximized();
}

async function syncWindowTitle(): Promise<void> {
  if (!electronApi.app.isAvailable()) {
    return;
  }
  const name = await electronApi.app.getName();
  appTitle.value = name || appTitle.value;
}

async function handleMinimize(): Promise<void> {
  if (!electronApi.window.isAvailable()) {
    return;
  }
  await electronApi.window.minimize();
}

async function handleToggleMaximize(): Promise<void> {
  if (!electronApi.window.isAvailable()) {
    return;
  }
  if (isMaximized.value) {
    await electronApi.window.unmaximize();
  } else {
    await electronApi.window.maximize();
  }
}

async function handleClose(): Promise<void> {
  if (!electronApi.window.isAvailable()) {
    return;
  }
  await electronApi.window.close();
}

async function handleDoubleClickTitle(): Promise<void> {
  await handleToggleMaximize();
}

onMounted(async () => {
  await syncWindowTitle();
  await syncWindowState();

  if (electronApi.window.isAvailable()) {
    removeWindowStateListener = electronApi.window.onStateChanged((payload) => {
      isMaximized.value = payload.isMaximized;
    });
  }
});

onBeforeUnmount(() => {
  if (removeWindowStateListener) {
    removeWindowStateListener();
    removeWindowStateListener = null;
  }
});
</script>

<style scoped>
.app-window-frame {
  --window-frame-height: 40px;
  position: relative;
  z-index: 50;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: stretch;
  height: var(--window-frame-height);
  padding-left: 10px;
  padding-right: 6px;
  border-bottom: 1px solid color-mix(in srgb, var(--panel-border) 90%, transparent);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--panel) 92%, white), color-mix(in srgb, var(--panel) 98%, transparent)),
    radial-gradient(140% 180% at 16% -30%, rgba(66, 133, 255, 0.16), transparent 58%);
  backdrop-filter: blur(20px) saturate(130%);
}

[data-theme='dark'] .app-window-frame {
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--panel) 96%, black), color-mix(in srgb, var(--panel) 98%, transparent)),
    radial-gradient(140% 180% at 16% -30%, rgba(80, 140, 255, 0.2), transparent 58%);
}

.app-window-frame__drag-region {
  -webkit-app-region: drag;
  display: flex;
  align-items: center;
  min-width: 0;
  user-select: none;
}

.app-window-frame__brand {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  gap: 8px;
}

.app-window-frame__brand-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: linear-gradient(150deg, #58b0ff 0%, #3d7cff 100%);
  box-shadow: 0 0 0 3px rgba(61, 124, 255, 0.12);
  flex-shrink: 0;
}

.app-window-frame__title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: color-mix(in srgb, var(--text) 90%, var(--text-muted));
  font-size: 0.78rem;
  font-weight: 650;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.app-window-frame__controls {
  -webkit-app-region: no-drag;
  display: inline-flex;
  align-items: stretch;
  gap: 4px;
}

.app-window-frame__control-btn {
  width: 38px;
  height: 32px;
  margin-top: 4px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  color: color-mix(in srgb, var(--text-muted) 88%, var(--text));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease;
}

.app-window-frame__control-btn:hover {
  background: color-mix(in srgb, var(--accent) 8%, var(--panel-hover));
  border-color: color-mix(in srgb, var(--accent) 18%, var(--panel-border));
  color: var(--text);
}

.app-window-frame__control-btn.is-close:hover {
  background: rgba(226, 53, 75, 0.14);
  border-color: rgba(226, 53, 75, 0.3);
  color: #d93045;
}

.app-window-frame.is-maximized {
  padding-left: 8px;
  padding-right: 4px;
}
</style>
