import type { Keybinding } from '../store/shortcuts.store';
import { buildKeybinding, normalizeKeybinding } from '@shared/utils/keybinding.utils';
import { commandService } from './command.service';

/**
 * 键盘管理器
 * 负责监听键盘事件并触发对应的命令
 */
class KeyboardManager {
  private keybindings: Keybinding[] = [];
  private isListening = false;

  /**
   * 设置快捷键绑定
   */
  setKeybindings(keybindings: Keybinding[]): void {
    this.keybindings = keybindings;
  }

  /**
   * 开始监听键盘事件
   */
  startListening(): void {
    if (this.isListening) {
      return;
    }

    window.addEventListener('keydown', this.handleKeyDown, true);
    this.isListening = true;
  }

  /**
   * 停止监听键盘事件
   */
  stopListening(): void {
    if (!this.isListening) {
      return;
    }

    window.removeEventListener('keydown', this.handleKeyDown, true);
    this.isListening = false;
  }

  /**
   * 处理键盘按下事件
   */
  private handleKeyDown = (event: KeyboardEvent): void => {
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    const accelerator = buildKeybinding(event, isMac);

    // 查找匹配的快捷键绑定
    const binding = this.findMatchingBinding(accelerator);
    if (!binding) {
      return;
    }

    // 检查上下文条件
    if (binding.when && !this.evaluateWhenCondition(binding.when)) {
      return;
    }

    // 阻止默认行为并执行命令
    event.preventDefault();
    event.stopPropagation();

    void commandService.executeCommand(binding.commandId);
  };

  /**
   * 查找匹配的快捷键绑定
   */
  private findMatchingBinding(accelerator: string): Keybinding | undefined {
    return this.keybindings.find(binding => {
      // 规范化比较
      const normalizedBinding = normalizeKeybinding(binding.key, navigator.platform.toUpperCase().includes('MAC'));
      const normalizedAccelerator = normalizeKeybinding(accelerator, navigator.platform.toUpperCase().includes('MAC'));
      return normalizedBinding === normalizedAccelerator;
    });
  }

  /**
   * 评估 when 条件
   * 简化版实现，可根据需要扩展
   */
  private evaluateWhenCondition(when: string): boolean {
    // 获取当前焦点元素
    const activeElement = document.activeElement;

    // 简单的条件判断
    switch (when) {
      case 'editorFocus':
        return activeElement?.classList.contains('cm-editor') ?? false;
      case 'workspaceFocus':
        return activeElement?.closest('.workspace-panel') !== null;
      case 'previewFocus':
        return activeElement?.closest('.preview-panel') !== null;
      default:
        return true;
    }
  }

  /**
   * 手动触发命令（用于测试或编程调用）
   */
  async triggerCommand(commandId: string): Promise<void> {
    await commandService.executeCommand(commandId);
  }
}

// 导出单例
export const keyboardService = new KeyboardManager();
