export const WORKSPACE_CONSTANTS = {
  NODE_TYPE_FILE: 'file',
  NODE_TYPE_FOLDER: 'folder',
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
