<template>
  <div class="shortcut-input">
    <input
      ref="inputRef"
      type="text"
      :value="displayValue"
      :placeholder="placeholder"
      :class="{ 'has-conflict': hasConflict, 'is-recording': isRecording }"
      readonly
      @click="startRecording"
      @blur="stopRecording"
      @keydown="handleKeyDown"
    />
    <button
      v-if="modelValue"
      class="clear-button"
      type="button"
      @click="handleClear"
    >
      ×
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

interface Props {
  modelValue?: string;
  placeholder?: string;
  hasConflict?: boolean;
}

interface Emits {
  (e: 'update:modelValue', value: string): void;
  (e: 'conflict', value: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: 'Press keys...',
  hasConflict: false,
});

const emit = defineEmits<Emits>();

const inputRef = ref<HTMLInputElement>();
const isRecording = ref(false);
const recordedKeys = ref<string[]>([]);

const displayValue = computed(() => {
  if (isRecording.value && recordedKeys.value.length > 0) {
    return recordedKeys.value.join('+');
  }
  return props.modelValue;
});

function startRecording() {
  isRecording.value = true;
  recordedKeys.value = [];
  inputRef.value?.focus();
}

function stopRecording() {
  if (isRecording.value && recordedKeys.value.length > 0) {
    const shortcut = recordedKeys.value.join('+');
    emit('update:modelValue', shortcut);
  }
  isRecording.value = false;
  recordedKeys.value = [];
}

function handleKeyDown(event: KeyboardEvent) {
  if (!isRecording.value) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const keys: string[] = [];

  // 添加修饰键
  if (event.ctrlKey || event.metaKey) {
    keys.push('CommandOrControl');
  }
  if (event.altKey) {
    keys.push('Alt');
  }
  if (event.shiftKey) {
    keys.push('Shift');
  }

  // 添加主键
  const mainKey = normalizeKey(event.key);
  if (mainKey && !isModifierKey(event.key)) {
    keys.push(mainKey);
    recordedKeys.value = keys;
    
    // 延迟停止录制，让用户看到完整的快捷键
    setTimeout(() => {
      stopRecording();
    }, 300);
  } else {
    recordedKeys.value = keys;
  }
}

function normalizeKey(key: string): string {
  const keyMap: Record<string, string> = {
    ' ': 'Space',
    'Escape': 'Escape',
    'Enter': 'Enter',
    'Tab': 'Tab',
    'Backspace': 'Backspace',
    'Delete': 'Delete',
    'ArrowUp': 'Up',
    'ArrowDown': 'Down',
    'ArrowLeft': 'Left',
    'ArrowRight': 'Right',
  };

  if (keyMap[key]) {
    return keyMap[key];
  }

  if (key.length === 1) {
    return key.toUpperCase();
  }

  return key;
}

function isModifierKey(key: string): boolean {
  return ['Control', 'Alt', 'Shift', 'Meta', 'Command'].includes(key);
}

function handleClear() {
  emit('update:modelValue', '');
}

// 监听冲突状态
watch(() => props.hasConflict, (hasConflict) => {
  if (hasConflict && props.modelValue) {
    emit('conflict', props.modelValue);
  }
});
</script>

<style scoped>
.shortcut-input {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.shortcut-input input {
  padding: 6px 32px 6px 12px;
  border: 1px solid var(--input-border);
  border-radius: 8px;
  font-family: monospace;
  font-size: 13px;
  min-width: 200px;
  cursor: pointer;
  background-color: var(--input-bg);
  color: var(--text-primary);
  transition: all 0.2s;
}

.shortcut-input input:focus {
  outline: none;
  border-color: var(--input-border-focus);
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.shortcut-input input.is-recording {
  border-color: var(--input-border-focus);
  background-color: var(--surface-selected);
}

.shortcut-input input.has-conflict {
  border-color: var(--status-danger-border);
  background-color: var(--status-danger-bg);
}

.clear-button {
  position: absolute;
  right: 8px;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  transition: color 0.2s;
}

.clear-button:hover {
  color: var(--text-primary);
}
</style>
