import { ref } from 'vue';

const isGlobalSearchOpen = ref(false);

/**
 * 搜索 composable
 * 管理全局搜索对话框状态
 */
export function useSearch() {
  const openGlobalSearch = () => {
    isGlobalSearchOpen.value = true;
  };

  const closeGlobalSearch = () => {
    isGlobalSearchOpen.value = false;
  };

  return {
    isGlobalSearchOpen,
    openGlobalSearch,
    closeGlobalSearch,
  };
}
