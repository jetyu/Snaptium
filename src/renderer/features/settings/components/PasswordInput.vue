<template>
  <div class="password-input-shell">
    <input :type="inputType" class="settings-input password-input-field" :value="boundValue" :placeholder="placeholder"
      :autocomplete="autocomplete" :disabled="disabled" :name="name" :spellcheck="spellcheck" @input="handleInput"
      @change="handleChange" @keyup.enter="handleEnter" />
    <button type="button" class="password-toggle-btn" :aria-label="toggleAriaLabel" :title="toggleAriaLabel"
      :disabled="disabled" @click="toggleVisibility">
      <IconEye v-if="isVisible" :size="14" />
      <IconEyeOff v-else :size="14" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { IconEye, IconEyeOff } from '@tabler/icons-vue';

const props = withDefaults(defineProps<{
  modelValue?: string;
  value?: string;
  placeholder?: string;
  autocomplete?: string;
  disabled?: boolean;
  name?: string;
  spellcheck?: boolean;
}>(), {
  modelValue: undefined,
  value: undefined,
  placeholder: '',
  autocomplete: 'current-password',
  disabled: false,
  name: undefined,
  spellcheck: false,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'input', event: Event): void;
  (e: 'change', event: Event): void;
  (e: 'keyup.enter', event: KeyboardEvent): void;
}>();

const { t } = useI18n();
const isVisible = ref(false);

const internalValue = ref((props.modelValue ?? props.value) ?? '');

watch(
  () => props.modelValue,
  (next) => {
    if (next !== undefined && next !== internalValue.value) {
      internalValue.value = next;
    }
  }
);

watch(
  () => props.value,
  (next) => {
    if (props.modelValue !== undefined) {
      return;
    }
    if (next !== undefined && next !== internalValue.value) {
      internalValue.value = next;
    }
  }
);

const boundValue = computed(() => {
  if (props.modelValue !== undefined) {
    return props.modelValue;
  }
  if (props.value !== undefined) {
    return props.value;
  }
  return internalValue.value;
});

const inputType = computed(() => (isVisible.value ? 'text' : 'password'));

const toggleAriaLabel = computed(() => {
  return isVisible.value ? t('placeholder.hidePassword') : t('placeholder.showPassword');
});

function updateValue(nextValue: string): void {
  internalValue.value = nextValue;
  emit('update:modelValue', nextValue);
}

function handleInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  updateValue(target.value);
  emit('input', event);
}

function handleChange(event: Event): void {
  emit('change', event);
}

function handleEnter(event: KeyboardEvent): void {
  emit('keyup.enter', event);
}

function toggleVisibility(): void {
  isVisible.value = !isVisible.value;
}
</script>

<style scoped>
.password-input-shell {
  position: relative;
  width: 100%;
}

.password-input-field {
  padding-right: 2.2rem;
}

.password-toggle-btn {
  position: absolute;
  right: 0.45rem;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: #64748b;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.password-toggle-btn:hover:not(:disabled) {
  color: #1e40af;
  background: rgba(59, 130, 246, 0.08);
}

.password-toggle-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
