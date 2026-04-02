export const WORKSPACE_CONSTANTS = {
  NODE_TYPE_FILE: 'file',
  NODE_TYPE_FOLDER: 'folder',

  SAVE_STATUS: {
    IDLE: 'idle',
    SAVING: 'saving',
    SAVED: 'saved',
    ERROR: 'error',
  },

  AUTO_SAVE: {
    DEBOUNCE_DELAY: 600,
    STATUS_HIDE_DELAY: 3000,
  },
  
  TIME_FORMAT: {
    JUST_NOW_THRESHOLD: 5,
    SECONDS_THRESHOLD: 60,
    MINUTES_THRESHOLD: 3600,
  },

  ERROR_MESSAGES: {
    SAVE_FAILED: 'Failed to save',
    UNKNOWN_ERROR: 'Unknown error',
  },

  MENU: {
    NEW_NOTE: 'contextMenu.newNote',
    NEW_NOTEBOOK: 'contextMenu.newNotebook',
    RENAME: 'contextMenu.rename',
    DELETE: 'contextMenu.delete',
    LOCK: 'contextMenu.lock',
    UNLOCK: 'contextMenu.unlock',
    SHOW_IN_FOLDER: 'contextMenu.showInFolder',
    PROPERTIES: 'contextMenu.properties',
  },
  ACTIONS: {
    CREATE_NOTE: 'create-note',
    CREATE_NOTEBOOK: 'create-notebook',
    RENAME: 'rename',
    DELETE: 'delete',
    TOGGLE_LOCK: 'toggle-lock',
    SHOW_IN_FOLDER: 'show-in-folder',
    PROPERTIES: 'properties',
    NOOP: 'noop',
  },
  MENU_ITEM_TYPE: {
    NORMAL: 'normal',
    SEPARATOR: 'separator',
  },
} as const;

export type SaveStatus = typeof WORKSPACE_CONSTANTS.SAVE_STATUS[keyof typeof WORKSPACE_CONSTANTS.SAVE_STATUS];
