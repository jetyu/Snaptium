import { syntaxTree } from '@codemirror/language';
import type { SyntaxNode } from '@lezer/common';
import type { EditorView } from '@codemirror/view';
import { ref, shallowRef } from 'vue';
import { clearAiSuggestion, getLastSuggestionClearTime, hasSuggestion, showAiSuggestion } from '@renderer/core/ai/wordsAutoCompletion';
import { createLogger } from '@renderer/features/logger';
import { getErrorMessage } from '@shared/utils/error.utils';
import { aiService } from '../services/ai.service';
import { AI_ASSISTANT_DEFAULTS, AI_WRITING_MODE_CONFIG, type AiWritingMode } from '../constants/ai.constants';

const aiAssistantLogger = createLogger('AiAssistant');
const PUNCTUATION_ONLY_REGEX = /^[\p{P}\p{S}\s]*$/u;
const MEANINGFUL_TEXT_REGEX = /[\p{L}\p{N}\u4E00-\u9FFF]/u;
const BLOCKED_SYNTAX_NODES = new Set([
  'FencedCode',
  'CodeBlock',
  'CodeText',
  'InlineCode',
  'Table',
  'TableHeader',
  'TableDelimiter',
  'TableRow',
  'TableCell',
  'TaskMarker',
  'ListMark',
]);

export interface AiAssistantState {
  isEnabled: boolean;
  isProcessing: boolean;
  lastError: string | null;
}

interface AiAssistantRuntimeConfig {
  aiAssistant?: {
    enabled: boolean;
    triggerMode?: AiWritingMode;
    autoContinue?: boolean;
  };
}

function isMeaningfulInput(context: string): boolean {
  const trimmed = context.trim();
  if (!trimmed) {
    return false;
  }
  if (PUNCTUATION_ONLY_REGEX.test(trimmed)) {
    return false;
  }
  return MEANINGFUL_TEXT_REGEX.test(trimmed);
}

function isDocumentMeaningful(docText: string): boolean {
  const trimmed = docText.trim();
  return Boolean(trimmed) && !PUNCTUATION_ONLY_REGEX.test(trimmed);
}

