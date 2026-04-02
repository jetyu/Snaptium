import { onMounted, onUnmounted } from 'vue';
import { commandService } from '../services/command.service';
import { useWorkspace, useWorkspaceActions } from '@renderer/features/workspace';
import { useSettings } from '@renderer/features/settings';
import { useEditor } from '@renderer/features/editor';
import { useSearch } from '@renderer/features/search';
import { openSearchPanel } from '@codemirror/search';

/**
 * 注册所有应用命令
 * 在应用启动时调用一次
 */
export function useCommandRegistration() {
  const { createNote } = useWorkspace();
  const { saveActiveNote, deleteActiveNote, renameActiveNote } = useWorkspaceActions();
  const { openSettings } = useSettings();
  const { getEditorView } = useEditor();
  const { openGlobalSearch } = useSearch();

  const registerAllCommands = () => {
    // 文件操作命令
    commandService.registerCommand('file.new', async () => {
      console.log('✅ Command executed: file.new');
      try {
        await createNote();
      } catch (error) {
        console.error('Failed to create note:', error);
      }
    });

    commandService.registerCommand('file.save', async () => {
      console.log('✅ Command executed: file.save');
      await saveActiveNote();
    });

    commandService.registerCommand('file.delete', async () => {
      console.log('✅ Command executed: file.delete');
      await deleteActiveNote();
    });

    commandService.registerCommand('file.rename', async () => {
      console.log('✅ Command executed: file.rename');
      await renameActiveNote();
    });

    // 搜索命令
    commandService.registerCommand('search.find', () => {
      console.log('✅ Command executed: search.find');
      const editorView = getEditorView();
      if (editorView) {
        openSearchPanel(editorView);
      } else {
        console.warn('No active editor view');
      }
    });

    commandService.registerCommand('search.findInFiles', () => {
      console.log('✅ Command executed: search.findInFiles');
      openGlobalSearch();
    });

    // 应用命令
    commandService.registerCommand('app.preferences', () => {
      console.log('✅ Command executed: app.preferences');
      openSettings();
    });

    commandService.registerCommand('app.quit', () => {
      console.log('✅ Command executed: app.quit');
      window.close();
    });

    console.log('✅ All commands registered successfully');
  };

  const unregisterAllCommands = () => {
    commandService.clear();
    console.log('✅ All commands unregistered');
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
