/**
 * 搜索模块 - 负责笔记搜索功能
 * @module renderer/workspace/search
 */

import * as vfs from './vfs.js';
import * as tree from './tree.js';
import { t } from '../i18n.js';

// 搜索状态
let searchState = {
  isSearching: false,
  currentQuery: '',
  matchedNodes: []
};

/**
 * 防抖函数
 * @param {Function} func - 要防抖的函数
 * @param {number} delay - 延迟时间(毫秒)
 * @returns {Function} 防抖后的函数
 */
function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * 转义正则表达式特殊字符
 * @param {string} str - 要转义的字符串
 * @returns {string} 转义后的字符串
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 高亮匹配的文本
 * @param {string} query - 搜索关键词
 */
function highlightMatches(query) {
  if (!query) return;
  
  const escapedQuery = escapeRegex(query);
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  
  document.querySelectorAll('.tree-label').forEach(label => {
    const text = label.textContent;
    if (regex.test(text)) {
      const highlighted = text.replace(regex, '<mark>$1</mark>');
      label.innerHTML = highlighted;
    }
  });
}

/**
 * 清除高亮
 */
function clearHighlight() {
  document.querySelectorAll('.tree-label').forEach(label => {
    const text = label.textContent; // 自动去除HTML标签
    label.textContent = text;
  });
}

/**
 * 更新搜索统计信息
 * @param {number} count - 匹配的笔记数量
 * @param {string} query - 搜索关键词
 */
function updateSearchStats(count, query) {
  const statusElem = document.getElementById('status');
  if (!statusElem) return;
  
  if (count === 0) {
    statusElem.textContent = t('search.noResults') || '未找到匹配的笔记';
  } else {
    const message = (t('search.resultsCount') || '找到 {count} 个笔记').replace('{count}', count);
    statusElem.textContent = message;
  }
}

/**
 * 执行搜索
 * @param {string} query - 搜索关键词
 */
function performSearch(query) {
  const trimmedQuery = query.trim();
  
  // 空查询,清除搜索
  if (!trimmedQuery) {
    clearSearch();
    return;
  }
  
  // 搜索节点
  const matchedNodes = vfs.searchNodes(trimmedQuery);
  
  // 更新状态
  searchState.isSearching = true;
  searchState.currentQuery = trimmedQuery;
  searchState.matchedNodes = matchedNodes;
  
  // 应用过滤
  tree.applySearchFilter(matchedNodes);
  
  // 高亮匹配文本
  highlightMatches(trimmedQuery);
  
  // 更新统计信息
  updateSearchStats(matchedNodes.length, trimmedQuery);
  
  // 添加搜索中样式
  const inputElem = document.getElementById('file-search');
  if (inputElem) {
    inputElem.classList.add('searching');
  }
}

/**
 * 清空搜索
 */
function clearSearch() {
  // 重置状态
  searchState.isSearching = false;
  searchState.currentQuery = '';
  searchState.matchedNodes = [];
  
  // 清除输入框
  const inputElem = document.getElementById('file-search');
  if (inputElem) {
    inputElem.value = '';
    inputElem.classList.remove('searching');
  }
  
  // 清除过滤
  tree.clearSearchFilter();
  
  // 清除高亮
  clearHighlight();
  
  // 恢复状态栏
  const statusElem = document.getElementById('status');
  if (statusElem) {
    statusElem.textContent = t('statusReady') || 'Ready';
  }
}

/**
 * 初始化搜索功能
 * @param {HTMLElement} inputElement - 搜索输入框元素
 * @param {HTMLElement} treeContainer - 树容器元素
 */
function initSearch(inputElement, treeContainer) {
  if (!inputElement || !treeContainer) {
    console.warn('搜索初始化失败: 缺少必要的DOM元素');
    return;
  }
  
  // 创建防抖搜索函数
  const debouncedSearch = debounce((query) => {
    performSearch(query);
  }, 300);
  
  // 监听输入事件
  inputElement.addEventListener('input', (e) => {
    const query = e.target.value;
    debouncedSearch(query);
  });
  
  // 监听键盘事件
  inputElement.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      clearSearch();
      inputElement.blur(); // 失去焦点
    }
  });
  
  // 创建清空按钮
  const clearBtn = document.createElement('button');
  clearBtn.className = 'search-clear-btn';
  clearBtn.innerHTML = '×';
  clearBtn.title = t('search.clearSearch');
  clearBtn.style.display = 'none';
  
  // 插入清空按钮
  const toolbar = inputElement.parentElement;
  if (toolbar) {
    toolbar.style.position = 'relative';
    toolbar.appendChild(clearBtn);
  }
  
  // 清空按钮点击事件
  clearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearSearch();
    inputElement.focus();
  });
  
  // 根据输入内容显示/隐藏清空按钮
  inputElement.addEventListener('input', () => {
    if (inputElement.value.trim()) {
      clearBtn.style.display = 'block';
    } else {
      clearBtn.style.display = 'none';
    }
  });
 
}

export {
  initSearch,
  performSearch,
  clearSearch,
};
