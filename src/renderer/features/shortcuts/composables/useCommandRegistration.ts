import { onMounted, onUnmounted } from 'vue';
import { commandService } from '../services/command.service';
import { useWorkspace, useWorkspaceActions } from '@renderer/features/workspace';
import { useSettings } from '@renderer/features/settings';
import { useEditor } from '@renderer/features/editor';
import { useSearch } from '@renderer/features/search';
import { openSearchPanel } from '@codemirror/search';
import { createLogger } from '@renderer/features/logger';

const commandRegistrationLogger = createLogger('CommandRegistration');

export function useCommandRegistration() {
  const { createNote } = useWorkspace();
  const { saveActiveNote, deleteActiveNote, renameActiveNote } = useWorkspaceActions();
  const { openSettings } = useSettings();
  const { getEditorView } = useEditor();
  const { openGlobalSearch } = useSearch();

  const registerAllCommands = () => {
    commandService.registerCommand('file.new', async () => {
      commandRegistrationLogger.debug('Command executed: file.new');
      try {
        await createNote();
      } catch (error) {
        commandRegistrationLogger.error(`Failed to create note: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    commandService.registerCommand('file.save', async () => {
      commandRegistrationLogger.debug('Command executed: file.save');
      await saveActiveNote();
    });

    commandService.registerCommand('file.delete', async () => {
      commandRegistrationLogger.debug('Command executed: file.delete');
      await deleteActiveNote();
    });

    commandService.registerCommand('file.rename', async () => {
      commandRegistrationLogger.debug('Command executed: file.rename');
      await renameActiveNote();
    });

    commandService.registerCommand('search.find', () => {
      commandRegistrationLogger.debug('Command executed: search.find');
      const editorView = getEditorView();
      if (editorView) {
        openSearchPanel(editorView);
      } else {
        commandRegistrationLogger.warn('No active editor view');
      }
    });

    commandService.registerCommand('search.findInFiles', () => {
      commandRegistrationLogger.debug('Command executed: search.findInFiles');
      openGlobalSearch();
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
