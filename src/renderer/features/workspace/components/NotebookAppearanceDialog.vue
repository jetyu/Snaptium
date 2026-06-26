<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="modelValue" class="appearance-overlay" @click.self="closeDialog">
        <section class="appearance-dialog" @click.stop>
          <header class="appearance-dialog__header">
            <div class="appearance-dialog__title-wrap">
              <NotebookVisualIcon
                :icon-color="iconColor"
                :icon-size="16"
                :box-size="22"
              />
              <div class="appearance-dialog__title-copy">
                <h3>{{ $t('workspace.iconPicker.title') }}</h3>
                <p>{{ notebookName }}</p>
              </div>
            </div>
            <button class="appearance-dialog__close dialog-close-button" :title="$t('button.close')" @click="closeDialog">
              <IconX :size="18" />
            </button>
          </header>

          <div class="appearance-dialog__panel">
            <div class="appearance-dialog__color-grid">
              <button
                class="swatch-button"
                :class="{ 'is-active': iconColor === undefined }"
                :title="$t('contextMenu.notebookIconColorDefault')"
                :aria-label="$t('contextMenu.notebookIconColorDefault')"
                @click="emitColor(null)"
              >
                <span class="swatch-button__dot swatch-button__dot--default"></span>
              </button>

              <button
                v-for="color in notebookColors"
                :key="color"
                class="swatch-button"
                :class="{ 'is-active': iconColor === color }"
                :title="$t(colorLabelKeyMap[color])"
                :aria-label="$t(colorLabelKeyMap[color])"
                @click="emitColor(color)"
              >
                <span class="swatch-button__dot" :class="`swatch-button__dot--${color}`"></span>
              </button>
            </div>
          </div>

          <footer class="appearance-dialog__footer">
            <button class="btn-reset" @click="resetToDefault">{{ $t('workspace.iconPicker.reset') }}</button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { IconX } from '@tabler/icons-vue';
import {
  NOTEBOOK_ICON_COLORS,
  NOTEBOOK_ICON_COLOR_VALUES,
  type NotebookIconColor,
} from '@shared/notebook-icon.constants';
import NotebookVisualIcon from './NotebookVisualIcon.vue';
import { WORKSPACE_CONSTANTS } from '../constants/workspace.constants';

defineProps<{
  modelValue: boolean;
  notebookName: string;
  iconColor?: NotebookIconColor;
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void;
  (event: 'select-color', value: NotebookIconColor | null): void;
}>();

const notebookColors = NOTEBOOK_ICON_COLOR_VALUES as readonly NotebookIconColor[];

const colorLabelKeyMap = {
  [NOTEBOOK_ICON_COLORS.SLATE]: WORKSPACE_CONSTANTS.MENU.NOTEBOOK_ICON_COLOR_SLATE,
  [NOTEBOOK_ICON_COLORS.BLUE]: WORKSPACE_CONSTANTS.MENU.NOTEBOOK_ICON_COLOR_BLUE,
  [NOTEBOOK_ICON_COLORS.CYAN]: WORKSPACE_CONSTANTS.MENU.NOTEBOOK_ICON_COLOR_CYAN,
  [NOTEBOOK_ICON_COLORS.GREEN]: WORKSPACE_CONSTANTS.MENU.NOTEBOOK_ICON_COLOR_GREEN,
  [NOTEBOOK_ICON_COLORS.AMBER]: WORKSPACE_CONSTANTS.MENU.NOTEBOOK_ICON_COLOR_AMBER,
  [NOTEBOOK_ICON_COLORS.ROSE]: WORKSPACE_CONSTANTS.MENU.NOTEBOOK_ICON_COLOR_ROSE,
  [NOTEBOOK_ICON_COLORS.INDIGO]: WORKSPACE_CONSTANTS.MENU.NOTEBOOK_ICON_COLOR_INDIGO,
  [NOTEBOOK_ICON_COLORS.TEAL]: WORKSPACE_CONSTANTS.MENU.NOTEBOOK_ICON_COLOR_TEAL,
  [NOTEBOOK_ICON_COLORS.LIME]: WORKSPACE_CONSTANTS.MENU.NOTEBOOK_ICON_COLOR_LIME,
  [NOTEBOOK_ICON_COLORS.RED]: WORKSPACE_CONSTANTS.MENU.NOTEBOOK_ICON_COLOR_RED,
  [NOTEBOOK_ICON_COLORS.WHITE]: WORKSPACE_CONSTANTS.MENU.NOTEBOOK_ICON_COLOR_WHITE,
} as const satisfies Record<NotebookIconColor, string>;

