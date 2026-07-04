<template>
  <header class="app-window-frame" :class="{ 'is-maximized': isMaximized }" @dblclick="handleDoubleClickTitle">
    <div class="app-window-frame__drag-region">
      <div class="app-window-frame__brand">
        <img src="@assets/logo/app-logo-32.png" class="app-window-frame__logo" :alt="appTitle" />
        <span class="app-window-frame__title">{{ appTitle }}</span>
      </div>
      <div class="app-window-frame__menu-container">
        <AppMenuBar />
      </div>
      <div class="app-window-frame__search-container">
        <AppTitleBarSearch />
      </div>
      <div class="app-window-frame__license-container">
        <LicenseBadge />
      </div>
    </div>

    <div class="app-window-frame__controls no-drag">
      <button type="button" class="app-window-frame__control-btn" :title="t('menu.window.minimize')"
        :aria-label="t('menu.window.minimize')" @click.stop="handleMinimize">
        <IconMinus :size="14" />
      </button>
      <button type="button" class="app-window-frame__control-btn"
        :title="isMaximized ? t('menu.window') : t('menu.window')"
        :aria-label="isMaximized ? t('menu.window') : t('menu.window')" @click.stop="handleToggleMaximize">
        <IconSquare v-if="!isMaximized" :size="13" />
        <IconCopy v-else :size="13" />
      </button>
      <button type="button" class="app-window-frame__control-btn is-close" :title="t('menu.window.close')"
        :aria-label="t('menu.window.close')" @click.stop="handleClose">
        <IconX :size="14" />
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { IconX, IconMinus, IconSquare, IconCopy } from '@tabler/icons-vue';
import { electronApi } from '@renderer/core/bridge/electronApi';
import AppMenuBar from './AppMenuBar.vue';
import AppTitleBarSearch from './AppTitleBarSearch.vue';
import { LicenseBadge } from '@renderer/features/license';

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
  --window-control-hover-bg: color-mix(in srgb, var(--text) 8%, transparent);
  --window-control-hover-border: color-mix(in srgb, var(--text-muted) 24%, transparent);
  --window-control-active-bg: color-mix(in srgb, var(--text) 13%, transparent);
  --window-control-active-border: color-mix(in srgb, var(--text-muted) 28%, transparent);
  position: relative;
  z-index: 50;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: stretch;
  height: var(--window-frame-height);
  padding-left: 10px;
  padding-right: 6px;
  border-bottom: 1px solid color-mix(in srgb, var(--panel-border) 90%, transparent);
  background: color-mix(in srgb, var(--panel) 96%, var(--surface-subtle));
  transition: padding 0.18s ease, border-color 0.18s ease, background-color 0.18s ease;
}

[data-theme='dark'] .app-window-frame {
  --window-control-hover-bg: color-mix(in srgb, #ffffff 10%, transparent);
  --window-control-hover-border: color-mix(in srgb, #ffffff 20%, transparent);
  --window-control-active-bg: color-mix(in srgb, #ffffff 16%, transparent);
  --window-control-active-border: color-mix(in srgb, #ffffff 24%, transparent);
  background: color-mix(in srgb, var(--panel) 96%, var(--surface-subtle));
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
  gap: 10px;
  padding-right: 14px;
  margin-right: 6px;
  border-right: 1px solid color-mix(in srgb, var(--panel-border) 40%, transparent);
}

.app-window-frame__logo {
  width: 22px;
  height: 22px;
  object-fit: contain;
}

.app-window-frame__title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
  font-size: 0.9rem;
  font-weight: 720;
  letter-spacing: 0;
  opacity: 0.95;
  transition: opacity 0.18s ease;
}

.app-window-frame__title:hover {
  opacity: 1;
}

.app-window-frame__menu-container {
  display: flex;
  align-items: center;
  height: 100%;
  padding-left: 4px;
}

.app-window-frame__search-container {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 100%;
  padding: 0 20px;
}

.app-window-frame__license-container {
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
  margin-right: 10px;
}

.app-window-frame__controls {
  -webkit-app-region: no-drag;
  display: inline-flex;
  align-items: stretch;
  gap: 2px;
  padding-right: 2px;
}

.app-window-frame__control-btn {
  width: 38px;
  height: 32px;
  margin-top: 4px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: color-mix(in srgb, var(--text-muted) 90%, var(--text));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    background-color 0.14s ease,
    border-color 0.14s ease,
    color 0.14s ease,
    transform 0.12s ease,
    box-shadow 0.14s ease;
  outline: none;
  box-shadow: inset 0 0 0 1px transparent;
}

.app-window-frame__control-btn:hover {
  background: var(--window-control-hover-bg);
  border-color: var(--window-control-hover-border);
  color: var(--text);
}

.app-window-frame__control-btn:active {
  background: var(--window-control-active-bg);
  border-color: var(--window-control-active-border);
  transform: scale(0.96);
  box-shadow: none;
}

.app-window-frame__control-btn:focus-visible {
  border-color: color-mix(in srgb, var(--accent) 34%, transparent);
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--accent) 26%, transparent),
    inset 0 1px 0 color-mix(in srgb, #ffffff 42%, transparent);
}

.app-window-frame__control-btn.is-close:hover {
  background: #e81123;
  border-color: #e81123;
  color: #fff;
  box-shadow: none;
}

.app-window-frame__control-btn.is-close:active {
  background: #c50f1f;
  border-color: #c50f1f;
  color: #fff;
  transform: scale(0.97);
}

[data-theme='dark'] .app-window-frame__control-btn:hover {
  box-shadow: none;
}

[data-theme='dark'] .app-window-frame__control-btn:active {
  box-shadow: none;
}

.app-window-frame.is-maximized {
  padding-left: 6px;
  padding-right: 2px;
  border-bottom-color: color-mix(in srgb, var(--panel-border) 76%, transparent);
  background: color-mix(in srgb, var(--panel) 96%, var(--surface-subtle));
}

[data-theme='dark'] .app-window-frame.is-maximized {
  background: color-mix(in srgb, var(--panel) 96%, var(--surface-subtle));
}
</style>
