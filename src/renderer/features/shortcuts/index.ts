// 组件
export { default as ShortcutsPanel } from './components/ShortcutsPanel.vue';
export { default as ShortcutInput } from './components/ShortcutInput.vue';
export { default as CommandList } from './components/CommandList.vue';

// Store
export { useShortcutsStore } from './store/shortcuts.store';

// Composables
export { useShortcuts, useCommand } from './composables/useShortcuts';
export { useCommandRegistration } from './composables/useCommandRegistration';

// Services
export { shortcutsService } from './services/shortcuts.service';
export { commandService } from './services/command.service';
export { keyboardService } from './services/keyboard.service';

// Utils
export { formatKeybinding } from '../../core/utils/formatKeybinding.utils';

// Types (从 store 导出)
export type {
  Command,
  CommandScope,
  GlobalShortcutStatus,
  Keybinding,
  KeybindingsConfig,
  KeybindingConflict,
  CommandContext,
  KeyboardEventInfo,
} from './store/shortcuts.store';
export { CommandCategory } from './store/shortcuts.store';
