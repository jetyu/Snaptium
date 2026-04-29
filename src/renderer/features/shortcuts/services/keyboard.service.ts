import type { Keybinding, KeyboardEventInfo } from '../store/shortcuts.store';
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
    const keyInfo = this.extractKeyInfo(event);
    const accelerator = this.buildAccelerator(keyInfo);

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
   * 提取键盘事件信息
   */
  private extractKeyInfo(event: KeyboardEvent): KeyboardEventInfo {
    return {
      key: event.key,
      code: event.code,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
    };
  }

  /**
   * 构建快捷键字符串
   */
  private buildAccelerator(keyInfo: KeyboardEventInfo): string {
    const parts: string[] = [];

    // 添加修饰键
    if (keyInfo.ctrlKey || keyInfo.metaKey) {
      parts.push('CommandOrControl');
    }
    if (keyInfo.altKey) {
      parts.push('Alt');
    }
    if (keyInfo.shiftKey) {
      parts.push('Shift');
    }

    // 添加主键
    const mainKey = this.normalizeKey(keyInfo.key);
    if (mainKey) {
      parts.push(mainKey);
    }

    return parts.join('+');
  }

  /**
   * 规范化按键名称
   */
  private normalizeKey(key: string): string {
    // 特殊键映射
    const keyMap: Record<string, string> = {
      ' ': 'Space',
      'Escape': 'Escape',
      'Enter': 'Enter',
      'Tab': 'Tab',
      'Backspace': 'Backspace',
      'Delete': 'Delete',
      'ArrowUp': 'Up',
      'ArrowDown': 'Down',
      'ArrowLeft': 'Left',
      'ArrowRight': 'Right',
      'Insert': 'Insert',
      'Home': 'Home',
      'End': 'End',
      'PageUp': 'PageUp',
      'PageDown': 'PageDown',
    };

    if (keyMap[key]) {
      return keyMap[key];
    }

    // 功能键 F1-F12
    if (/^F\d{1,2}$/.test(key)) {
      return key;
    }

    // 字母和数字转大写
    if (key.length === 1) {
      return key.toUpperCase();
    }

    return key;
  }

  /**
   * 查找匹配的快捷键绑定
   */
  private findMatchingBinding(accelerator: string): Keybinding | undefined {
    return this.keybindings.find(binding => {
      // 规范化比较
      const normalizedBinding = this.normalizeAccelerator(binding.key);
      const normalizedAccelerator = this.normalizeAccelerator(accelerator);
      return normalizedBinding === normalizedAccelerator;
    });
  }

  /**
   * 规范化快捷键字符串用于比较
   */
  private normalizeAccelerator(accelerator: string): string {
    return accelerator
      .replace(/CmdOrCtrl/gi, 'CommandOrControl')
      .replace(/Cmd(?!\w)/gi, 'Command')
      .replace(/Ctrl(?!\w)/gi, 'Control')
      .split('+')
      .map(part => part.trim())
      .join('+');
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
