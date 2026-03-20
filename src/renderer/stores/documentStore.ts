import { defineStore } from 'pinia';

export const useDocumentStore = defineStore('document', {
  state: () => ({
    markdown: '# Welcome to Pilotra\n\nStart writing Markdown here.',
    filePath: null as string | null,
    isBusy: false,
    error: '',
  }),
  getters: {
    title: (state) => state.filePath ?? 'Untitled.md',
  },
  actions: {
    setMarkdown(value: string) {
      this.markdown = value;
    },
    setFilePath(value: string | null) {
      this.filePath = value;
    },
    setBusy(value: boolean) {
      this.isBusy = value;
    },
    setError(value: string) {
      this.error = value;
    },
  },
});
