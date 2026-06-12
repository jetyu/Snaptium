import { onMounted, onUnmounted } from 'vue';
import { commandService } from '../services/command.service';
import { keyboardService } from '../services/keyboard.service';

/**
 * 快捷键 Composable
 * 用于在组件中注册命令和快捷键
 */
export function useShortcuts() {
  /**
   * 注册命令
   */
  function registerCommand(commandId: string, handler: () => void | Promise<void>) {
    commandService.registerCommand(commandId, handler);
  }

  /**
   * 注销命令
   */
  function unregisterCommand(commandId: string) {
    commandService.unregisterCommand(commandId);
  }

  /**
   * 执行命令
   */
  async function executeCommand(commandId: string) {
    await commandService.executeCommand(commandId);
  }

  /**
   * 触发命令（别名）
   */
  async function triggerCommand(commandId: string) {
    await keyboardService.triggerCommand(commandId);
  }

  return {
    registerCommand,
    unregisterCommand,
    executeCommand,
    triggerCommand,
  };
}

/**
 * 自动注册和清理命令的 Hook
 */
export function useCommand(commandId: string, handler: () => void | Promise<void>) {
  const { registerCommand, unregisterCommand } = useShortcuts();

  onMounted(() => {
    registerCommand(commandId, handler);
  });

  onUnmounted(() => {
    unregisterCommand(commandId);
  });
}