function closeDialog() {
  emit('update:modelValue', false);
}

function emitColor(value: NotebookIconColor | null) {
  emit('select-color', value);
}

function resetToDefault() {
  emit('select-color', null);
}
</script>

<style scoped>
.appearance-overlay {
  position: fixed;
  inset: 0;
  background: var(--dialog-overlay-bg);
  backdrop-filter: var(--dialog-overlay-backdrop-filter);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
}

.appearance-dialog {
  width: min(360px, calc(100vw - 28px));
  max-height: min(360px, calc(100vh - 24px));
  overflow: hidden;
  border-radius: 16px;
  background: var(--panel);
  border: 1px solid var(--panel-border);
  box-shadow: 0 26px 56px rgba(15, 23, 42, 0.22);
  display: flex;
  flex-direction: column;
}

.appearance-dialog__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px 14px;
  border-bottom: 1px solid var(--panel-border);
}

.appearance-dialog__title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.appearance-dialog__title-copy h3 {
  margin: 0;
  font-size: 0.98rem;
}

.appearance-dialog__title-copy p {
  margin: 2px 0 0;
  color: var(--text-muted);
  font-size: 0.82rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 260px;
}

.appearance-dialog__close {
  color: var(--text-muted);
}

.appearance-dialog__panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  flex: 1;
  min-height: 0;
}

.appearance-dialog__color-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  padding: 0 4px;
}

.swatch-button {
  border: 1px solid var(--panel-border);
  background: var(--panel);
  border-radius: 8px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.swatch-button:hover {
  border-color: color-mix(in srgb, var(--accent) 32%, var(--panel-border));
}

.swatch-button.is-active {
  border-color: color-mix(in srgb, var(--accent) 48%, var(--panel-border));
  background: color-mix(in srgb, var(--accent) 8%, var(--panel));
}

.swatch-button__dot {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.2);
}

.swatch-button__dot--default {
  background: transparent;
  border: 1px dashed var(--text-muted);
}

.swatch-button__dot--slate {
  background: var(--notebook-icon-slate);
}

.swatch-button__dot--blue {
  background: var(--notebook-icon-blue);
}

.swatch-button__dot--cyan {
  background: var(--notebook-icon-cyan);
}

.swatch-button__dot--green {
  background: var(--notebook-icon-green);
}

.swatch-button__dot--amber {
  background: var(--notebook-icon-amber);
}

.swatch-button__dot--rose {
  background: var(--notebook-icon-rose);
}

.swatch-button__dot--indigo {
  background: var(--notebook-icon-indigo);
}

.swatch-button__dot--teal {
  background: var(--notebook-icon-teal);
}

.swatch-button__dot--lime {
  background: var(--notebook-icon-lime);
}

.swatch-button__dot--red {
  background: var(--notebook-icon-red);
}

.swatch-button__dot--white {
  background: var(--notebook-icon-white);
}

.appearance-dialog__footer {
  display: flex;
  justify-content: flex-end;
  padding: 10px 16px;
  border-top: 1px solid var(--panel-border);
}

.btn-reset {
  border: 1px solid var(--panel-border);
  background: transparent;
  color: var(--text-muted);
  height: 30px;
  border-radius: 8px;
  padding: 0 12px;
  cursor: pointer;
}

.btn-reset:hover {
  color: var(--text);
  border-color: color-mix(in srgb, var(--accent) 26%, var(--panel-border));
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 640px) {
  .appearance-dialog {
    width: calc(100vw - 16px);
    max-height: calc(100vh - 16px);
  }
}
</style>
