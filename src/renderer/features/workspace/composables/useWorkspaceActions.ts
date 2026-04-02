import { useWorkspaceStore } from '../store/workspace.store';

/**
 * 工作区操作 composable
 * 提供带 UI 交互的工作区操作方法
 */
export function useWorkspaceActions() {
  const workspaceStore = useWorkspaceStore();

  /**
   * 删除当前活动笔记（带确认）
   */
  const deleteActiveNote = async () => {
    const activeNote = workspaceStore.activeNote;
    if (!activeNote) {
      console.warn('No active note to delete');
      return false;
    }

    // TODO: 使用自定义确认对话框替代 confirm
    const confirmed = confirm(`确定要删除笔记 "${activeNote.title}" 吗？`);
    if (!confirmed) return false;

    try {
      await workspaceStore.deleteNote(activeNote.id);
      return true;
    } catch (error) {
      console.error('Failed to delete note:', error);
      return false;
    }
  };

  /**
   * 重命名当前活动笔记（带输入）
   */
  const renameActiveNote = async () => {
    const activeNote = workspaceStore.activeNote;
    if (!activeNote) {
      console.warn('No active note to rename');
      return false;
    }

    // TODO: 使用自定义输入对话框替代 prompt
    const newTitle = prompt('请输入新的笔记标题:', activeNote.title);
    if (!newTitle || newTitle.trim() === '') return false;

    try {
      await workspaceStore.renameNote(activeNote.id, newTitle.trim());
      return true;
    } catch (error) {
      console.error('Failed to rename note:', error);
      return false;
    }
  };

  /**
   * 保存当前笔记
   */
  const saveActiveNote = async () => {
    try {
      await workspaceStore.forceFlushAutoSave();
      return true;
    } catch (error) {
      console.error('Failed to save note:', error);
      return false;
    }
  };

  return {
    deleteActiveNote,
    renameActiveNote,
    saveActiveNote,
  };
}
