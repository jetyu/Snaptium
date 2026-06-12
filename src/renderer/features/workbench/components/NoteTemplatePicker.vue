<template>
  <div class="note-template-picker" :class="`note-template-picker--${variant}`">
    <button v-for="template in templateCards" :key="template.id" type="button" class="note-template-picker__card"
      :class="{ [template.toneClass]: true, 'is-selected': modelValue === template.id }"
      :aria-pressed="modelValue === template.id" @click="selectTemplate(template.id)">
      <span class="note-template-picker__icon">
        <component :is="template.icon" :size="18" />
      </span>
      <span class="note-template-picker__copy">
        <strong>{{ template.title }}</strong>
        <span>{{ template.description }}</span>
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue';
import { useI18n } from 'vue-i18n';
import { IconBook, IconFilePlus, IconPencil, IconFileText } from '@tabler/icons-vue';
import {
  NOTE_TEMPLATE_DEFINITIONS,
  type NoteTemplateIconName,
  type NoteTemplateId,
} from '@renderer/features/workspace/templates';

interface NoteTemplateCard {
  id: NoteTemplateId;
  title: string;
  description: string;
  icon: Component;
  toneClass: string;
}

withDefaults(defineProps<{
  modelValue: NoteTemplateId;
  variant?: 'default' | 'compact';
}>(), {
  variant: 'default',
});

const emit = defineEmits<{
  (event: 'update:modelValue', value: NoteTemplateId): void;
  (event: 'select', value: NoteTemplateId): void;
}>();

const { t } = useI18n();

const templateIconComponents = {
  docAdd: IconFilePlus,
  edit: IconPencil,
  notes: IconFileText,
  bookOpen: IconBook,
} as const satisfies Record<NoteTemplateIconName, Component>;

const templateCards = computed<NoteTemplateCard[]>(() =>
  NOTE_TEMPLATE_DEFINITIONS.map((template) => ({
    id: template.id,
    title: t(template.titleKey),
    description: t(template.descriptionKey),
    icon: templateIconComponents[template.iconName],
    toneClass: template.toneClass,
  })),
);

function selectTemplate(templateId: NoteTemplateId): void {
  emit('update:modelValue', templateId);
  emit('select', templateId);
}
</script>

<style scoped>
.note-template-picker {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.note-template-picker--compact {
  grid-template-columns: minmax(0, 1fr);
}

.note-template-picker__card {
  min-width: 0;
  min-height: 86px;
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  align-items: center;
  gap: 11px;
  padding: 12px;
  border: 1px solid var(--panel-border, #dbe3ef);
  border-radius: 8px;
  background: color-mix(in srgb, var(--panel, #ffffff) 96%, #f8fafc);
  color: var(--text, #111827);
  cursor: pointer;
  text-align: left;
  transition: transform 0.16s ease, background-color 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
}

.note-template-picker__card:hover {
  transform: translateY(-1px);
  border-color: var(--panel-border, #dbe3ef);
  background: var(--panel-hover, #f5f7fa);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.09);
}

.note-template-picker__card.is-selected {
  border-color: color-mix(in srgb, var(--accent) 58%, var(--panel-border, #dbe3ef));
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 11%, var(--panel, #ffffff)), var(--panel, #ffffff));
}

.note-template-picker__icon {
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: 8px;
}

.note-template-picker__copy {
  min-width: 0;
  display: grid;
  gap: 5px;
}

.note-template-picker__copy strong {
  overflow: hidden;
  color: var(--text, #111827);
  font-size: 0.88rem;
  font-weight: 720;
  line-height: 1.22;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-template-picker__copy span {
  overflow: hidden;
  display: -webkit-box;
  color: var(--text-secondary, #64748b);
  font-size: 0.78rem;
  line-height: 1.35;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.tone-primary .note-template-picker__icon {
  background: color-mix(in srgb, var(--accent) 13%, transparent);
  color: var(--accent-hover);
}

.tone-sky .note-template-picker__icon {
  background: color-mix(in srgb, #0ea5e9 13%, transparent);
  color: #0284c7;
}

.tone-soft .note-template-picker__icon {
  background: color-mix(in srgb, #10b981 12%, transparent);
  color: #059669;
}

.tone-deep .note-template-picker__icon {
  background: color-mix(in srgb, #8b5cf6 13%, transparent);
  color: #7c3aed;
}

:global([data-theme='dark']) .note-template-picker__card {
  background: rgba(255, 255, 255, 0.04);
}

:global([data-theme='dark']) .note-template-picker__card.is-selected {
  background: color-mix(in srgb, var(--accent) 13%, transparent);
}

:global([data-theme='dark']) .note-template-picker__card:hover {
  background: var(--panel-hover, #252932);
}

@media (max-width: 760px) {
  .note-template-picker {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
