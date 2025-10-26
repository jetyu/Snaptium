/**
 * 通用对话框工具模块
 * 提供可复用的对话框组件
 */

/**
 * 显示输入对话框
 * @param {Object} options - 对话框选项
 * @param {string} options.title - 对话框标题
 * @param {string} options.message - 提示消息
 * @param {string} [options.placeholder=''] - 输入框占位符
 * @param {string} options.confirmText - 确认按钮文本（必填）
 * @param {string} options.cancelText - 取消按钮文本（必填）
 * @param {Function} options.onConfirm - 确认回调函数，接收输入值
 * @param {Function} options.onCancel - 取消回调函数
 * @returns {void}
 */
export function showInputDialog(options) {
  const {
    title,
    message,
    placeholder = '',
    confirmText,
    cancelText,
    onConfirm,
    onCancel
  } = options;

  // 创建遮罩层
  const overlay = document.createElement('div');
  overlay.className = 'input-dialog-modal';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  
  const content = document.createElement('div');
  content.className = 'input-dialog-modal__content';
  
  // 头部
  const header = document.createElement('div');
  header.className = 'input-dialog-modal__header';
  
  const titleEl = document.createElement('h2');
  titleEl.className = 'input-dialog-modal__title';
  titleEl.textContent = title;
  
  header.appendChild(titleEl);
  
  // 主体
  const body = document.createElement('div');
  body.className = 'input-dialog-modal__body';
  
  const messageEl = document.createElement('p');
  messageEl.className = 'input-dialog-modal__message';
  messageEl.textContent = message;
  
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'input-dialog-modal__input';
  input.placeholder = placeholder;
  
  body.appendChild(messageEl);
  body.appendChild(input);
  
  // 底部按钮
  const footer = document.createElement('div');
  footer.className = 'input-dialog-modal__footer';
  
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'input-dialog-modal__btn input-dialog-modal__btn--secondary';
  cancelBtn.textContent = cancelText;
  
  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'input-dialog-modal__btn input-dialog-modal__btn--primary';
  confirmBtn.textContent = confirmText;
  
  footer.appendChild(cancelBtn);
  footer.appendChild(confirmBtn);
  
  // 组装对话框
  content.appendChild(header);
  content.appendChild(body);
  content.appendChild(footer);
  overlay.appendChild(content);
  document.body.appendChild(overlay);
  
  // 聚焦输入框
  setTimeout(() => input.focus(), 100);
  
  // 清理函数
  const cleanup = () => {
    if (document.body.contains(overlay)) {
      document.body.removeChild(overlay);
    }
  };
  
  // 事件处理
  cancelBtn.onclick = () => {
    cleanup();
    if (onCancel) onCancel();
  };
  
  confirmBtn.onclick = () => {
    const value = input.value.trim();
    if (value && onConfirm) {
      cleanup();
      onConfirm(value);
    }
  };
  
  // 支持键盘操作
  input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      const value = input.value.trim();
      if (value && onConfirm) {
        cleanup();
        onConfirm(value);
      }
    } else if (e.key === 'Escape') {
      cleanup();
      if (onCancel) onCancel();
    }
  };
  
  // 点击遮罩层关闭
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      cleanup();
      if (onCancel) onCancel();
    }
  };
}
