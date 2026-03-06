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
  matchedNodes: [],
  searchResults: [], // 全文搜索结果（包含匹配信息）
  searchMode: 'all', // 'title', 'content', 'all'
  abortController: null // 用于取消搜索
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
 * 转义 HTML 特殊字符，防止 XSS
 * @param {string} str - 要转义的字符串
 * @returns {string} 转义后的字符串
 */
function escapeHTML(str) {
  if (!str) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return str.replace(/[&<>"']/g, (m) => map[m]);
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
      const escapedText = escapeHTML(text);
      const highlighted = escapedText.replace(regex, '<mark>$1</mark>');
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
 * @param {Object} progressInfo - 进度信息
 */
function updateSearchStats(count, query, progressInfo = null) {
  const statusElem = document.getElementById('status');
  if (!statusElem) return;

  if (progressInfo && progressInfo.progress < 100) {
    // 搜索进行中
    const totalNodes = progressInfo.total || 0;
    let message = t('search.searching');

    if (totalNodes > 1000) {
      message = t('search.searchingLarge');
    }

    statusElem.textContent = `${message} (${progressInfo.progress}%)`;
  } else if (count === 0) {
    statusElem.textContent = t('search.noResults');
  } else {
    const message = t('search.resultsCount').replace('{count}', count);
    statusElem.textContent = message;
  }
}

/**
 * 执行搜索
 * @param {string} query - 搜索关键词
 */
async function performSearch(query) {
  const trimmedQuery = query.trim();

  // 空查询,清除搜索
  if (!trimmedQuery) {
    clearSearch();
    return;
  }

  // 取消之前的搜索
  if (searchState.abortController) {
    searchState.abortController.abort();
  }

  // 创建新的 AbortController
  searchState.abortController = new AbortController();

  // 更新状态
  searchState.isSearching = true;
  searchState.currentQuery = trimmedQuery;

  // 添加搜索中样式
  const inputElem = document.getElementById('file-search');
  if (inputElem) {
    inputElem.classList.add('searching');
  }

  // 显示初始进度
  updateSearchStats(0, trimmedQuery, { progress: 0 });

  try {
    // 执行全文搜索
    const searchResults = await vfs.searchNodesFullText(
      trimmedQuery,
      {
        caseSensitive: false,
        searchIn: searchState.searchMode,
        includeTrashed: false,
        maxResults: 100,
        maxNodes: 1000,
        batchSize: 50
      },
      (progressInfo) => {
        // 进度回调
        if (!searchState.abortController.signal.aborted) {
          updateSearchStats(progressInfo.resultsCount, trimmedQuery, progressInfo);
        }
      }
    );

    // 检查是否被取消
    if (searchState.abortController.signal.aborted) {
      return;
    }

    // 提取节点列表
    const matchedNodes = searchResults.map(result => result.node);

    // 更新状态
    searchState.matchedNodes = matchedNodes;
    searchState.searchResults = searchResults;

    // 应用过滤
    tree.applySearchFilter(matchedNodes);

    // 高亮匹配文本
    highlightMatches(trimmedQuery);

    // 更新统计信息
    updateSearchStats(matchedNodes.length, trimmedQuery);

  } catch (error) {
    console.error('occur error:', error);
    updateSearchStats(0, trimmedQuery);
  } finally {
    searchState.abortController = null;
  }
}

/**
 * 清空搜索
 */
function clearSearch() {
  // 取消正在进行的搜索
  if (searchState.abortController) {
    searchState.abortController.abort();
    searchState.abortController = null;
  }

  // 重置状态
  searchState.isSearching = false;
  searchState.currentQuery = '';
  searchState.matchedNodes = [];
  searchState.searchResults = [];

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
    console.warn('occur error: search init failed, missing necessary DOM elements');
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
  clearBtn.textContent = '×';
  clearBtn.setAttribute('data-i18n-title', 'search.clearSearch');
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

/**
 * 设置搜索模式
 * @param {string} mode - 搜索模式: 'title', 'content', 'all'
 */
function setSearchMode(mode) {
  if (['title', 'content', 'all'].includes(mode)) {
    searchState.searchMode = mode;

    // 如果当前有搜索，重新执行
    if (searchState.currentQuery) {
      performSearch(searchState.currentQuery);
    }
  }
}

/**
 * 获取当前搜索结果（包含匹配信息）
 * @returns {Array} 搜索结果数组
 */
function getSearchResults() {
  return searchState.searchResults;
}

export {
  initSearch,
  performSearch,
  clearSearch,
  setSearchMode,
  getSearchResults,
};
