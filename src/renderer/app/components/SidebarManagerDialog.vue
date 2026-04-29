<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="isSidebarManagerOpen" ref="overlayRef" class="sidebar-manager-overlay" tabindex="0"
        @click.self="closeSidebarManager" @keydown.esc="closeSidebarManager">
        <section class="sidebar-manager-dialog" @click.stop>
          <header class="sidebar-manager-dialog__header">
            <div>
              <h2>{{ t('label.sidebarConfig') }}</h2>
              <p class="sidebar-manager-dialog__intro">{{ t('appShell.sidebarManager.intro') }}</p>
            </div>
            <button type="button" class="sidebar-manager-dialog__close" :aria-label="t('common.close')"
              @click="closeSidebarManager">
              <Close theme="outline" :size="18" />
            </button>
          </header>

          <div class="sidebar-manager-dialog__body">
            <section class="sidebar-manager-dialog__section">
              <div class="sidebar-manager-dialog__layout-grid">
                <div class="sidebar-manager-dialog__panel">
                  <div class="sidebar-manager-dialog__section-head">
                    <p class="sidebar-manager-dialog__section-title">{{ t('appShell.sidebarManager.preview') }}</p>
                    <span class="sidebar-manager-dialog__meta">
                      {{ enabledCustomModuleIds.length }}/{{ maxCustomModules }}
                    </span>
                  </div>
                  <div class="sidebar-manager-dialog__preview-shell">
                    <div class="sidebar-manager-dialog__preview-rail">
                      <!-- 固定视图区 -->
                      <div class="sidebar-manager-dialog__preview-group">
                        <button v-for="view in mainViews" :key="view.id" type="button"
                          class="sidebar-manager-dialog__preview-button sidebar-manager-dialog__preview-button--view is-active">
                          <component :is="getMainViewIcon(view.id)" theme="outline" :size="18" />
                        </button>
                      </div>

                      <!-- 分隔线 -->
                      <div class="sidebar-manager-dialog__preview-divider"></div>

                      <!-- 可选模块区 -->
                      <div class="sidebar-manager-dialog__preview-group sidebar-manager-dialog__preview-group--grow">
                        <div v-for="module in enabledCustomModules" :key="module.id"
                          class="sidebar-manager-dialog__preview-module">
                          <button type="button" class="sidebar-manager-dialog__preview-remove"
                            :aria-label="t('appShell.sidebarManager.removeModule', { module: t(module.labelKey) })"
                            @click="removeFromPreview(module.id)">
                            <Minus theme="outline" :size="14" />
                          </button>
                          <button type="button" class="sidebar-manager-dialog__preview-button is-module">
                            <component :is="getModuleIcon(module.id)" theme="outline" :size="18" />
                          </button>
                        </div>
                        <div v-for="slot in previewPlaceholderCount" :key="`placeholder-${slot}`"
                          class="sidebar-manager-dialog__preview-module sidebar-manager-dialog__preview-module--placeholder">
                          <div class="sidebar-manager-dialog__preview-placeholder">
                            <span>{{ t('appShell.sidebarManager.emptySlot') }}</span>
                          </div>
                        </div>
                      </div>

                      <!-- 底部管理按钮 -->
                      <button type="button"
                        class="sidebar-manager-dialog__preview-button sidebar-manager-dialog__preview-button--manage">
                        <SettingConfig theme="outline" :size="18" />
                      </button>
                    </div>
                  </div>
                </div>

                <div class="sidebar-manager-dialog__panel">
                  <div class="sidebar-manager-dialog__section-head">
                    <p class="sidebar-manager-dialog__section-title">{{ t('appShell.sidebarManager.modules') }}</p>
                    <span class="sidebar-manager-dialog__meta">
                      {{ customModules.length }}
                    </span>
                  </div>
                  <p class="sidebar-manager-dialog__section-description">
                    {{ t('appShell.sidebarManager.modulesHint') }}
                  </p>

                  <div class="sidebar-manager-dialog__module-list">
                    <article v-for="module in customModules" :key="module.id"
                      class="sidebar-manager-dialog__module-card" :class="{ 'is-active': isModuleEnabled(module.id) }">
                      <div class="sidebar-manager-dialog__module-icon">
                        <component :is="getModuleIcon(module.id)" theme="outline" :size="18" />
                      </div>
                      <div class="sidebar-manager-dialog__module-copy">
                        <strong>{{ t(module.labelKey) }}</strong>
                      </div>
                      <button v-if="!isModuleEnabled(module.id)" type="button"
                        class="sidebar-manager-dialog__module-action" :disabled="hasReachedCustomModuleLimit"
                        :aria-label="t('appShell.sidebarManager.addModule', { module: t(module.labelKey) })"
                        @click="addToPreview(module.id)">
                        <Plus theme="outline" :size="16" />
                      </button>
                      <button v-else type="button" class="sidebar-manager-dialog__module-action is-remove"
                        :aria-label="t('appShell.sidebarManager.removeModule', { module: t(module.labelKey) })"
                        @click="removeFromPreview(module.id)">
                        <Minus theme="outline" :size="16" />
                      </button>
                    </article>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { Close, ApplicationOne, Plus, Minus, Search, SettingTwo, Delete, Info, NotebookOne, SettingConfig } from '@icon-park/vue-next';
