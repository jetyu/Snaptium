<template>
  <aside class="app-shell-sidebar">
    <div class="app-shell-sidebar__stack">
      <button v-for="view in mainViews" :key="view.id" type="button" class="app-shell-sidebar__button"
        :class="{ 'is-active': activeMainView === view.id }" :title="t(view.labelKey)" :aria-label="t(view.labelKey)"
        @click="$emit('select-main-view', view.id)">
        <component :is="getMainViewIcon(view.id)" :size="18" />
      </button>
    </div>

    <div class="app-shell-sidebar__stack app-shell-sidebar__stack--grow">
      <button v-for="module in customModules" :key="module.id" type="button" class="app-shell-sidebar__button"
        :class="{ 'is-active': isModuleActive(module) }" :title="t(module.labelKey)" :aria-label="t(module.labelKey)"
        @click="$emit('open-module', module.id)">
        <component :is="getModuleIcon(module.id)" :size="18" />
      </button>
    </div>

    <button type="button" class="app-shell-sidebar__button app-shell-sidebar__button--manage"
      :title="t('appShell.sidebarManager.title')" :aria-label="t('appShell.sidebarManager.title')"
      @click="$emit('manage-sidebar')">
      <IconAdjustmentsHorizontal :size="18" />
    </button>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  IconDashboard,
  IconNotebook,
  IconDatabaseSearch,
  IconSettings,
  IconAdjustmentsHorizontal,
  IconTrash,
  IconInfoCircle,
  IconStar,
  IconTag,
} from '@tabler/icons-vue';
import type { AppShellMainViewId, AppShellModuleDefinition, AppShellMainViewDefinition, AppShellModuleId } from '../constants/appShell.constants';

const props = defineProps<{
  activeMainView: AppShellMainViewId;
  mainViews: AppShellMainViewDefinition[];
  customModules: AppShellModuleDefinition[];
}>();

defineEmits<{
  (event: 'select-main-view', viewId: AppShellMainViewId): void;
  (event: 'open-module', moduleId: AppShellModuleId): void;
  (event: 'manage-sidebar'): void;
}>();

const { t } = useI18n();

const mainViewIconMap = computed(() => ({
  workbench: IconDashboard,
  workspace: IconNotebook,
  tags: IconTag,
  favorites: IconStar,
  search: IconDatabaseSearch,
  settings: IconSettings,
}));

const moduleIconMap = computed(() => ({
  favorites: IconStar,
  tags: IconTag,
  search: IconDatabaseSearch,
  settings: IconSettings,
  trash: IconTrash,
  about: IconInfoCircle,
}));

function getMainViewIcon(viewId: AppShellMainViewId) {
  return mainViewIconMap.value[viewId] ?? IconNotebook;
}

function getModuleIcon(moduleId: AppShellModuleId) {
  return moduleIconMap.value[moduleId] ?? IconNotebook;
}

function isModuleActive(module: AppShellModuleDefinition) {
  return module.presentation === 'view' && module.viewId === props.activeMainView;
}
</script>

<style scoped>
.app-shell-sidebar {
  width: 56px;
  min-width: 56px;
  max-width: 56px;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 10px 8px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--panel) 94%, white), var(--panel)),
    var(--panel);
  border-right: 1px solid var(--panel-border);
}

.app-shell-sidebar__stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.app-shell-sidebar__stack--grow {
  flex: 1;
}

.app-shell-sidebar__button {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.app-shell-sidebar__button:hover {
  color: var(--text);
  background: var(--panel-hover);
  border-color: color-mix(in srgb, var(--accent) 14%, var(--panel-border));
}

.app-shell-sidebar__button.is-active {
  color: var(--accent-hover);
  background: color-mix(in srgb, var(--accent) 12%, var(--panel));
  border-color: color-mix(in srgb, var(--accent) 26%, var(--panel-border));
}

.app-shell-sidebar__button--manage {
  margin-top: auto;
}
</style>
