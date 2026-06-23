import { onMounted, onUnmounted } from 'vue';
import { commandService } from '../services/command.service';
import { useWorkspace, useWorkspaceUiActions } from '@renderer/features/workspace';
import { useSettings } from '@renderer/features/settings';
import { useEditor } from '@renderer/features/editor';
import { openSearchPanel } from '@codemirror/search';
import { createLogger } from '@renderer/features/logger';
import { getErrorMessage } from '@shared/utils/error.utils';
import { useSearch } from '@renderer/features/search';

const commandRegistrationLogger = createLogger('CommandRegistration');

export function useCommandRegistration() {
  const { createNote, openExternalFile } = useWorkspace();
  const { saveActiveNote, deleteActiveNote, requestRenameActiveNode } = useWorkspaceUiActions();
  const { openSettings } = useSettings();
  const { getEditorView } = useEditor();
  const { requestFocusQuickSearch } = useSearch();

  const registerAllCommands = () => {
    commandService.registerCommand('file.new', async () => {
      commandRegistrationLogger.debug('Command executed: file.new');
      try {
        await createNote();
      } catch (error) {
        commandRegistrationLogger.error(`Failed to create note: ${getErrorMessage(error)}`);
      }
    });

    commandService.registerCommand('file.open', async () => {
      commandRegistrationLogger.debug('Command executed: file.open');
      await openExternalFile();
    });

    commandService.registerCommand('file.save', async () => {
      commandRegistrationLogger.debug('Command executed: file.save');
      await saveActiveNote();
    });

    commandService.registerCommand('file.delete', async () => {
      commandRegistrationLogger.debug('Command executed: file.delete');
      await deleteActiveNote();
    });

    commandService.registerCommand('file.rename', () => {
      commandRegistrationLogger.debug('Command executed: file.rename');
      requestRenameActiveNode();
    });

    commandService.registerCommand('search.find', () => {
      commandRegistrationLogger.debug('Command executed: search.find');
      const editorView = getEditorView();
      if (editorView) {
        openSearchPanel(editorView);
      } else {
        commandRegistrationLogger.warn('No active editor view');
        requestFocusQuickSearch();
      }
    });

    commandService.registerCommand('search.findInFiles', () => {
      commandRegistrationLogger.debug('Command executed: search.findInFiles');
      requestFocusQuickSearch();
    });

    commandService.registerCommand('app.preferences', () => {
      commandRegistrationLogger.debug('Command executed: app.preferences');
      openSettings();
    });

    commandService.registerCommand('app.quit', () => {
      commandRegistrationLogger.debug('Command executed: app.quit');
      window.close();
    });

    commandRegistrationLogger.info('All commands registered successfully');
  };

  const unregisterAllCommands = () => {
    commandService.clear();
    commandRegistrationLogger.info('All commands unregistered');
  };

  onMounted(() => {
    registerAllCommands();
  });

  onUnmounted(() => {
    unregisterAllCommands();
  });

  return {
    registerAllCommands,
    unregisterAllCommands,
  };
}