function isInsideCodeFence(beforeCursor: string): boolean {
  const fenceMatches = beforeCursor.match(/```/g);
  return Boolean(fenceMatches && fenceMatches.length % 2 === 1);
}

function isStructuredCursorPosition(editorView: EditorView): boolean {
  const state = editorView.state;
  const cursorPos = state.selection.main.head;
  const tree = syntaxTree(state);
  let node: SyntaxNode | null = tree.resolveInner(Math.max(0, cursorPos - 1), -1);

  while (node) {
    if (BLOCKED_SYNTAX_NODES.has(node.name)) {
      return true;
    }
    node = node.parent;
  }

  const docText = state.doc.toString();
  const beforeCursor = docText.slice(0, cursorPos);
  const currentLinePrefix = beforeCursor.split('\n').at(-1) ?? '';
  const currentLineStart = beforeCursor.lastIndexOf('\n') + 1;
  const currentLine = docText.slice(currentLineStart).split('\n')[0] ?? '';

  if (isInsideCodeFence(beforeCursor)) {
    return true;
  }

  if (/^\s*(?:[-*+]|\d+\.)\s*$/.test(currentLinePrefix)) {
    return true;
  }

  if (/^\s*[-*+]\s+\[[ xX]\]\s*$/.test(currentLinePrefix)) {
    return true;
  }

  if (/^\s*\|.+\|\s*$/.test(currentLine)) {
    return true;
  }

  if (/^\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+$/.test(currentLine)) {
    return true;
  }

  return false;
}

export function useAiAssistant() {
  const state = ref<AiAssistantState>({
    isEnabled: false,
    isProcessing: false,
    lastError: null,
  });

  const editorViewRef = shallowRef<EditorView | null>(null);
  let typingTimer: ReturnType<typeof setTimeout> | null = null;
  let abortController: AbortController | null = null;

  const cancelRequest = () => {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    state.value.isProcessing = false;
  };

  const requestCompletion = async (editorView: EditorView, config: AiAssistantRuntimeConfig) => {
    if (!config?.aiAssistant?.enabled || state.value.isProcessing) {
      return;
    }

    const doc = editorView.state.doc;
    const cursorPos = editorView.state.selection.main.head;
    const context = doc.sliceString(Math.max(0, cursorPos - AI_ASSISTANT_DEFAULTS.CONTEXT_LENGTH), cursorPos);

    if (!isMeaningfulInput(context)) {
      return;
    }

    cancelRequest();
    state.value.isProcessing = true;
    state.value.lastError = null;

    abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController?.abort();
    }, AI_ASSISTANT_DEFAULTS.REQUEST_TIMEOUT);

    try {
      const result = await aiService.generateCompletion({ context });
      clearTimeout(timeoutId);

      if (result.success && result.answer) {
        const suggestion = result.answer.trim();
        if (isMeaningfulInput(suggestion)) {
          showAiSuggestion(editorView, suggestion);
        }
      } else {
        state.value.lastError = result.error || 'Completion failed';
        aiAssistantLogger.warn(`Completion failed: ${result.error || 'Unknown failure'}`);
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        aiAssistantLogger.debug('Request cancelled');
        return;
      }

      state.value.lastError = getErrorMessage(error);
      aiAssistantLogger.error(`Error: ${getErrorMessage(error)}`);
    } finally {
      abortController = null;
      state.value.isProcessing = false;
    }
  };

  const handleTyping = (editorView: EditorView, config: AiAssistantRuntimeConfig, isAutoContinue = false) => {
    if (!config?.aiAssistant?.enabled) {
      return;
    }

    const editorState = editorView.state;
    const doc = editorState.doc;
    const pos = editorState.selection.main.head;
    const mode = (config.aiAssistant.triggerMode || 'standard') as AiWritingMode;
    const modeConfig = AI_WRITING_MODE_CONFIG[mode] || AI_WRITING_MODE_CONFIG.standard;

    const checkForbidden = (): boolean => {
      if (hasSuggestion(editorState)) return false;
      if (!editorState.selection.main.empty) return false;
      if (editorState.readOnly) return false;
      if (state.value.isProcessing) return false;

      if (!isAutoContinue) {
        const timeSinceClear = Date.now() - getLastSuggestionClearTime();
        if (timeSinceClear < modeConfig.cooldown) return false;
      }

      const docText = doc.toString();
      if (!isDocumentMeaningful(docText)) return false;

      const context = doc.sliceString(Math.max(0, pos - AI_ASSISTANT_DEFAULTS.CONTEXT_LENGTH), pos);
      if (!isMeaningfulInput(context)) return false;
      if (isStructuredCursorPosition(editorView)) return false;

      return true;
    };

    if (!checkForbidden()) {
      clearAiSuggestion(editorView);
      return;
    }

    clearAiSuggestion(editorView);
    if (typingTimer) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }

    const delay = isAutoContinue ? AI_ASSISTANT_DEFAULTS.CONTINUOUS_COMPLETION_DELAY : modeConfig.delay;
    typingTimer = setTimeout(() => {
      if (!checkForbidden()) return;
      void requestCompletion(editorView, config);
    }, delay);
  };

  const cleanup = () => {
    if (typingTimer) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }

    cancelRequest();

    if (editorViewRef.value) {
      clearAiSuggestion(editorViewRef.value);
    }
  };

  const setEnabled = (enabled: boolean) => {
    state.value.isEnabled = enabled;
    if (!enabled) {
      cleanup();
    }
  };

  const setEditorView = (view: EditorView | null) => {
    editorViewRef.value = view;
  };

  return {
    state,
    requestCompletion,
    handleTyping,
    cleanup,
    setEnabled,
    setEditorView,
    cancelRequest,
  };
}
