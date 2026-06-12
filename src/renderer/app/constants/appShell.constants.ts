export const APP_SHELL_MAX_CUSTOM_MODULES = 5;

export const APP_SHELL_MAIN_VIEW_IDS = ['workbench', 'workspace', 'search', 'tags', 'favorites', 'settings'] as const;

export type AppShellMainViewId = (typeof APP_SHELL_MAIN_VIEW_IDS)[number];

export type AppShellModuleId = 'favorites' | 'tags' | 'search' | 'settings' | 'trash' | 'about';

export type AppShellModulePresentation = 'dialog' | 'view';

export interface AppShellMainViewDefinition {
  id: AppShellMainViewId;
  labelKey: string;
}

export interface AppShellModuleDefinition {
  id: AppShellModuleId;
  labelKey: string;
  presentation: AppShellModulePresentation;
  viewId?: AppShellMainViewId;
  settingsTab?: string;
}

export const APP_SHELL_DEFAULT_MAIN_VIEW: AppShellMainViewId = 'workbench';

export function isAppShellMainViewId(value: unknown): value is AppShellMainViewId {
  return typeof value === 'string' && APP_SHELL_MAIN_VIEW_IDS.includes(value as AppShellMainViewId);
}

export function normalizeAppShellMainViewId(
  value: unknown,
  fallback: AppShellMainViewId = APP_SHELL_DEFAULT_MAIN_VIEW,
): AppShellMainViewId {
  return isAppShellMainViewId(value) ? value : fallback;
}

export const APP_SHELL_MAIN_VIEWS: AppShellMainViewDefinition[] = [
  {
    id: 'workbench',
    labelKey: 'appShell.mainView.workbench.label'
  },
  {
    id: 'workspace',
    labelKey: 'appShell.mainView.workspace.label'
  },
];

export const APP_SHELL_CUSTOM_MODULES: AppShellModuleDefinition[] = [
  {
    id: 'favorites',
    labelKey: 'appShell.mainView.favorites.label',
    presentation: 'view',
    viewId: 'favorites',
  },
  {
    id: 'tags',
    labelKey: 'appShell.mainView.tags.label',
    presentation: 'view',
    viewId: 'tags',
  },
  {
    id: 'search',
    labelKey: 'search.knowledgeSearch',
    presentation: 'view',
    viewId: 'search',
  },
  {
    id: 'settings',
    labelKey: 'pref.pane.title',
    presentation: 'view',
    viewId: 'settings',
  },
  {
    id: 'trash',
    labelKey: 'label.trash',
    presentation: 'dialog',
  },
  {
    id: 'about',
    labelKey: 'about.title',
    presentation: 'dialog',
  },
];

export const APP_SHELL_CUSTOM_MODULE_MAP = new Map(
  APP_SHELL_CUSTOM_MODULES.map((module) => [module.id, module])
);
