import { t } from '../i18n.js';

const electronAPI = window.electronAPI;
const { ipcRenderer } = electronAPI;

export class AIAssistant {
  constructor() {
    this.isEnabled = false;
    this.isProcessing = false;
    this.lastInputTime = 0;
    this.typingTimer = null;
    this.suggestionElement = null;
    this.currentSuggestion = '';
    this.cursorPosition = { line: 0, ch: 0 };
    this.typingDelay = 2000; // 2秒后触发AI辅助写作
    this.minInputLength = 10; // 最小输入长度才触发AI辅助
    this.suggestionMark = null; // 内联建议标记
    this.editor = null; // 编辑器实例引用
    this.init();
  }

  init() {
    this.loadSettings();
   
    this.bindEvents();
    this.startAutoSave();
  }

  // 加载设置
  async loadSettings() {
    try {
      const aiSettings = await ipcRenderer.invoke('preferences:get', 'aiSettings', {});
      this.isEnabled = aiSettings.enabled === true; // 默认禁用
      this.typingDelay = parseInt(aiSettings.typingDelay) || 2000;
      this.minInputLength = parseInt(aiSettings.minInputLength) || 10;
    } catch (error) {
      console.error('加载AI设置失败:', error);
      this.isEnabled = false; // 默认禁用
    }
  }



  // 绑定事件
  bindEvents() {
    // 监听编辑器内容变化
    window.addEventListener('editor-content-changed', this.handleContentChange.bind(this));

    // 监听光标位置变化
    window.addEventListener('editor-cursor-changed', this.handleCursorChange.bind(this));

    // 监听设置变化
    window.addEventListener('ai-settings-changed', this.handleSettingsChange.bind(this));

    // 监听编辑器就绪事件
    window.addEventListener('editor-ready', this.handleEditorReady.bind(this));

    // 监听窗口大小变化
    window.addEventListener('resize', this.hideSuggestion.bind(this));
  }

  // 处理内容变化
  handleContentChange(event) {
    if (!this.isEnabled || this.isProcessing) return;

    const { content } = event.detail || {};
    if (!content || content.length < this.minInputLength) {
      this.hideSuggestion();
      return;
    }

    // 重置定时器
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
    }

