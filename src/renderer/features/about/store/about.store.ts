import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useAboutStore = defineStore('about', () => {
  const isOpen = ref(false);

  const openAbout = () => {
    isOpen.value = true;
  };

  const closeAbout = () => {
    isOpen.value = false;
  };

  return {
    isOpen,
    openAbout,
    closeAbout
  };
});
