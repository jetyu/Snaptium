/**
 * Editor module constants
 * Includes context menu, statusbar, and toolbar related constants
 */

// ============================================================================
// Context Menu Constants
// ============================================================================

export const EDITOR_CONSTANTS = {
  // Context menu actions
  ACTIONS: {
    CUT: 'cut',
    COPY: 'copy',
    PASTE: 'paste',
    DELETE: 'delete',
    SELECT_ALL: 'selectAll',
    AI_REWRITE: 'aiRewrite',
    AI_EXPAND: 'aiExpand',
    AI_SIMPLIFY: 'aiSimplify',
    AI_SUMMARIZE: 'aiSummarize',
  },

  // Context menu i18n keys
  MENU: {
    CUT: 'contextMenu.cut',
    COPY: 'contextMenu.copy',
    PASTE: 'contextMenu.paste',
    DELETE: 'contextMenu.delete',
    SELECT_ALL: 'contextMenu.selectAll',
    AI_OPERATIONS: 'contextMenu.aiOperations',
    AI_REWRITE: 'contextMenu.aiRewrite',
    AI_EXPAND: 'contextMenu.aiExpand',
    AI_SIMPLIFY: 'contextMenu.aiSimplify',
    AI_SUMMARIZE: 'contextMenu.aiSummarize',
  },

  // Menu item types
  MENU_ITEM_TYPE: {
    NORMAL: 'normal' as const,
    SEPARATOR: 'separator' as const,
    SUBMENU: 'submenu' as const,
  },

  // ============================================================================
  // Statusbar Constants
  // ============================================================================

  STATUSBAR: {
    REGEX: {
      CHINESE_CHARS: /[\u4e00-\u9fa5]/g,
      ENGLISH_WORDS: /[a-zA-Z0-9]+(?:[-'][a-zA-Z0-9]+)*/g,
      PARAGRAPH: /\n\s*\n/g, // 段落分隔（空行）
    },
    
    FILE_SIZE: {
      UNITS: ['B', 'KB', 'MB', 'GB'] as const,
      THRESHOLD: 1024,
    },
  },

  // ============================================================================
  // Toolbar Constants
  // ============================================================================

  TOOLBAR: {
    GROUPS: {
      HEADING: 'heading' as const,
      FORMAT: 'format' as const,
      LIST: 'list' as const,
      BLOCK: 'block' as const,
      INSERT: 'insert' as const,
    },
  },
} as const;

// ============================================================================
// Toolbar Types and Actions
// ============================================================================

export type ToolbarGroup = 'heading' | 'format' | 'list' | 'block' | 'insert';

export interface ToolbarAction {
  readonly name: string;
  readonly i18nKey: string;
  readonly icon: string;
  readonly group: ToolbarGroup;
}

export const TOOLBAR_ACTIONS: readonly ToolbarAction[] = [
  { name: 'heading1',     i18nKey: 'toolbar.heading1',     icon: 'heading-1',    group: 'heading' },
  { name: 'heading2',     i18nKey: 'toolbar.heading2',     icon: 'heading-2',    group: 'heading' },

  { name: 'bold',         i18nKey: 'toolbar.bold',         icon: 'bold',         group: 'format'  },
  { name: 'italic',       i18nKey: 'toolbar.italic',       icon: 'italic',       group: 'format'  },
  { name: 'strikethrough',i18nKey: 'toolbar.strikethrough',icon: 'strikethrough',group: 'format'  },

  { name: 'bulletList',   i18nKey: 'toolbar.bulletList',   icon: 'list-bullet',  group: 'list'    },
  { name: 'numberedList', i18nKey: 'toolbar.numberedList', icon: 'list-numbered',group: 'list'    },
  { name: 'taskList',     i18nKey: 'toolbar.taskList',     icon: 'list-check',   group: 'list'    },

  { name: 'quote',        i18nKey: 'toolbar.quote',        icon: 'quote',        group: 'block'   },
  { name: 'codeBlock',    i18nKey: 'toolbar.codeBlock',    icon: 'code',         group: 'block'   },

  { name: 'insertLink',   i18nKey: 'toolbar.insertLink',   icon: 'link',         group: 'insert'  },
  { name: 'insertImage',  i18nKey: 'toolbar.insertImage',  icon: 'image',        group: 'insert'  },
  { name: 'insertTable',  i18nKey: 'toolbar.insertTable',  icon: 'table',        group: 'insert'  },
] as const;

export const TOOLBAR_GROUPS: Record<ToolbarGroup, readonly ToolbarAction[]> = {
  heading: TOOLBAR_ACTIONS.filter(a => a.group === 'heading'),
  format:  TOOLBAR_ACTIONS.filter(a => a.group === 'format'),
  list:    TOOLBAR_ACTIONS.filter(a => a.group === 'list'),
  block:   TOOLBAR_ACTIONS.filter(a => a.group === 'block'),
  insert:  TOOLBAR_ACTIONS.filter(a => a.group === 'insert'),
};
