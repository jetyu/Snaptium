export type MenuAction =
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
  | 'about';

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
      { id: 'preferences', labelKey: 'menu.file.preferences', accelerator: 'CmdOrCtrl+,' },
      { type: 'separator' },
      { id: 'quit', labelKey: 'menu.file.quit', accelerator: 'CmdOrCtrl+Q', role: 'quit' },
    ],
  },
  {
    id: 'view',
    labelKey: 'menu.view',
    items: [
      { id: 'reload', role: 'reload' },
      { id: 'forceReload', role: 'forceReload' },
      { id: 'toggleDevTools', labelKey: 'menu.help.devTools', role: 'toggleDevTools' },
      { type: 'separator' },
      { id: 'resetZoom', labelKey: 'menu.view.resetZoom', role: 'resetZoom' },
      { id: 'zoomIn', labelKey: 'menu.view.zoomIn', role: 'zoomIn' },
      { id: 'zoomOut', labelKey: 'menu.view.zoomOut', role: 'zoomOut' },
      { type: 'separator' },
      { id: 'toggleFullscreen', labelKey: 'menu.view.fullScreen', role: 'togglefullscreen' },
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
      { id: 'activateLicense', labelKey: 'menu.help.activateLicense' },
      { id: 'feedback', labelKey: 'menu.help.feedback' },
      { type: 'separator' },
      { id: 'about', labelKey: 'menu.help.about' },
    ],
  },
];
