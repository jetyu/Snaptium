<template>
  <div class="app-menu-bar">
    <div v-for="menu in filteredMenus" :key="menu.id" class="app-menu-bar__item" @mouseenter="handleMouseEnter(menu.id)"
      @mouseleave="handleMouseLeave">
      <button type="button" class="app-menu-bar__button" :class="{ 'is-active': activeMenu === menu.id }"
        @click="toggleMenu(menu.id)">
        {{ t(menu.labelKey) }}
      </button>

      <div v-if="activeMenu === menu.id" class="app-menu-bar__dropdown" @mouseenter="clearCloseTimer"
        @mouseleave="startCloseTimer">
        <template v-for="(item, index) in menu.items" :key="index">
          <div v-if="item.type === 'separator'" class="app-menu-bar__separator"></div>
          <button v-else type="button" class="app-menu-bar__dropdown-item" @click="handleAction(item.id)">
            <span class="app-menu-bar__dropdown-label">{{ item.labelKey ? t(item.labelKey) : '' }}</span>
            <span v-if="item.accelerator" class="app-menu-bar__dropdown-shortcut">{{ formatShortcut(item.accelerator) }}</span>
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSettings } from '@renderer/features/settings/composables/useSettings';
import { useAbout } from '@renderer/features/about';
import { useSearch } from '@renderer/features/search';
import { MENU_CONFIG, type MenuAction } from '@shared/menu.config';

const { t } = useI18n();
const { openSettings } = useSettings();
const { openAbout } = useAbout();
const { openGlobalSearch } = useSearch();

const activeMenu = ref<string | null>(null);
const isMenuOpen = ref(false);
let closeTimer: number | null = null;

// Only show certain categories in the UI menu bar
const visibleCategoryIds = ['file', 'edit', 'help'];
const filteredMenus = computed(() => MENU_CONFIG.filter(m => visibleCategoryIds.includes(m.id)));

function formatShortcut(accelerator: string): string {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  return accelerator
    .replace('CmdOrCtrl', isMac ? '⌘' : 'Ctrl')
    .replace('Shift', isMac ? '⇧' : 'Shift')
    .replace('Alt', isMac ? '⌥' : 'Alt')
    .replace('+', isMac ? '' : '+');
}

function toggleMenu(menuId: string) {
  if (activeMenu.value === menuId) {
    closeMenu();
  } else {
    activeMenu.value = menuId;
    isMenuOpen.value = true;
  }
}

function handleMouseEnter(menuId: string) {
  if (isMenuOpen.value) {
    activeMenu.value = menuId;
  }
  clearCloseTimer();
}

function handleMouseLeave() {
  startCloseTimer();
}

function startCloseTimer() {
  clearCloseTimer();
  closeTimer = window.setTimeout(() => {
    closeMenu();
  }, 300);
}

function clearCloseTimer() {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
}

function closeMenu() {
  activeMenu.value = null;
  isMenuOpen.value = false;
}

function handleAction(action?: MenuAction) {
  if (!action) return;

  switch (action) {
    case 'preferences':
      openSettings('general');
      break;
    case 'about':
      openAbout();
      break;
    case 'find':
      openGlobalSearch();
      break;
    case 'quit':
      window.close();
      break;
    case 'undo':
      document.execCommand('undo');
      break;
    case 'redo':
      document.execCommand('redo');
      break;
    case 'cut':
      document.execCommand('cut');
      break;
    case 'copy':
      document.execCommand('copy');
      break;
    case 'paste':
      document.execCommand('paste');
      break;
    case 'selectAll':
      document.execCommand('selectAll');
      break;
    case 'update':
      (window as any).electronAPI.updater.check(false);
      break;
    case 'feedback':
      window.open('https://github.com/jetyu/NoteWizard/issues');
      break;
    case 'website':
      window.open('https://snaptium.com');
      break;
    case 'docs':
      window.open('https://snaptium.com/docs');
      break;
    case 'changelog':
      window.open('https://snaptium.com/changelog');
      break;
    case 'support':
      window.open('https://snaptium.com/support');
      break;
    case 'privacy':
      window.open('https://snaptium.com/legal/privacy');
      break;
    case 'terms':
      window.open('https://snaptium.com/legal/terms');
      break;
  }
  closeMenu();
}

const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (!target.closest('.app-menu-bar')) {
    closeMenu();
  }
};

onMounted(() => {
  window.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  window.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.app-menu-bar {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 4px;
  -webkit-app-region: no-drag;
}

.app-menu-bar__item {
  position: relative;
  height: 100%;
  display: flex;
  align-items: center;
}

.app-menu-bar__button {
  height: 28px;
  padding: 0 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.76rem;
  font-weight: 550;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  letter-spacing: 0.01em;
}

.app-menu-bar__button:hover,
.app-menu-bar__button.is-active {
  color: var(--text);
  background: color-mix(in srgb, var(--text) 6%, transparent);
}

[data-theme='dark'] .app-menu-bar__button:hover,
[data-theme='dark'] .app-menu-bar__button.is-active {
  background: color-mix(in srgb, #ffffff 8%, transparent);
}

.app-menu-bar__dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 200px;
  padding: 6px;
  margin-top: 2px;
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 2px;
  backdrop-filter: blur(20px);
}

[data-theme='dark'] .app-menu-bar__dropdown {
  background: color-mix(in srgb, var(--panel) 95%, black);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
}

.app-menu-bar__dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  font-size: 0.82rem;
  cursor: pointer;
  transition: background-color 0.12s ease;
}

.app-menu-bar__dropdown-item:hover {
  background: color-mix(in srgb, var(--text) 8%, transparent);
  color: var(--text);
}

[data-theme='dark'] .app-menu-bar__dropdown-item:hover {
  background: color-mix(in srgb, #ffffff 10%, transparent);
}

.app-menu-bar__dropdown-label {
  flex: 1;
  text-align: left;
}

.app-menu-bar__dropdown-shortcut {
  margin-left: 20px;
  font-size: 0.72rem;
  opacity: 0.6;
}

.app-menu-bar__separator {
  height: 1px;
  margin: 4px 6px;
  background: var(--panel-border);
}
</style>
