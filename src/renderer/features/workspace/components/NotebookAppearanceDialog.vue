<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="modelValue" class="appearance-overlay" @click.self="closeDialog">
        <section class="appearance-dialog" @click.stop>
          <header class="appearance-dialog__header">
            <div class="appearance-dialog__title-wrap">
              <NotebookVisualIcon
                :icon-color="iconColor"
                :icon-emoji="iconEmoji"
                :icon-size="16"
                :box-size="22"
              />
              <div class="appearance-dialog__title-copy">
                <h3>{{ $t('workspace.iconPicker.title') }}</h3>
                <p>{{ notebookName }}</p>
              </div>
            </div>
            <button class="appearance-dialog__close" :title="$t('common.close')" @click="closeDialog">
              &times;
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

            <div class="emoji-picker-container">
              <div ref="emojiPickerHost" class="emoji-picker-host"></div>
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
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import {
  NOTEBOOK_ICON_COLORS,
  NOTEBOOK_ICON_COLOR_VALUES,
  type NotebookIconColor,
  type NotebookIconEmoji,
} from '@shared/notebook-icon.constants';
import NotebookVisualIcon from './NotebookVisualIcon.vue';
import { WORKSPACE_CONSTANTS } from '../constants/workspace.constants';
import emojiData from '@emoji-mart/data/sets/15/twitter.json';
import emojiI18nEn from '@emoji-mart/data/i18n/en.json';
import emojiI18nZh from '@emoji-mart/data/i18n/zh.json';
import { init, Picker } from 'emoji-mart';
import twitterEmojiSpritesheetUrl from 'emoji-datasource-twitter/img/twitter/sheets-256/64.png?url';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  modelValue: boolean;
  notebookName: string;
  iconColor?: NotebookIconColor;
  iconEmoji?: NotebookIconEmoji;
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void;
  (event: 'select-color', value: NotebookIconColor | null): void;
  (event: 'select-emoji', value: NotebookIconEmoji | null): void;
}>();

const { locale } = useI18n();
const notebookColors = NOTEBOOK_ICON_COLOR_VALUES as readonly NotebookIconColor[];
const emojiPickerHost = ref<HTMLElement | null>(null);
type EmojiPickerElement = HTMLElement & {
  update: (props: Record<string, unknown>) => void;
};
let emojiPicker: EmojiPickerElement | null = null;

const currentTheme = computed(() => {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
});

type EmojiMartLocale = 'en' | 'zh';

const currentLocale = computed<EmojiMartLocale>(() => {
  const lang = locale.value.toLowerCase();
  return lang.startsWith('zh') ? 'zh' : 'en';
});

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

interface EmojiSelectEvent extends Event {
  detail: {
    native: string;
    [key: string]: unknown;
  };
}

function resolveEmojiI18n(targetLocale: EmojiMartLocale): Record<string, unknown> {
  return targetLocale === 'zh'
    ? (emojiI18nZh as Record<string, unknown>)
    : (emojiI18nEn as Record<string, unknown>);
}

function handleEmojiSelect(event: EmojiSelectEvent | { native?: string }) {
  const emoji = 'detail' in event ? event.detail : event;
  if (emoji && emoji.native) {
    emit('select-emoji', emoji.native);
  }
}

async function mountEmojiPicker() {
  const host = emojiPickerHost.value;
  if (!host) {
    return;
  }

  const targetLocale = currentLocale.value;
  const i18n = resolveEmojiI18n(targetLocale);

  await init({
    data: emojiData,
    i18n,
    locale: targetLocale,
    set: 'twitter',
  });

  host.innerHTML = '';
  const picker = new Picker({
    data: emojiData,
    i18n,
    locale: targetLocale,
    theme: currentTheme.value,
    set: 'twitter',
    dynamicWidth: true,
    previewPosition: 'none',
    getSpritesheetURL: () => twitterEmojiSpritesheetUrl,
    onEmojiSelect: handleEmojiSelect,
  }) as unknown as EmojiPickerElement;

  emojiPicker = picker;
  host.appendChild(emojiPicker);
}

function unmountEmojiPicker() {
  if (emojiPicker && emojiPicker.parentElement) {
    emojiPicker.parentElement.removeChild(emojiPicker);
  }
  emojiPicker = null;
}

watch(
  () => props.modelValue,
  async (open) => {
    if (open) {
      await nextTick();
      await mountEmojiPicker();
      return;
    }

    unmountEmojiPicker();
  },
  { immediate: true },
);

watch(
  () => [currentTheme.value, currentLocale.value] as const,
  ([theme, targetLocale]) => {
    if (!emojiPicker) {
      return;
    }

    emojiPicker.update({
      theme,
      locale: targetLocale,
      i18n: resolveEmojiI18n(targetLocale),
      set: 'twitter',
      getSpritesheetURL: () => twitterEmojiSpritesheetUrl,
      onEmojiSelect: handleEmojiSelect,
    });
  },
);

onBeforeUnmount(() => {
  unmountEmojiPicker();
});

function resetToDefault() {
  emit('select-color', null);
  emit('select-emoji', null);
}
</script>

<style scoped>
.appearance-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.42);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
}

.appearance-dialog {
  width: min(560px, calc(100vw - 28px));
  max-height: min(680px, calc(100vh - 24px));
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
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
  width: 28px;
  height: 28px;
  border-radius: 8px;
}

.appearance-dialog__close:hover {
  color: var(--text);
  background: var(--panel-hover);
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

.emoji-picker-container {
  flex: 0 1 auto;
  height: clamp(280px, 44vh, 360px);
  min-height: 260px;
  border-radius: 8px;
  overflow: auto;
  border: 1px solid var(--panel-border);
}

.emoji-picker-host {
  width: 100%;
  height: 100%;
}

/* Customize Emoji Mart */
.emoji-picker-host :deep(em-emoji-picker) {
  width: 100%;
  height: 100%;
  --border-radius: 0;
  --rgb-accent: 59, 114, 246; /* Matches --accent #3b72f6 */
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

  .emoji-picker-container {
    height: min(46vh, 320px);
    min-height: 220px;
  }
}
</style>
