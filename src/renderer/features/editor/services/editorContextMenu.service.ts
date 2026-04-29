import { electronApi } from '@renderer/core/bridge/electronApi';
import { logger } from '@renderer/features/logger';
import type { EditorView } from '@codemirror/view';
import { EDITOR_CONSTANTS } from '../constants/editor.constants';

export type EditorContextAction = typeof EDITOR_CONSTANTS.ACTIONS[keyof typeof EDITOR_CONSTANTS.ACTIONS];

export interface EditorMenuItem {
  action?: EditorContextAction;
  labelKey?: string;
  type?: 'normal' | 'separator' | 'submenu';
  submenu?: EditorMenuItem[];
}

type Translate = (key: string, named?: Record<string, unknown>) => string;

/**
 * 显示原生编辑器右键菜单
 */
export async function showNativeEditorContextMenu(
  t: Translate,
  items: EditorMenuItem[]
): Promise<EditorContextAction | null> {
  const result = await electronApi.editor.showContextMenu({
    labels: createEditorContextMenuLabels(t),
    items: items.map((item) => ({
      action: item.action ?? null,
      labelKey: item.labelKey,
      type: item.type ?? EDITOR_CONSTANTS.MENU_ITEM_TYPE.NORMAL,
      submenu: item.submenu?.map((subItem) => ({
        action: subItem.action ?? null,
        labelKey: subItem.labelKey,
        type: subItem.type ?? EDITOR_CONSTANTS.MENU_ITEM_TYPE.NORMAL,
      })),
    })),
  });

  if (result === null) {
    logger.warn('electronAPI.editor not available, cannot show native editor context menu.');
  }

  return result as EditorContextAction | null;
}

/**
 * 创建编辑器右键菜单标签
 */
export function createEditorContextMenuLabels(t: Translate) {
  return {
    [EDITOR_CONSTANTS.MENU.CUT]: t(EDITOR_CONSTANTS.MENU.CUT),
    [EDITOR_CONSTANTS.MENU.COPY]: t(EDITOR_CONSTANTS.MENU.COPY),
    [EDITOR_CONSTANTS.MENU.PASTE]: t(EDITOR_CONSTANTS.MENU.PASTE),
    [EDITOR_CONSTANTS.MENU.DELETE]: t(EDITOR_CONSTANTS.MENU.DELETE),
    [EDITOR_CONSTANTS.MENU.SELECT_ALL]: t(EDITOR_CONSTANTS.MENU.SELECT_ALL),
    [EDITOR_CONSTANTS.MENU.AI_OPERATIONS]: t(EDITOR_CONSTANTS.MENU.AI_OPERATIONS),
    [EDITOR_CONSTANTS.MENU.AI_REWRITE]: t(EDITOR_CONSTANTS.MENU.AI_REWRITE),
    [EDITOR_CONSTANTS.MENU.AI_EXPAND]: t(EDITOR_CONSTANTS.MENU.AI_EXPAND),
    [EDITOR_CONSTANTS.MENU.AI_SIMPLIFY]: t(EDITOR_CONSTANTS.MENU.AI_SIMPLIFY),
    [EDITOR_CONSTANTS.MENU.AI_SUMMARIZE]: t(EDITOR_CONSTANTS.MENU.AI_SUMMARIZE),
  };
}

/**
 * 获取编辑器右键菜单项
 */
