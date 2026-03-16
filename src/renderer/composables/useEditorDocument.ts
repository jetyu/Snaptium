import { storeToRefs } from 'pinia';
import { useDocumentStore } from '@renderer/stores/documentStore';
import { openMarkdownFile, saveMarkdownFile } from '@renderer/services/electronApi';
import { toErrorMessage } from '@renderer/shared/utils/error.util';

export function useEditorDocument() {
  const documentStore = useDocumentStore();
  const { markdown, filePath, title, isBusy, error } = storeToRefs(documentStore);

  async function openFile() {
    documentStore.setError('');
    documentStore.setBusy(true);

    try {
      const payload = await openMarkdownFile();
      if (!payload) return;

      documentStore.setFilePath(payload.filePath);
      documentStore.setMarkdown(payload.content);
    } catch (openError) {
      documentStore.setError(toErrorMessage(openError));
    } finally {
      documentStore.setBusy(false);
    }
  }

  async function saveFile() {
    documentStore.setError('');
    documentStore.setBusy(true);

    try {
      const payload = await saveMarkdownFile({
        filePath: filePath.value,
        content: markdown.value,
      });

      if (!payload) return;
      documentStore.setFilePath(payload.filePath);
    } catch (saveError) {
      documentStore.setError(toErrorMessage(saveError));
    } finally {
      documentStore.setBusy(false);
    }
  }

  return {
    markdown,
    filePath,
    title,
    isBusy,
    error,
    openFile,
    saveFile,
  };
}
