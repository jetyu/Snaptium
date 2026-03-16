import { ref } from 'vue';

export function useAsyncState() {
  const isLoading = ref(false);
  const error = ref('');

  function start() {
    isLoading.value = true;
    error.value = '';
  }

  function fail(message: string) {
    isLoading.value = false;
    error.value = message;
  }

  function done() {
    isLoading.value = false;
  }

  return { isLoading, error, start, fail, done };
}