export function getEditorContextMenu(aiAssistantEnabled: boolean, hasSelection: boolean): EditorMenuItem[] {
  const items: EditorMenuItem[] = [
    { action: EDITOR_CONSTANTS.ACTIONS.CUT, labelKey: EDITOR_CONSTANTS.MENU.CUT },
    { action: EDITOR_CONSTANTS.ACTIONS.COPY, labelKey: EDITOR_CONSTANTS.MENU.COPY },
    { action: EDITOR_CONSTANTS.ACTIONS.PASTE, labelKey: EDITOR_CONSTANTS.MENU.PASTE },
    { action: EDITOR_CONSTANTS.ACTIONS.DELETE, labelKey: EDITOR_CONSTANTS.MENU.DELETE },
    { type: EDITOR_CONSTANTS.MENU_ITEM_TYPE.SEPARATOR },
    { action: EDITOR_CONSTANTS.ACTIONS.SELECT_ALL, labelKey: EDITOR_CONSTANTS.MENU.SELECT_ALL },
  ];

  if (aiAssistantEnabled && hasSelection) {
    items.push(
      { type: EDITOR_CONSTANTS.MENU_ITEM_TYPE.SEPARATOR },
      {
        type: EDITOR_CONSTANTS.MENU_ITEM_TYPE.SUBMENU,
        labelKey: EDITOR_CONSTANTS.MENU.AI_OPERATIONS,
        submenu: [
          { action: EDITOR_CONSTANTS.ACTIONS.AI_REWRITE, labelKey: EDITOR_CONSTANTS.MENU.AI_REWRITE },
          { action: EDITOR_CONSTANTS.ACTIONS.AI_EXPAND, labelKey: EDITOR_CONSTANTS.MENU.AI_EXPAND },
          { action: EDITOR_CONSTANTS.ACTIONS.AI_SIMPLIFY, labelKey: EDITOR_CONSTANTS.MENU.AI_SIMPLIFY },
          { action: EDITOR_CONSTANTS.ACTIONS.AI_SUMMARIZE, labelKey: EDITOR_CONSTANTS.MENU.AI_SUMMARIZE },
        ],
      }
    );
  }

  return items;
}

/**
 * 执行编辑器操作
 */
export function executeEditorAction(action: EditorContextAction, editorView: EditorView | null) {
  if (!editorView) return;

  switch (action) {
    case EDITOR_CONSTANTS.ACTIONS.CUT: {
      const selection = editorView.state.selection.main;
      if (selection.from !== selection.to) {
        const text = editorView.state.doc.sliceString(selection.from, selection.to);
        window.electronAPI.editor?.writeClipboard(text).then(() => {
          editorView.dispatch({
            changes: { from: selection.from, to: selection.to, insert: '' },
          });
        });
      }
      break;
    }
    case EDITOR_CONSTANTS.ACTIONS.COPY: {
      const selection = editorView.state.selection.main;
      if (selection.from !== selection.to) {
        const text = editorView.state.doc.sliceString(selection.from, selection.to);
        window.electronAPI.editor?.writeClipboard(text);
      }
      break;
    }
    case EDITOR_CONSTANTS.ACTIONS.PASTE: {
      window.electronAPI.editor?.readClipboard().then((text: string) => {
        const selection = editorView.state.selection.main;
        editorView.dispatch({
          changes: { from: selection.from, to: selection.to, insert: text },
          selection: { anchor: selection.from + text.length },
        });
      });
      break;
    }
    case EDITOR_CONSTANTS.ACTIONS.DELETE: {
      const selection = editorView.state.selection.main;
      if (selection.from !== selection.to) {
        editorView.dispatch({
          changes: { from: selection.from, to: selection.to, insert: '' },
        });
      }
      break;
    }
    case EDITOR_CONSTANTS.ACTIONS.SELECT_ALL:
      editorView.dispatch({
        selection: { anchor: 0, head: editorView.state.doc.length },
      });
      break;
    default:
      break;
  }
}

/**
 * 获取选中的文本
 */
export function getSelectedText(editorView: EditorView | null): string {
  if (!editorView) return '';
  const selection = editorView.state.selection.main;
  return editorView.state.doc.sliceString(selection.from, selection.to);
}

/**
 * 检查是否有选中文本
 */
export function hasSelection(editorView: EditorView | null): boolean {
  if (!editorView) return false;
  const selection = editorView.state.selection.main;
  return selection.from !== selection.to;
}

/**
 * 替换选中的文本
 */
export function replaceSelectedText(editorView: EditorView | null, newText: string) {
  if (!editorView) return;
  const selection = editorView.state.selection.main;
  editorView.dispatch({
    changes: { from: selection.from, to: selection.to, insert: newText },
    selection: { anchor: selection.from + newText.length },
  });
}
