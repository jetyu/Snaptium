<template>
    <div class="workbench-config-panel__content">
        <div class="workbench-config-panel__header">
            <strong>{{ t('workbench.config.title') }}</strong>
            <button type="button" class="workbench-config-panel__close" :aria-label="t('common.close')"
                @click="$emit('close')">
                <Close theme="outline" :size="16" />
            </button>
        </div>

        <div class="workbench-config-panel__chips">
            <button v-for="module in moduleDefinitions" :key="module.id" type="button" class="workbench-config-chip"
                :class="{ 'is-active': isModuleVisible(module.id) }" @click="$emit('toggle-module', module.id)">
                <span class="workbench-config-chip__order">{{ getModuleOrder(module.id) }}</span>
                <span>{{ t(module.labelKey) }}</span>
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { type PropType } from 'vue';
import { Close } from '@icon-park/vue-next';
import { useI18n } from 'vue-i18n';
import { type WorkbenchModuleDefinition, type WorkbenchModuleId } from '../constants/workbench.constants';

const props = defineProps({
    moduleDefinitions: {
        type: Array as PropType<WorkbenchModuleDefinition[]>,
        required: true,
    },
    visibleModuleIds: {
        type: Array as PropType<WorkbenchModuleId[]>,
        required: true,
    },
});

defineEmits<{
    (event: 'toggle-module', moduleId: WorkbenchModuleId): void;
    (event: 'close'): void;
}>();

const { t } = useI18n();

function isModuleVisible(moduleId: WorkbenchModuleId) {
    return props.visibleModuleIds.includes(moduleId);
}

function getModuleOrder(moduleId: WorkbenchModuleId) {
    const index = props.visibleModuleIds.indexOf(moduleId);
    return index === -1 ? '+' : `${index + 1}`;
}

</script>

<style scoped>
.workbench-config-panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
}

.workbench-config-panel__header strong {
    font-size: 0.92rem;
}

.workbench-config-panel__close {
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
}

.workbench-config-panel__close:hover {
    background: color-mix(in srgb, var(--accent) 8%, var(--panel));
}

.workbench-config-panel__section {
    margin-bottom: 14px;
    padding: 12px 0;
    border-bottom: 1px solid color-mix(in srgb, var(--panel-border), transparent);
}

.workbench-config-checkbox {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    user-select: none;
    font-size: 0.92rem;
}

.workbench-config-checkbox input {
    width: 16px;
    height: 16px;
}

.workbench-config-panel__hint {
    margin: 8px 0 0;
    color: var(--text-muted);
    font-size: 0.82rem;
    line-height: 1.4;
}

.workbench-config-panel__chips {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 10px;
}

.workbench-config-chip {
    display: inline-flex;
    align-items: center;
    justify-content: start;
    gap: 8px;
    padding: 10px 12px;
    border: 1px solid var(--panel-border);
    border-radius: 12px;
    background: color-mix(in srgb, var(--panel) 90%, white);
    color: var(--text);
    cursor: pointer;
    transition: border-color 0.18s ease, background-color 0.18s ease;
}

.workbench-config-chip:hover {
    border-color: color-mix(in srgb, var(--accent) 26%, var(--panel-border));
}

.workbench-config-chip.is-active {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, var(--panel));
}

.workbench-config-chip__order {
    width: 18px;
    min-width: 18px;
    text-align: center;
    font-size: 0.78rem;
    font-weight: 700;
}
</style>
