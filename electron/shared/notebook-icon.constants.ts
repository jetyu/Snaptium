export const NOTEBOOK_ICON_COLORS = {
  SLATE: 'slate',
  BLUE: 'blue',
  CYAN: 'cyan',
  GREEN: 'green',
  AMBER: 'amber',
  ROSE: 'rose',
  INDIGO: 'indigo',
  TEAL: 'teal',
  LIME: 'lime',
  RED: 'red',
  WHITE: 'white',
} as const satisfies Record<string, string>;

export type NotebookIconColor = (typeof NOTEBOOK_ICON_COLORS)[keyof typeof NOTEBOOK_ICON_COLORS];

export const NOTEBOOK_ICON_COLOR_VALUES = Object.freeze(
  Object.values(NOTEBOOK_ICON_COLORS)
) as readonly NotebookIconColor[];

export const NOTEBOOK_ICON_COLOR_HEX = {
  [NOTEBOOK_ICON_COLORS.SLATE]: '#475569',
  [NOTEBOOK_ICON_COLORS.BLUE]: '#2563eb',
  [NOTEBOOK_ICON_COLORS.CYAN]: '#0891b2',
  [NOTEBOOK_ICON_COLORS.GREEN]: '#16a34a',
  [NOTEBOOK_ICON_COLORS.AMBER]: '#d97706',
  [NOTEBOOK_ICON_COLORS.ROSE]: '#e11d48',
  [NOTEBOOK_ICON_COLORS.INDIGO]: '#4f46e5',
  [NOTEBOOK_ICON_COLORS.TEAL]: '#0d9488',
  [NOTEBOOK_ICON_COLORS.LIME]: '#65a30d',
  [NOTEBOOK_ICON_COLORS.RED]: '#dc2626',
  [NOTEBOOK_ICON_COLORS.WHITE]: '#ffffff',
} as const satisfies Record<NotebookIconColor, string>;

const NOTEBOOK_ICON_COLOR_SET = new Set<NotebookIconColor>(NOTEBOOK_ICON_COLOR_VALUES);

export function isNotebookIconColor(value: unknown): value is NotebookIconColor {
  return typeof value === 'string' && NOTEBOOK_ICON_COLOR_SET.has(value as NotebookIconColor);
}
