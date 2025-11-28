/**
 * 加密设置管理器（恢复密钥方案）
 * 负责处理加密相关的所有UI逻辑和用户交互
 */
import { SELECTORS } from '../constants.js';
import { showInputDialogWithValidation } from '../ui/DialogController.js';

export class EncryptionSettingsManager {
  constructor(deps) {
    this.electronAPI = deps.electronAPI;
    this.prefsService = deps.prefsService;
    this.i18n = deps.i18n;
    this.eventBus = deps.eventBus;
    this.modal = deps.modal;
    
    this.isEncryptionEnabled = false;
    this.isInitialized = false;
    this.currentRecoveryKey = null;
    this.handleLanguageChange = this.handleLanguageChange.bind(this);
  }

  /**
   * 初始化加密设置管理器
   */
  async init() {
    if (this.isInitialized) return;
    
    this.setupElements();
    this.attachEventListeners();
    await this.loadSettings();
    
    this.isInitialized = true;
  }

  /**
   * 设置 DOM 元素引用
   */
  setupElements() {
    this.elements = {
      // 区域容器
      disabledSection: document.querySelector('#encryption-disabled-section'),
      setupSection: document.querySelector(SELECTORS.ENCRYPTION_SETUP_SECTION),
      enabledSection: document.querySelector('#encryption-enabled-section'),
      statusSection: document.querySelector(SELECTORS.ENCRYPTION_STATUS_SECTION),
      
      // 启用加密按钮
      enableEncryptionBtn: document.querySelector('#btn-enable-encryption'),
      
      // 设置加密 - 恢复密钥
      recoveryKeyDisplay: document.querySelector('#recovery-key-display'),
      confirmSavedKeyTextCheckbox: document.querySelector('#confirm-saved-key'),
      copyKeyBtn: document.querySelector('#btn-copy-key'),
      downloadKeyBtn: document.querySelector('#btn-download-key'),
      confirmSetupBtn: document.querySelector('#btn-confirm-setup'),
      cancelSetupBtn: document.querySelector('#btn-cancel-setup'),
      
      // 加密管理按钮
      exportKeyBtn: document.querySelector('#btn-export-key'),
      regenerateKeyBtn: document.querySelector('#btn-regenerate-key'),
      disableEncryptionBtn: document.querySelector('#btn-disable-encryption'),
      
      // 状态显示
      statusText: document.querySelector(SELECTORS.ENCRYPTION_STATUS_TEXT),
    };
  }

  /**
   * 绑定事件监听器
   */
  attachEventListeners() {
    // 启用加密按钮
    this.elements.enableEncryptionBtn?.addEventListener('click', () => {
      this.showSetupWizard();
    });

    // 恢复密钥确认
    this.elements.confirmSavedKeyTextCheckbox?.addEventListener('change', (e) => {
      if (this.elements.confirmSetupBtn) {
        this.elements.confirmSetupBtn.disabled = !e.target.checked;
      }
    });

    // 复制密钥
    this.elements.copyKeyBtn?.addEventListener('click', () => {
      this.copyRecoveryKey();
    });

    // 下载密钥
    this.elements.downloadKeyBtn?.addEventListener('click', () => {
      this.downloadRecoveryKey();
    });

    // 完成设置按钮
    this.elements.confirmSetupBtn?.addEventListener('click', () => {
      this.handleConfirmSetup();
    });

    // 取消设置按钮
    this.elements.cancelSetupBtn?.addEventListener('click', () => {
      this.cancelSetup();
    });

    // 禁用加密
    this.elements.disableEncryptionBtn?.addEventListener('click', () => {
      this.handleDisableEncryption();
    });

    // 批量加密
    const batchEncryptBtn = document.querySelector('#btn-batch-encrypt');
    batchEncryptBtn?.addEventListener('click', () => {
      this.handleBatchEncrypt();
    });

    // 监听语言变化事件
    window.addEventListener('languageChanged', this.handleLanguageChange);
  }

  /**
   * 加载加密设置
   */
  async loadSettings() {
    try {
      // 检查是否已启用加密
      const result = await this.electronAPI.ipcRenderer.invoke('encryption:is-enabled');
      this.isEncryptionEnabled = result?.enabled || false;

      this.updateUI();
    } catch (error) {
      console.error('Failed to load encryption settings:', error);
    }
  }

