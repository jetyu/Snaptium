import type { EditorView } from '@codemirror/view';
import { AI_PROMPT_PRESETS, type AiPromptPreset } from '@shared/ai.constants';
import { getErrorMessage } from '@shared/utils/error.utils';
import { aiService } from '@renderer/features/ai/services/ai.service';
import { createLogger } from '@renderer/features/logger';
import {
  showNativeEditorContextMenu,
  getEditorContextMenu,
  executeEditorAction,
  getSelectedText,
  hasSelection as checkHasSelection,
  replaceSelectedText,
  type EditorContextAction,
} from '../services/editorContextMenu.service';
import { EDITOR_CONSTANTS } from '../constants/editor.constants';

const logger = createLogger('Editor Context Menu');

interface UseEditorContextMenuOptions {
  t: (key: string, named?: Record<string, unknown>) => string;
  editorView: () => EditorView | null;
  aiAssistantEnabled: () => boolean;
}

export function useEditorContextMenu(options: UseEditorContextMenuOptions) {
  /**
   * 处理AI文本操作
   */
  async function handleAiOperation(operation: string, selectedText: string) {
    const view = options.editorView();
    if (!view || !selectedText) return;

    try {
      let promptPreset: AiPromptPreset = AI_PROMPT_PRESETS.EDITOR_DEFAULT;
      switch (operation) {
        case EDITOR_CONSTANTS.ACTIONS.AI_REWRITE:
          promptPreset = AI_PROMPT_PRESETS.EDITOR_REWRITE;
          break;
        case EDITOR_CONSTANTS.ACTIONS.AI_EXPAND:
          promptPreset = AI_PROMPT_PRESETS.EDITOR_EXPAND;
          break;
        case EDITOR_CONSTANTS.ACTIONS.AI_SIMPLIFY:
          promptPreset = AI_PROMPT_PRESETS.EDITOR_SIMPLIFY;
          break;
        case EDITOR_CONSTANTS.ACTIONS.AI_SUMMARIZE:
          promptPreset = AI_PROMPT_PRESETS.EDITOR_SUMMARIZE;
          break;
      }

      const result = await aiService.generate({
        promptPreset,
        messages: [
          { role: 'user', content: selectedText },
        ],
      });

      if (result.success && result.answer) {
        replaceSelectedText(view, result.answer);
      } else {
        logger.error('AI operation failed:', { error: result.error ?? 'Unknown error' });
      }
    } catch (error) {
      logger.error(`AI operation error: ${getErrorMessage(error)}`);
    }
  }

  /**
   * 执行右键菜单操作
   */
  async function runAction(action: EditorContextAction) {
    const view = options.editorView();
    if (!view || !action) return;

    // 处理基础编辑操作
    const basicActions: EditorContextAction[] = [
      EDITOR_CONSTANTS.ACTIONS.CUT,
      EDITOR_CONSTANTS.ACTIONS.COPY,
      EDITOR_CONSTANTS.ACTIONS.PASTE,
      EDITOR_CONSTANTS.ACTIONS.DELETE,
      EDITOR_CONSTANTS.ACTIONS.SELECT_ALL,
    ];

    if (basicActions.includes(action)) {
      executeEditorAction(action, view);
      return;
    }

    // 处理AI操作
    const aiActions: EditorContextAction[] = [
      EDITOR_CONSTANTS.ACTIONS.AI_REWRITE,
      EDITOR_CONSTANTS.ACTIONS.AI_EXPAND,
      EDITOR_CONSTANTS.ACTIONS.AI_SIMPLIFY,
      EDITOR_CONSTANTS.ACTIONS.AI_SUMMARIZE,
    ];

    if (aiActions.includes(action)) {
      const selectedText = getSelectedText(view);
      if (selectedText) {
        await handleAiOperation(action, selectedText);
      }
    }
  }

  /**
   * 打开右键菜单
   */
  async function openContextMenu() {
    const view = options.editorView();
    const action = await showNativeEditorContextMenu(
      options.t,
      getEditorContextMenu(options.aiAssistantEnabled(), checkHasSelection(view))
    );

    if (action) {
      await runAction(action);
    }
  }

  return {
    openContextMenu,
  };
}

