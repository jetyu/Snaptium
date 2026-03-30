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
          v-html="getIcon(action.icon)"
        />
      </div>
      <div v-if="groupName !== 'insert'" class="toolbar-separator"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { toRef } from 'vue';
import type { EditorView } from '@codemirror/view';
import { useEditorToolbar } from '../composables/useEditorToolbar';

import heading1Icon from '@assets/icons/heading-1.svg?raw';
import heading2Icon from '@assets/icons/heading-2.svg?raw';
import boldIcon from '@assets/icons/bold.svg?raw';
import italicIcon from '@assets/icons/italic.svg?raw';
import strikethroughIcon from '@assets/icons/strikethrough.svg?raw';
import bulletListIcon from '@assets/icons/list-bullet.svg?raw';
import numberedListIcon from '@assets/icons/list-numbered.svg?raw';
import taskListIcon from '@assets/icons/list-check.svg?raw';
import quoteIcon from '@assets/icons/quote.svg?raw';
import codeIcon from '@assets/icons/code.svg?raw';
import linkIcon from '@assets/icons/link.svg?raw';
import imageIcon from '@assets/icons/image.svg?raw';
import tableIcon from '@assets/icons/table.svg?raw';

const { t } = useI18n();

const props = defineProps<{
  editorView?: EditorView;
}>();

const editorViewRef = toRef(props, 'editorView');
const { executeCommand, toolbarGroups, isEditorReady } = useEditorToolbar(editorViewRef);

const iconMap: Record<string, string> = {
  'heading-1': heading1Icon,
  'heading-2': heading2Icon,
  'bold': boldIcon,
  'italic': italicIcon,
  'strikethrough': strikethroughIcon,
  'list-bullet': bulletListIcon,
  'list-numbered': numberedListIcon,
  'list-check': taskListIcon,
  'quote': quoteIcon,
  'code': codeIcon,
  'link': linkIcon,
  'image': imageIcon,
  'table': tableIcon,
};

const getIcon = (iconName: string) => iconMap[iconName] || '';
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
}

.toolbar-group-wrapper {
  display: flex;
  align-items: center;
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
