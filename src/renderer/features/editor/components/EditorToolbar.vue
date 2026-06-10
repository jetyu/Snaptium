<template>
  <div class="editor-toolbar">
    <div 
      v-for="(group, groupName) in toolbarGroups" 
      :key="groupName"
      class="toolbar-group-wrapper"
    >
      <div class="toolbar-group">
        <button
          v-for="action in group"
          :key="action.name"
          :title="t(action.i18nKey)"
          class="toolbar-button"
          :disabled="!isEditorReady"
          @click="executeCommand(action.name)"
        >
          <component :is="getIconComponent(action.icon)" :size="16" />
        </button>
      </div>
      <div v-if="groupName !== 'insert'" class="toolbar-separator"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { toRef } from 'vue';
import type { Component } from 'vue';
import type { EditorView } from '@codemirror/view';
import { useEditorToolbar } from '../composables/useEditorToolbar';
import { 
  IconH1, IconH2, IconBold, IconItalic, IconStrikethrough, 
  IconList, IconListNumbers, IconListCheck, IconQuote, IconCode, 
  IconLink, IconPhoto, IconTable 
} from '@tabler/icons-vue';

const { t } = useI18n();

const props = defineProps<{
  editorView?: EditorView;
}>();

const editorViewRef = toRef(props, 'editorView');
const { executeCommand, toolbarGroups, isEditorReady } = useEditorToolbar(editorViewRef);

const iconMap: Record<string, Component> = {
  'heading-1': IconH1,
  'heading-2': IconH2,
  'bold': IconBold,
  'italic': IconItalic,
  'strikethrough': IconStrikethrough,
  'list-bullet': IconList,
  'list-numbered': IconListNumbers,
  'list-check': IconListCheck,
  'quote': IconQuote,
  'code': IconCode,
  'link': IconLink,
  'image': IconPhoto,
  'table': IconTable,
};

const getIconComponent = (iconName: string) => iconMap[iconName] || IconH1;
</script>

<style scoped>
.editor-toolbar {
  display: flex;
  align-items: center;
  padding: 5px 12px;
  background-color: var(--panel);
  border-bottom: 1px solid var(--panel-border);
  gap: 0;
  flex-shrink: 0;
  min-height: 36px;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
}

.toolbar-group-wrapper {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
}

.toolbar-group {
  display: flex;
  gap: 1px;
  align-items: center;
}

.toolbar-separator {
  width: 1px;
  height: 16px;
  background-color: var(--panel-border);
  margin: 0 6px;
}

.toolbar-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background-color: transparent;
  cursor: pointer;
  transition: background-color 0.12s ease;
}

.toolbar-button:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.toolbar-button:not(:disabled):hover {
  background-color: var(--panel-hover);
}

.toolbar-button:not(:disabled):active {
  transform: scale(0.95);
}

.toolbar-button :deep(svg) {
  width: 16px;
  height: 16px;
  color: var(--text-muted);
  opacity: 0.7;
  transition: opacity 0.12s ease, color 0.12s ease;
}

.toolbar-button:not(:disabled):hover :deep(svg) {
  opacity: 1;
  color: var(--text);
}
</style>
