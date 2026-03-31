<template>
  <div class="app-layout">
    <!-- 左侧笔记栏 -->
    <WorkspaceSidebar />

    <!-- 中间编辑器/笔记本概览 -->
    <section v-if="!activeNote?.locked" class="editor-col panel">
      <div v-if="activeNote" class="col-header">
        <span class="col-title">{{ $t("editorHeader") }}</span>
        <span class="header-separator">/</span>
        <span class="header-note-title" :title="activeNote.title">{{
          activeNote.title
        }}</span>
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
        />
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
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import WorkspaceSidebar from "@renderer/features/workspace/components/WorkspaceSidebar.vue";
import NotebookDashboard from "@renderer/features/workspace/components/NotebookDashboard.vue";
import { EditorPane } from "@renderer/features/editor";
import EditorToolbar from "@renderer/features/editor/components/EditorToolbar.vue";
import { PreviewPane } from "@renderer/features/preview";
import { useWorkspace } from "@renderer/features/workspace";
import type { EditorView } from '@codemirror/view';

const {
  activeNote,
  activeNotebookId,
  updateActiveContent,
  initializeWorkspace,
} = useWorkspace();

const editorPaneRef = ref<InstanceType<typeof EditorPane>>();

const editorView = computed<EditorView | undefined>(() => {
  return editorPaneRef.value?.getEditorApi()?.view;
});

onMounted(() => {
  void initializeWorkspace();
});
</script>