    this.typingTimer = setTimeout(() => {
      this.generateSuggestion(content);
    }, this.typingDelay);
  }

  // 处理光标变化
  handleCursorChange(event) {
    const { cursor } = event.detail || {};
    if (cursor) {
      this.cursorPosition = cursor;
      
      // 内联模式下，只有当光标移动到建议范围外时才隐藏建议
      if (this.suggestionMark && this.currentSuggestion) {
        const range = this.suggestionMark.find();
        if (range) {
          // 检查光标是否在建议范围内
          const cursorInRange = (
            cursor.line === range.from.line && 
            cursor.ch >= range.from.ch && 
            cursor.ch <= range.to.ch
          );
          
          // 如果光标移动到建议范围外，隐藏建议
          if (!cursorInRange) {
            this.hideSuggestion();
          }
        }
      }
    }
  }

  // 处理设置变化
  handleSettingsChange(event) {
    const { settings } = event.detail || {};
    if (settings) {
      this.isEnabled = settings.enabled !== false;
      this.typingDelay = settings.typingDelay || 2000;
      this.minInputLength = settings.minInputLength || 10;
    }
  }

  // 处理编辑器就绪事件
  handleEditorReady(event) {
    // 获取编辑器实例
    const editorElement = document.querySelector('.CodeMirror');
    if (editorElement && editorElement.CodeMirror) {
      this.editor = editorElement.CodeMirror;
    }
  }

  // 生成建议
  async generateSuggestion(content) {
    if (!this.isEnabled || this.isProcessing) return;

    this.isProcessing = true;

    try {
      const aiSettings = await ipcRenderer.invoke('preferences:get', 'aiSettings', {});

      if (!aiSettings.apiKey || !aiSettings.endpoint || !aiSettings.model) {
        return;
      }

      // 获取当前光标位置前的文本作为上下文
      const context = this.getContextText(content);
      if (context.length < this.minInputLength) {
        return;
      }

      const suggestion = await this.callAIAPI(context, aiSettings);

      if (suggestion && suggestion.trim()) {
        this.showSuggestion(suggestion);
      }
    } catch (error) {
      console.error('生成AI建议失败:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // 获取上下文文本
  getContextText(content) {
    const lines = content.split('\n');
    const currentLineIndex = this.cursorPosition.line;
    const currentCol = this.cursorPosition.ch;

    // 获取当前行之前的文本
    const currentLine = lines[currentLineIndex] || '';
    const contextBeforeCursor = currentLine.substring(0, currentCol);

    // 如果当前行有足够的内容，直接使用当前行
    if (contextBeforeCursor.length >= this.minInputLength) {
      return contextBeforeCursor;
    }

    // 否则获取前几行的内容
    let context = '';
    let startLine = Math.max(0, currentLineIndex - 3);

    for (let i = startLine; i <= currentLineIndex; i++) {
      if (i === currentLineIndex) {
        context += lines[i].substring(0, currentCol);
      } else {
        context += lines[i] + '\n';
      }
    }

    return context;
  }

  // 调用AI API
  async callAIAPI(context, settings) {
    const endpoint = settings.endpoint;
    const model = settings.model;
    const systemPrompt = settings.systemPrompt;

    const requestBody = {
      model: model,
      messages: [
        {
          role: 'system',
          content: systemPrompt || t('placeholderAISystemPrompt')
        },
        {
          role: 'user',
          content: `请根据以下上下文续写：\n\n${context}`
        }
      ],
      max_tokens: 100,
      temperature: 0.7,
      stream: false
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(`API错误: ${data.error.message}`);
      }

      return data.choices?.[0]?.message?.content || '';
    } catch (error) {
      console.error('AI API调用失败:', error);
      throw error;
    }
  }

  // 显示建议（内联模式）
  showSuggestion(suggestion) {
    if (!suggestion || !suggestion.trim() || !this.editor) return;

    // 先隐藏之前的建议
    this.hideSuggestion();

    this.currentSuggestion = suggestion.trim();
    
    // 在光标位置插入建议文本并标记为建议样式
    const cursor = this.editor.getCursor();
    const from = cursor;
    const to = { line: cursor.line, ch: cursor.ch };
    
    // 插入建议文本
    this.editor.replaceRange(this.currentSuggestion, from, to);
    
    // 创建标记来设置建议样式
    const suggestionEnd = {
      line: cursor.line,
      ch: cursor.ch + this.currentSuggestion.length
    };
    
    this.suggestionMark = this.editor.markText(from, suggestionEnd, {
      className: 'ai-suggestion-inline',
      atomic: false,
      clearOnEnter: false,
      inclusiveLeft: false,
      inclusiveRight: false
    });
    
    //将光标保持在建议开始位置
    this.editor.setCursor(from);
  }

  // 隐藏建议（内联模式）
  hideSuggestion() {
    if (this.suggestionMark) {
      // 获取建议文本的范围
      const range = this.suggestionMark.find();
      if (range) {
        // 删除建议文本
        this.editor.replaceRange('', range.from, range.to);
      }
      // 清除标记
      this.suggestionMark.clear();
      this.suggestionMark = null;
    }
    this.currentSuggestion = '';
  }

  // 应用建议（内联模式）
  applySuggestion() {
    if (!this.currentSuggestion || !this.suggestionMark) {
      return;
    }

    // 获取建议文本的范围
    const range = this.suggestionMark.find();
    if (range) {
      // 清除建议样式标记，保留文本
      this.suggestionMark.clear();
      this.suggestionMark = null;
      
      // 将光标移动到建议文本末尾
      this.editor.setCursor(range.to);
    }
    
    this.currentSuggestion = '';
  }

  // 自动保存设置
  startAutoSave() {
    // 定期检查设置变化
    setInterval(() => {
      this.loadSettings();
    }, 5000);
  }

  // 销毁
  destroy() {
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
    }

    // 清理建议标记
    this.hideSuggestion();

    // 移除事件监听器
    window.removeEventListener('editor-content-changed', this.handleContentChange.bind(this));
    window.removeEventListener('editor-cursor-changed', this.handleCursorChange.bind(this));
    window.removeEventListener('ai-settings-changed', this.handleSettingsChange.bind(this));
    window.removeEventListener('editor-ready', this.handleEditorReady.bind(this));
    window.removeEventListener('resize', this.hideSuggestion.bind(this));
  }
}

// 导出单例实例
let aiAssistantInstance = null;

export function getAIAssistant() {
  if (!aiAssistantInstance) {
    aiAssistantInstance = new AIAssistant();
  }
  return aiAssistantInstance;
}