  /**
   * 更新UI显示状态
   */
  updateUI() {
    if (this.isEncryptionEnabled) {
      // 已启用加密
      this.hideElement(this.elements.disabledSection);
      this.hideElement(this.elements.setupSection);
      this.showElement(this.elements.enabledSection);
      this.updateStatusText(this.i18n.t('encryptionStatusEnabled'), 'enabled');
    } else {
      // 未启用加密
      this.showElement(this.elements.disabledSection);
      this.hideElement(this.elements.setupSection);
      this.hideElement(this.elements.enabledSection);
      this.updateStatusText(this.i18n.t('encryptionStatusDisabled'), 'disabled');
    }
  }

  /**
   * 显示设置向导
   */
  async showSetupWizard() {
    try {
      // 生成恢复密钥
      const result = await this.electronAPI.ipcRenderer.invoke('encryption:generate-recovery-key');
      if (!result.success) {
        throw new Error(result.error);
      }

      this.currentRecoveryKey = result.recoveryKey;
      
      // 显示密钥
      if (this.elements.recoveryKeyDisplay) {
        this.elements.recoveryKeyDisplay.value = this.currentRecoveryKey;
      }

      // 重置确认复选框
      if (this.elements.confirmSavedKeyTextCheckbox) {
        this.elements.confirmSavedKeyTextCheckbox.checked = false;
      }
      if (this.elements.confirmSetupBtn) {
        this.elements.confirmSetupBtn.disabled = true;
      }

      this.hideElement(this.elements.disabledSection);
      this.showElement(this.elements.setupSection);
      this.updateStatusText(this.i18n.t('encryptionStatusPending'), 'pending');
    } catch (error) {
      console.error('Failed to show setup wizard:', error);
      this.showMessage(this.i18n.t('errorGenerateKeyFailed') + ': ' + error.message, 'error');
    }
  }

  /**
   * 取消设置
   */
  cancelSetup() {
    this.currentRecoveryKey = null;
    if (this.elements.recoveryKeyDisplay) {
      this.elements.recoveryKeyDisplay.value = '';
    }
    if (this.elements.confirmSavedKeyTextCheckbox) {
      this.elements.confirmSavedKeyTextCheckbox.checked = false;
    }
    this.hideElement(this.elements.setupSection);
    this.showElement(this.elements.disabledSection);
    this.updateStatusText(this.i18n.t('encryptionStatusDisabled'), 'disabled');
  }

  /**
   * 复制恢复密钥
   */
  async copyRecoveryKey() {
    try {
      if (!this.currentRecoveryKey) {
        throw new Error(this.i18n.t('errorNoRecoveryKey'));
      }

      await navigator.clipboard.writeText(this.currentRecoveryKey);
      this.showMessage(this.i18n.t('successKeyCopied'), 'success');
    } catch (error) {
      console.error('Failed to copy recovery key:', error);
      this.showMessage(this.i18n.t('errorCopyFailed') + ': ' + error.message, 'error');
    }
  }

