import {
  NOTEBOOK_ICON_COLORS,
  type NotebookIconColor,
} from '@shared/notebook-icon.constants';

export const NOTEBOOK_ICON_COLOR_CLASS_MAP = {
  [NOTEBOOK_ICON_COLORS.SLATE]: 'notebook-visual-icon--color-slate',
  [NOTEBOOK_ICON_COLORS.BLUE]: 'notebook-visual-icon--color-blue',
  [NOTEBOOK_ICON_COLORS.CYAN]: 'notebook-visual-icon--color-cyan',
  [NOTEBOOK_ICON_COLORS.GREEN]: 'notebook-visual-icon--color-green',
  [NOTEBOOK_ICON_COLORS.AMBER]: 'notebook-visual-icon--color-amber',
  [NOTEBOOK_ICON_COLORS.ROSE]: 'notebook-visual-icon--color-rose',
  [NOTEBOOK_ICON_COLORS.INDIGO]: 'notebook-visual-icon--color-indigo',
  [NOTEBOOK_ICON_COLORS.TEAL]: 'notebook-visual-icon--color-teal',
  [NOTEBOOK_ICON_COLORS.LIME]: 'notebook-visual-icon--color-lime',
  [NOTEBOOK_ICON_COLORS.RED]: 'notebook-visual-icon--color-red',
  [NOTEBOOK_ICON_COLORS.WHITE]: 'notebook-visual-icon--color-white',
} as const satisfies Record<NotebookIconColor, string>;
