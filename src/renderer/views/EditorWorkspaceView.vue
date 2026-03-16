<template>
  <main class="layout">
    <header class="topbar">
      <div>
        <h1>NoteWizard</h1>
        <p class="subtitle">{{ title }}</p>
      </div>

      <div class="actions">
        <button :disabled="isBusy" @click="openFile">Open</button>
        <button :disabled="isBusy" @click="saveFile">Save</button>
      </div>
    </header>

    <p v-if="error" class="error-banner">{{ error }}</p>

    <section class="workspace">
      <EditorPane v-model="markdown" />
      <PreviewPane :markdown="markdown" />
    </section>
  </main>
</template>

<script setup lang="ts">
import EditorPane from '@renderer/components/EditorPane.vue';
import PreviewPane from '@renderer/components/PreviewPane.vue';
import { useEditorDocument } from '@renderer/composables/useEditorDocument';

const { markdown, title, isBusy, error, openFile, saveFile } = useEditorDocument();
</script>