  /**
   * 下载恢复密钥
   */
  async downloadRecoveryKey() {
    try {
      if (!this.currentRecoveryKey) {
        throw new Error(this.i18n.t('errorNoRecoveryKey'));
      }

      // 生成时间戳格式：YYYYMMDDHHMM
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hour = String(now.getHours()).padStart(2, '0');
      const minute = String(now.getMinutes()).padStart(2, '0');
      const timestamp = `${year}${month}${day}${hour}${minute}`;

      const blob = new Blob([this.currentRecoveryKey], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `notewizard-recovery-key-${timestamp}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showMessage(this.i18n.t('successKeyDownloaded'), 'success');
    } catch (error) {
      console.error('Failed to download recovery key:', error);
      this.showMessage(this.i18n.t('errorDownloadFailed') + ': ' + error.message, 'error');
    }
  }

  /**
   * 处理确认设置
   */
  async handleConfirmSetup() {
    if (!this.currentRecoveryKey) {
      this.showMessage(this.i18n.t('errorNoRecoveryKey'), 'error');
      return;
    }

    try {
      this.elements.confirmSetupBtn.disabled = true;
      this.elements.confirmSetupBtn.textContent = this.i18n.t('processing');

      // 调用后端 IPC 设置加密
      const result = await this.electronAPI.ipcRenderer.invoke('encryption:setup', { 
        recoveryKey: this.currentRecoveryKey 
      });
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      this.isEncryptionEnabled = true;
      this.currentRecoveryKey = null;
      this.hideElement(this.elements.setupSection);
      this.updateUI();
      
      this.showMessage(this.i18n.t('successEncryptionEnabled'), 'success');
      
      // 自动批量加密现有笔记
      setTimeout(() => {
        this.handleBatchEncrypt();
      }, 500);
    } catch (error) {
      console.error('Failed to setup encryption:', error);
      this.showMessage(this.i18n.t('errorSetupFailed') + ': ' + error.message, 'error');
    } finally {
      this.elements.confirmSetupBtn.disabled = false;
      this.elements.confirmSetupBtn.textContent = this.i18n.t('btnConfirmSetup');
    }
  }

  /**
   * 处理禁用加密
   */
  async handleDisableEncryption() {
    // 创建验证函数
    const validateKey = async (recoveryKey) => {
      const verifyResult = await this.electronAPI.ipcRenderer.invoke(
        'encryption:verify-key', 
        { recoveryKey }
      );
      
      if (!verifyResult.success) {
        return { success: false, error: verifyResult.error };
      }
      
      if (!verifyResult.valid) {
        return { success: false, error: this.i18n.t('errorKeyIncorrect') };
      }
      
      return { success: true };
    };
    
    // 显示带验证的输入对话框
    const recoveryKey = await showInputDialogWithValidation({
      title: this.i18n.t('inputRecoveryKeyTitle'),
      message: this.i18n.t('inputRecoveryKeyMessage'),
      placeholder: this.i18n.t('inputRecoveryKeyPlaceholder') ,
      confirmText: this.i18n.t('btnConfirm') ,
      cancelText: this.i18n.t('btnCancel') ,
      validateFn: validateKey
    });
    
    if (!recoveryKey) {
      return; // 用户取消
    }
    
    try {
      // 执行禁用加密
      this.showMessage(this.i18n.t('infoDecryptingNotes'), 'info');
      
      // 先批量解密所有笔记
      const decryptResult = await this.electronAPI.ipcRenderer.invoke('encryption:decrypt-all');
      
      if (!decryptResult.success) {
        throw new Error(decryptResult.error);
      }
      
      // 再禁用加密
      const result = await this.electronAPI.ipcRenderer.invoke('encryption:disable');
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      // 更新UI状态
      this.isEncryptionEnabled = false;
      this.updateUI();
      
      const message = this.i18n.t('encryptionDisabled', { decrypted: decryptResult.decrypted || 0 });
      this.showMessage(message, 'success');
      
    } catch (error) {
      console.error('Failed to disable encryption:', error);
      this.showMessage(this.i18n.t('errorDisableFailed') + ': ' + error.message, 'error');
    }
  }

  /**
   * 处理批量加密
   */
  async handleBatchEncrypt() {
    try {
      this.showMessage(this.i18n.t('infoEncryptingNotes'), 'info');
      
      const result = await this.electronAPI.ipcRenderer.invoke('encryption:encrypt-all');
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      // 根据结果选择合适的消息
      let message;
      if (result.failed > 0) {
        message = this.i18n.t('batchEncryptWithFailed', { 
          encrypted: result.encrypted, 
          failed: result.failed 
        });
      } else if (result.skipped > 0) {
        message = this.i18n.t('batchEncryptWithSkipped', { 
          encrypted: result.encrypted, 
          skipped: result.skipped 
        });
      } else {
        message = this.i18n.t('batchEncryptSuccess', { 
          encrypted: result.encrypted 
        });
      }
      
      this.showMessage(message, 'success');
    } catch (error) {
      console.error('Failed to batch encrypt:', error);
      this.showMessage(this.i18n.t('errorEncryptAllFailed') + ': ' + error.message, 'error');
    }
  }

  /**
   * 处理语言变化事件
   */
  handleLanguageChange() {
    this.updateUI();
  }

  /**
   * 更新状态文本
   */
  updateStatusText(text, status) {
    if (!this.elements.statusText) return;
    
    this.elements.statusText.textContent = text;
    this.elements.statusText.className = `status-value status-${status}`;
  }

  /**
   * 显示元素
   */
  showElement(element) {
    if (element) element.style.display = 'block';
  }

  /**
   * 隐藏元素
   */
  hideElement(element) {
    if (element) element.style.display = 'none';
  }

  // 原有的 showInputDialogWithValidation 已被提取为通用组件，
  // 现在通过 DialogController 提供的工具函数来实现相同能力。

  /**
   * 显示消息
   */
  showMessage(message, type = 'info') {
    // 使用事件总线发送消息
    this.eventBus?.emit('show-message', { message, type });
    
    // Fallback: use alert for errors, console for success
    if (type === 'error') {
      alert('Error: ' + message);
    } else if (type === 'success') {
      console.log('[Encryption] Success:', message);
    }
  }

  /**
   * 销毁管理器
   */
  destroy() {
    // 移除语言变化事件监听器
    window.removeEventListener('languageChanged', this.handleLanguageChange);
    
    // 清理事件监听器
    this.isInitialized = false;
  }
}
