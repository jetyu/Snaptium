import { ref, shallowRef } from 'vue';
import type { EditorView } from '@codemirror/view';
import { electronApi } from '@renderer/core/bridge/electronApi';
import { showAiSuggestion, clearAiSuggestion } from '@renderer/core/ai/wordsAutoCompletion';
import {AI_ASSISTANT_DEFAULTS } from '../constants/ai.constants';

export interface AiAssistantState {
  isEnabled: boolean;
  isProcessing: boolean;
  lastError: string | null;
}

/**
 * AI写作助手 composable
 * 每个编辑器实例独立管理状态
 */
export function useAiAssistant() {
  const state = ref<AiAssistantState>({
    isEnabled: false,
    isProcessing: false,
    lastError: null,
  });

  const editorViewRef = shallowRef<EditorView | null>(null);
  let typingTimer: ReturnType<typeof setTimeout> | null = null;
  let abortController: AbortController | null = null;

  /**
   * 取消当前的AI请求
   */
  const cancelRequest = () => {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    state.value.isProcessing = false;
  };

  /**
   * 请求AI补全
   */
  const requestCompletion = async (editorView: EditorView, config: any) => {
    if (!config?.aiAssistant?.enabled || state.value.isProcessing) {
      return;
    }

    const doc = editorView.state.doc;
    const cursorPos = editorView.state.selection.main.head;

    // 检查最小输入长度
    const minLength = config.aiAssistant.minInputLength || AI_ASSISTANT_DEFAULTS.MIN_INPUT_LENGTH;
    if (cursorPos < minLength) {
      return;
    }

    // 获取光标前的文本作为上下文
    const contextLength = AI_ASSISTANT_DEFAULTS.CONTEXT_LENGTH;
    const context = doc.sliceString(Math.max(0, cursorPos - contextLength), cursorPos);
    
    if (!context.trim()) {
      return;
    }

    // 取消之前的请求
    cancelRequest();

    state.value.isProcessing = true;
    state.value.lastError = null;

    // 创建新的 AbortController
    abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController?.abort();
    }, AI_ASSISTANT_DEFAULTS.REQUEST_TIMEOUT);

    try {
      const result = await electronApi.aiAssistant.complete({
        context,
      });

      clearTimeout(timeoutId);

      if (result.success && result.completion) {
        // 显示灰色的补全建议
        showAiSuggestion(editorView, result.completion);
      } else {
        state.value.lastError = result.message || 'Completion failed';
        console.warn('[AI Assistant] Completion failed:', result.message);
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      // 忽略取消错误
      if (error.name === 'AbortError') {
        console.log('[AI Assistant] Request cancelled');
        return;
      }

      state.value.lastError = error.message;
      console.error('[AI Assistant] Error:', error);
    } finally {
      abortController = null;
      state.value.isProcessing = false;
    }
  };

  /**
   * 处理用户输入，延迟触发AI补全
   */
  const handleTyping = (editorView: EditorView, config: any) => {
    if (!config?.aiAssistant?.enabled) {
      return;
    }

    // 清除之前的建议
    clearAiSuggestion(editorView);

    // 清除之前的定时器
    if (typingTimer) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }

    // 设置新的定时器
    const delay = config.aiAssistant.typingDelay || AI_ASSISTANT_DEFAULTS.TYPING_DELAY;
    typingTimer = setTimeout(() => {
      requestCompletion(editorView, config);
    }, delay);
  };

  /**
   * 清理资源
   */
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

  /**
   * 设置启用状态
   */
  const setEnabled = (enabled: boolean) => {
    state.value.isEnabled = enabled;
    if (!enabled) {
      cleanup();
    }
  };

  /**
   * 设置编辑器视图引用
   */
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
