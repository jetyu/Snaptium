<template>
  <div class="app-layout">
    <!-- 左侧笔记栏 -->
    <WorkspaceSidebar @open-search="openGlobalSearch" />

    <!-- 中间编辑器/笔记本概览 -->
    <section v-if="!activeNote?.locked" class="editor-col panel">
      <div v-if="activeNote" class="col-header">
        <div class="header-left">
          <span class="col-title">{{ $t("editorHeader") }}</span>
          <span class="header-separator">/</span>
          <span class="header-note-title" :title="activeNote.title">{{
            activeNote.title
          }}</span>
        </div>
      </div>
      <div v-else-if="activeNotebookId" class="col-header">
        <span class="col-title">{{ $t("notebookDashboardTitle") }}</span>
      </div>

      <div v-if="activeNote" class="editor-wrapper">
        <EditorToolbar :editor-view="editorView" />
        <EditorPane
          ref="editorPaneRef"
          :model-value="activeNote.content"
          @update:model-value="updateActiveContent"
          @selection-change="handleSelectionChange"
        />
        <EditorStatus :cursor-position="cursorPosition" :selected-text="selectedText" />
      </div>
      <div v-else-if="activeNotebookId" class="editor-wrapper">
        <NotebookDashboard />
      </div>
      <div v-else class="col-empty">
        <p>{{ $t("selectOrCreate") }}</p>
      </div>
    </section>

    <!-- 右侧预览 -->
    <section v-if="activeNote || !activeNotebookId" class="preview-col panel">
      <div class="col-header">
        <span class="col-title">{{ $t("previewHeader") }}</span>
      </div>
      <PreviewPane v-if="activeNote" :markdown="activeNote.content" />
      <div v-else class="col-empty">
        <p>
          {{
            activeNotebookId
              ? $t("preview.noPreviewContent")
              : $t("selectOrCreate")
          }}
        </p>
      </div>
    </section>
  </div>

  <!-- 搜索对话框 -->
  <SearchDialog
    :is-open="isGlobalSearchOpen"
    @close="closeGlobalSearch"
    @select="handleSearchSelect"
  />
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import WorkspaceSidebar from "@renderer/features/workspace/components/WorkspaceSidebar.vue";
import NotebookDashboard from "@renderer/features/workspace/components/NotebookDashboard.vue";
import { EditorPane } from "@renderer/features/editor";
import EditorToolbar from "@renderer/features/editor/components/EditorToolbar.vue";
import EditorStatus from "@renderer/features/editor/components/EditorStatus.vue";
import { PreviewPane } from "@renderer/features/preview";
import { SearchDialog, useSearch } from "@renderer/features/search";
import { useWorkspace } from "@renderer/features/workspace";
import type { EditorView } from '@codemirror/view';

const {
  activeNote,
  activeNotebookId,
  updateActiveContent,
  initializeWorkspace,
  selectNote,
  forceFlushAutoSave,
} = useWorkspace();

const { isGlobalSearchOpen, openGlobalSearch, closeGlobalSearch } = useSearch();

const editorPaneRef = ref<InstanceType<typeof EditorPane>>();
const cursorPosition = ref<{ line: number; column: number } | null>(null);
const selectedText = ref<string>('');

const editorView = computed<EditorView | undefined>(() => {
  return editorPaneRef.value?.getEditorApi()?.view;
});

function handleSelectionChange(selection: { line: number; column: number; selectedText: string }) {
  cursorPosition.value = { line: selection.line, column: selection.column };
  selectedText.value = selection.selectedText;
}

async function handleSearchSelect(result: any, match?: any) {
  // Load the note
  selectNote(result.id);
  
  // Wait for editor to be ready
  setTimeout(() => {
    const editorApi = editorPaneRef.value?.getEditorApi();
    if (editorApi && match) {
      editorApi.jumpToLine(match.line, result.title);
    }
  }, 100);
}

onMounted(() => {
  void initializeWorkspace();
  
  window.addEventListener('beforeunload', () => {
    forceFlushAutoSave().catch((err: unknown) => {
      console.error('Failed to save before unload:', err);
    });
  });
});
</script>


<style scoped>
.col-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.header-note-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
