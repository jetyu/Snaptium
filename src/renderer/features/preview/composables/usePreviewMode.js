import { ref } from 'vue';

export function usePreviewMode() {
  const mode = ref('split');
  return { mode };
}
