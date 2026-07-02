export type MenuAction =
  | 'openFile'
  | 'preferences'
  | 'quit'
  | 'reload'
  | 'forceReload'
  | 'toggleDevTools'
  | 'resetZoom'
  | 'zoomIn'
  | 'zoomOut'
  | 'toggleFullscreen'
  | 'minimize'
  | 'zoom'
  | 'close'
  | 'website'
  | 'docs'
  | 'changelog'
  | 'support'
  | 'privacy'
  | 'terms'
  | 'update'
  | 'activateLicense'
  | 'feedback'
  | 'about'
  | 'importMarkdown'
  | 'importEnex'
  | 'importSppx'
  | 'importNwp'
  | 'exportMarkdown'
  | 'exportSppx';

export interface MenuItemConfig {
  id?: MenuAction;
  labelKey?: string;
  accelerator?: string;
  type?: 'separator' | 'normal' | 'checkbox' | 'radio';
  role?: string;
  submenu?: MenuItemConfig[];
}

export interface MenuCategoryConfig {
  id: string;
  labelKey: string;
  items: MenuItemConfig[];
}

export const MENU_CONFIG: MenuCategoryConfig[] = [
  {
    id: 'file',
    labelKey: 'menu.file',
    items: [
      { id: 'openFile', labelKey: 'menu.file.open' },
      { type: 'separator' },
      { id: 'importMarkdown', labelKey: 'menu.file.importMarkdown' },
      { id: 'importEnex', labelKey: 'menu.file.importEnex' },
      { id: 'importSppx', labelKey: 'menu.file.importSppx' },
      { id: 'importNwp', labelKey: 'menu.file.importNwp' },
      { type: 'separator' },
      { id: 'exportMarkdown', labelKey: 'menu.file.exportMarkdown' },
      { id: 'exportSppx', labelKey: 'menu.file.exportSppx' },
      { type: 'separator' },
      { id: 'preferences', labelKey: 'menu.file.preferences' },
      { type: 'separator' },
      { id: 'quit', labelKey: 'menu.file.quit', role: 'quit' },
    ],
  },
  {
    id: 'view',
    labelKey: 'menu.view',
    items: [
      { id: 'reload', labelKey: 'menu.view.reload', role: 'reload' },
      { id: 'forceReload', labelKey: 'menu.view.forceReload', role: 'forceReload' },
      { type: 'separator' },
      { id: 'resetZoom', labelKey: 'menu.view.resetZoom', role: 'resetZoom' },
      { id: 'zoomIn', labelKey: 'menu.view.zoomIn', role: 'zoomIn' },
      { id: 'zoomOut', labelKey: 'menu.view.zoomOut', role: 'zoomOut' },
      { type: 'separator' },
      { id: 'toggleFullscreen', labelKey: 'menu.view.fullScreen', role: 'togglefullscreen' },
    ],
  },
  {
    id: 'edit',
    labelKey: 'menu.edit',
    items: [
      { labelKey: 'menu.edit.undo', role: 'undo' },
      { labelKey: 'menu.edit.redo', role: 'redo' },
      { type: 'separator' },
      { labelKey: 'menu.edit.cut', role: 'cut' },
      { labelKey: 'menu.edit.copy', role: 'copy' },
      { labelKey: 'menu.edit.paste', role: 'paste' },
      { type: 'separator' },
      { labelKey: 'menu.edit.selectAll', role: 'selectAll' },
    ],
  },
  {
    id: 'help',
    labelKey: 'menu.help',
    items: [
      { id: 'website', labelKey: 'menu.help.website' },
      { id: 'docs', labelKey: 'menu.help.docs' },
      { id: 'changelog', labelKey: 'menu.help.changelog' },
      { id: 'support', labelKey: 'menu.help.support' },
      { type: 'separator' },
      { id: 'privacy', labelKey: 'menu.help.privacy' },
      { id: 'terms', labelKey: 'menu.help.termsOfService' },
      { type: 'separator' },
      { id: 'update', labelKey: 'menu.help.update' },
      { id: 'feedback', labelKey: 'menu.help.feedback' },
      { type: 'separator' },
      { id: 'toggleDevTools', labelKey: 'menu.help.devTools', role: 'toggleDevTools' },
      { id: 'activateLicense', labelKey: 'menu.help.activateLicense' },
      { id: 'about', labelKey: 'menu.help.about' },
    ],
  },
];
