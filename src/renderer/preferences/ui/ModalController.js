/**
 * 模态框控制器
 * 负责 Preferences 模态框的显示/隐藏和生命周期管理
 */
import { SELECTORS, STORAGE_KEYS, TEMPLATE_PATH } from '../constants.js';
import { domCache } from '../../../utils/DOMCache.js';

export class ModalController {
  constructor(deps) {
    this.electronAPI = deps.electronAPI;
    this.i18n = deps.i18n;
    this.eventBus = deps.eventBus;
    this.onClose = deps.onClose || null;
    
    this.modal = null;
    this.isInitialized = false;
  }

  /**
   * 确保模态框存在
   */
  async ensureModalExists() {
    if (this.modal && document.contains(this.modal)) {
      return;
    }

    // 检查是否已存在
    this.modal = document.getElementById('preferences-modal');
    if (this.modal) {
      this.isInitialized = true;
      return;
    }

    // 创建新的模态框
    await this.createModal();
  }

  /**
   * 创建模态框 DOM
   */
  async createModal() {
    const wrapper = document.createElement('div');
    wrapper.id = 'preferences-modal';
    wrapper.className = 'modal hidden';
    wrapper.setAttribute('role', 'dialog');
    wrapper.setAttribute('aria-modal', 'true');
    wrapper.setAttribute('aria-labelledby', 'pref-title');

    try {
      // 读取模板内容
      const templatePath = this.resolveFilePath(TEMPLATE_PATH);
      const htmlContent = this.electronAPI.fs.readFileSync(templatePath, 'utf8');

      wrapper.innerHTML = htmlContent;
      document.body.appendChild(wrapper);

      this.modal = wrapper;

      // 应用国际化
      if (this.i18n && typeof this.i18n.applyI18n === 'function') {
        try {
          this.i18n.applyI18n();
        } catch (error) {
          console.error('[ModalController] Failed to apply i18n:', error);
        }
      }

      // 绑定关闭事件
      this.bindCloseEvents();
      
      this.isInitialized = true;
      
      // 清除 DOM 缓存
      domCache.clearAll();
    } catch (error) {
      console.error('[ModalController] Failed to create modal:', error);
      throw error;
    }
  }

  /**
   * 绑定关闭事件
   */
  bindCloseEvents() {
    if (!this.modal) return;

    // 关闭按钮
    const closeBtn = this.modal.querySelector(SELECTORS.MODAL_CLOSE);
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // ESC 键关闭
    this.handleEscKey = (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    };
    document.addEventListener('keydown', this.handleEscKey);
  }

  /**
   * 打开模态框
   */
  async open() {
    await this.ensureModalExists();
    
    if (!this.modal) {
      console.error('[ModalController] Modal not found');
      return;
    }

    // 应用国际化
    if (this.i18n && typeof this.i18n.applyI18n === 'function') {
      try {
        this.i18n.applyI18n();
      } catch (error) {
        console.error('[ModalController] Failed to apply i18n:', error);
      }
    }

    // 显示模态框
    this.modal.classList.remove('hidden');
    
    // 触发打开事件
    this.eventBus.emit('modal:opened');
  }

  /**
   * 关闭模态框
   */
  close() {
    if (!this.modal) return;

    this.modal.classList.add('hidden');
    
    // 触发关闭事件
    this.eventBus.emit('modal:closed');
    
    // 调用外部回调
    if (this.onClose) {
      this.onClose();
    }
  }

  /**
   * 检查模态框是否打开
   * @returns {boolean}
   */
  isOpen() {
    return this.modal && !this.modal.classList.contains('hidden');
  }

  /**
   * 获取模态框元素
   * @returns {HTMLElement|null}
   */
  getModal() {
    return this.modal;
  }

  /**
   * 销毁模态框
   */
  destroy() {
    if (this.handleEscKey) {
      document.removeEventListener('keydown', this.handleEscKey);
    }
    
    if (this.modal && this.modal.parentNode) {
      this.modal.parentNode.removeChild(this.modal);
    }
    
    this.modal = null;
    this.isInitialized = false;
    
    // 清除 DOM 缓存
    domCache.clearAll();
  }

  /**
   * 解析文件路径
   * @param {string} relativePath - 相对路径
   * @returns {string} 绝对路径
   */
  resolveFilePath(relativePath) {
    const fileUrl = new URL(relativePath, import.meta.url);
    let pathname = decodeURIComponent(fileUrl.pathname);
    if (/^\/[A-Za-z]:/.test(pathname)) {
      pathname = pathname.slice(1);
    }
    return this.electronAPI.path.normalize(pathname);
  }
}
