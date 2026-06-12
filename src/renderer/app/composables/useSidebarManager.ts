import { readonly, ref } from 'vue';

const isSidebarManagerOpen = ref(false);

export function useSidebarManager() {
  const openSidebarManager = () => {
    isSidebarManagerOpen.value = true;
  };

  const closeSidebarManager = () => {
    isSidebarManagerOpen.value = false;
  };

  return {
    isSidebarManagerOpen: readonly(isSidebarManagerOpen),
    openSidebarManager,
    closeSidebarManager,
  };
}
