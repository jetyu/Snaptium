import type { Command } from '../store/shortcuts.store';

/**
 * 命令处理器类型
 */
type CommandHandler = () => void | Promise<void>;

/**
 * 命令注册表
 * 管理所有可执行命令及其处理器
 */
class CommandRegistry {
  private handlers: Map<string, CommandHandler> = new Map();
  private commands: Map<string, Command> = new Map();

  /**
   * 注册命令处理器
   */
  registerCommand(commandId: string, handler: CommandHandler): void {
    if (this.handlers.has(commandId)) {
      console.warn(`Command ${commandId} is already registered. Overwriting.`);
    }
    this.handlers.set(commandId, handler);
  }

  /**
   * 注销命令处理器
   */
  unregisterCommand(commandId: string): void {
    this.handlers.delete(commandId);
  }

  /**
   * 执行命令
   */
  async executeCommand(commandId: string): Promise<void> {
    const handler = this.handlers.get(commandId);
    if (!handler) {
      console.warn(`No handler registered for command: ${commandId}`);
      return;
    }

    try {
      await handler();
    } catch (error) {
      console.error(`Error executing command ${commandId}:`, error);
      throw error;
    }
  }

  /**
   * 检查命令是否已注册
   */
  hasCommand(commandId: string): boolean {
    return this.handlers.has(commandId);
  }

  /**
   * 获取所有已注册的命令 ID
   */
  getRegisteredCommandIds(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * 设置命令元数据
   */
  setCommandMetadata(command: Command): void {
    this.commands.set(command.id, command);
  }

  /**
   * 获取命令元数据
   */
  getCommandMetadata(commandId: string): Command | undefined {
    return this.commands.get(commandId);
  }

  /**
   * 获取所有命令元数据
   */
  getAllCommandMetadata(): Command[] {
    return Array.from(this.commands.values());
  }

  /**
   * 清空所有注册
   */
  clear(): void {
    this.handlers.clear();
    this.commands.clear();
  }
}

// 导出单例
export const commandService = new CommandRegistry();
