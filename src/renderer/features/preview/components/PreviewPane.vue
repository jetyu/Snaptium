<template>
  <section class="panel preview" v-html="compiledHtml" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { renderMarkdown } from '@renderer/core/markdown/markdownRenderer';

const props = defineProps<{
  markdown: string;
}>();

const compiledHtml = computed(() => renderMarkdown(props.markdown));
</script>