import { useI18n } from 'vue-i18n';
import type { AppShellMainViewId, AppShellModuleId } from '../constants/appShell.constants';
import { useSidebarManager } from '../composables/useSidebarManager';
import { useAppShellStore } from '../store/appShell.store';

const overlayRef = ref<HTMLElement | null>(null);
const { t } = useI18n();
const { isSidebarManagerOpen, closeSidebarManager } = useSidebarManager();
const appShellStore = useAppShellStore();
const {
  mainViews,
  customModules,
  enabledCustomModules,
  enabledCustomModuleIds,
  maxCustomModules,
  hasReachedCustomModuleLimit,
} = storeToRefs(appShellStore);

const { enableCustomModule, disableCustomModule } = appShellStore;
const previewPlaceholderCount = computed(() => {
  return Math.max(0, maxCustomModules.value - enabledCustomModules.value.length);
});

const mainViewIconMap: Record<AppShellMainViewId, typeof NotebookOne> = {
  workbench: ApplicationOne,
  workspace: NotebookOne,
};

const moduleIconMap: Record<AppShellModuleId, typeof Search> = {
  search: Search,
  settings: SettingTwo,
  trash: Delete,
  about: Info,
};

function getMainViewIcon(viewId: AppShellMainViewId) {
  return mainViewIconMap[viewId] ?? NotebookOne;
}

function getModuleIcon(moduleId: AppShellModuleId) {
  return moduleIconMap[moduleId] ?? Search;
}

function isModuleEnabled(moduleId: AppShellModuleId) {
  return enabledCustomModuleIds.value.includes(moduleId);
}

async function addToPreview(moduleId: AppShellModuleId) {
  if (hasReachedCustomModuleLimit.value) {
    return;
  }

  await enableCustomModule(moduleId);
}

async function removeFromPreview(moduleId: AppShellModuleId) {
  await disableCustomModule(moduleId);
}

watch(isSidebarManagerOpen, async (open) => {
  if (!open) {
    return;
  }

  await nextTick();
  overlayRef.value?.focus();
});
</script>

<style scoped>
.sidebar-manager-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
}

.sidebar-manager-dialog {
  width: min(640px, calc(100vw - 32px));
  max-height: calc(100vh - 48px);
  overflow: auto;
  border: 1px solid var(--panel-border);
  border-radius: 20px;
  background: var(--panel);
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.18);
}

.sidebar-manager-dialog__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 22px;
  border-bottom: 1px solid var(--panel-border);
}

.sidebar-manager-dialog__eyebrow {
  margin: 0 0 6px;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.sidebar-manager-dialog__header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.sidebar-manager-dialog__intro {
  margin: 8px 0 0;
  color: var(--text-muted);
  font-size: 0.88rem;
  line-height: 1.5;
  max-width: 420px;
}

.sidebar-manager-dialog__close {
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  padding: 6px;
  border-radius: 10px;
}

.sidebar-manager-dialog__close:hover {
  color: var(--text);
  background: var(--panel-hover);
}

.sidebar-manager-dialog__body {
  display: grid;
  gap: 20px;
  padding: 22px;
}

.sidebar-manager-dialog__section {
  display: grid;
  gap: 14px;
}

.sidebar-manager-dialog__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.sidebar-manager-dialog__section-title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
}

.sidebar-manager-dialog__section-description {
  margin: -4px 0 0;
  color: var(--text-muted);
  font-size: 0.82rem;
  line-height: 1.45;
}

.sidebar-manager-dialog__meta {
  color: var(--text-muted);
  font-size: 0.85rem;
}

