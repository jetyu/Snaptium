import { ref } from 'vue';

const isGlobalSearchOpen = ref(false);
const globalSearchInitialQuery = ref('');

/**
 * 搜索 composable
 * 管理全局搜索对话框状态
 */
export function useSearch() {
  const openGlobalSearch = (initialQuery = '') => {
    globalSearchInitialQuery.value = initialQuery;
    isGlobalSearchOpen.value = true;
  };

  const closeGlobalSearch = () => {
    isGlobalSearchOpen.value = false;
    globalSearchInitialQuery.value = '';
  };

  return {
    isGlobalSearchOpen,
    globalSearchInitialQuery,
    openGlobalSearch,
    closeGlobalSearch,
  };
}