.sidebar-manager-dialog__layout-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.sidebar-manager-dialog__panel {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.sidebar-manager-dialog__panel:first-child {
  grid-column: 1;
}

.sidebar-manager-dialog__panel:last-child {
  grid-column: 2 / span 2;
}

.sidebar-manager-dialog__preview-shell {
  display: flex;
  justify-content: center;
}

.sidebar-manager-dialog__preview-rail {
  width: 68px;
  height: 360px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  padding: 10px 8px;
  border-radius: 18px;
  background: color-mix(in srgb, var(--panel-hover) 72%, white);
  border: 1px solid color-mix(in srgb, var(--accent) 12%, var(--panel-border));
}

.sidebar-manager-dialog__preview-divider {
  width: 28px;
  height: 1px;
  margin: 8px 0;
  background: color-mix(in srgb, var(--accent) 18%, var(--panel-border));
  flex-shrink: 0;
}

.sidebar-manager-dialog__preview-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  align-items: center;
}

.sidebar-manager-dialog__preview-group--grow {
  flex: 1;
  justify-content: flex-start;
}

.sidebar-manager-dialog__preview-module {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  width: 100%;
  height: 36px;
}

.sidebar-manager-dialog__preview-module--placeholder {
  justify-content: center;
}

.sidebar-manager-dialog__preview-placeholder {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px dashed color-mix(in srgb, var(--accent) 28%, var(--panel-border));
  background: color-mix(in srgb, var(--panel) 70%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar-manager-dialog__preview-placeholder span {
  font-size: 0.52rem;
  color: var(--text-muted);
  letter-spacing: 0.04em;
}

.sidebar-manager-dialog__preview-button {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.sidebar-manager-dialog__preview-button.is-active,
.sidebar-manager-dialog__preview-button.is-module {
  color: var(--accent-hover);
  background: color-mix(in srgb, var(--accent) 12%, var(--panel));
  border-color: color-mix(in srgb, var(--accent) 24%, var(--panel-border));
}

.sidebar-manager-dialog__preview-button--manage {
  margin-top: 8px;
  flex-shrink: 0;
}

.sidebar-manager-dialog__preview-button--view {
  cursor: default;
  pointer-events: none;
}

.sidebar-manager-dialog__preview-remove {
  position: absolute;
  top: -6px;
  right: 4px;
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 999px;
  background: #fff1f2;
  color: #be123c;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.12);
}

.sidebar-manager-dialog__preview-label {
  width: 100%;
  font-size: 0.62rem;
  color: var(--text-muted);
  text-align: center;
  line-height: 1.15;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.sidebar-manager-dialog__module-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.sidebar-manager-dialog__module-card {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 56px;
  padding: 10px 12px;
  border: 1px solid var(--panel-border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel) 92%, white);
  transition: border-color 0.18s ease, background-color 0.18s ease, transform 0.18s ease;
}

.sidebar-manager-dialog__module-card:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent) 18%, var(--panel-border));
}

.sidebar-manager-dialog__module-card.is-active {
  border-color: color-mix(in srgb, var(--accent) 30%, var(--panel-border));
  background: color-mix(in srgb, var(--accent) 7%, var(--panel));
}

.sidebar-manager-dialog__module-icon {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  background: color-mix(in srgb, var(--accent) 10%, var(--panel));
  color: var(--accent-hover);
  flex-shrink: 0;
}

.sidebar-manager-dialog__module-copy {
  width: 100%;
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.sidebar-manager-dialog__module-card strong {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.25;
  text-align: left;
  word-break: break-word;
}

.sidebar-manager-dialog__module-action {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 7px;
  background: color-mix(in srgb, var(--accent) 14%, var(--panel));
  color: var(--accent-hover);
  cursor: pointer;
  transition: opacity 0.18s ease, transform 0.18s ease, background-color 0.18s ease;
  align-self: flex-end;
  flex-shrink: 0;
}

.sidebar-manager-dialog__module-action:hover:not(:disabled) {
  transform: translateY(-1px);
  background: color-mix(in srgb, var(--accent) 20%, var(--panel));
}

.sidebar-manager-dialog__module-action.is-remove {
  background: rgba(244, 63, 94, 0.08);
  color: #e11d48;
}

.sidebar-manager-dialog__module-action.is-remove:hover:not(:disabled) {
  background: rgba(244, 63, 94, 0.14);
}

.sidebar-manager-dialog__module-action:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@media (max-width: 760px) {
  .sidebar-manager-dialog__layout-grid {
    grid-template-columns: 1fr;
  }

  .sidebar-manager-dialog__panel:first-child,
  .sidebar-manager-dialog__panel:last-child {
    grid-column: auto;
  }

  .sidebar-manager-dialog__module-list {
    grid-template-columns: 1fr;
  }

  .sidebar-manager-dialog__preview-shell {
    display: flex;
    justify-content: center;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
