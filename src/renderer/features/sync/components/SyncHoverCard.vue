<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="cardRef"
      class="sync-hover-card sync-hover-card--floating"
      :style="style"
      role="status"
      aria-live="polite"
      @mouseenter="$emit('mouseenter')"
      @mouseleave="$emit('mouseleave')"
    >
      <div class="sync-hover-card__row">
        <span class="sync-hover-card__label">{{ t('label.syncStatus') }}</span>
        <span class="sync-status-pill" :class="statusToneClass">{{ statusLabel }}</span>
      </div>
      <div class="sync-hover-card__row">
        <span class="sync-hover-card__label">{{ t('label.lastSynced') }}</span>
        <span class="sync-hover-card__value">{{ formattedLastSynced || '--' }}</span>
      </div>
      <div class="sync-hover-card__section">
        <span class="sync-hover-card__label">{{ t('label.syncSummary') }}</span>
        <div class="summary-pills">
          <span v-for="item in summaryItems" :key="item" class="summary-pill">{{ item }}</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{
  visible: boolean;
  style: Record<string, string>;
  statusLabel: string;
  statusToneClass: string;
  formattedLastSynced: string;
  summaryItems: string[];
}>();

defineEmits<{
  (event: 'mouseenter'): void;
  (event: 'mouseleave'): void;
}>();

const { t } = useI18n();

const cardRef = defineModel<HTMLElement | null>('cardRef', { default: null });
</script>

<style scoped>
.sync-hover-card {
  width: 240px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid var(--panel-border);
  background: color-mix(in srgb, var(--panel) 96%, white);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.12);
}

.sync-hover-card--floating {
  position: fixed;
  z-index: 40;
}

.sync-hover-card__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.sync-hover-card__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sync-hover-card__label {
  font-size: 0.78rem;
  color: var(--text-muted);
  white-space: nowrap;
}

.sync-hover-card__value {
  font-size: 0.8rem;
  color: var(--text);
  text-align: right;
}

.sync-status-pill {
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  border: 1px solid transparent;
}

.summary-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.summary-pill {
  background: rgba(100, 116, 139, 0.05);
  border: 1px solid rgba(100, 116, 139, 0.15);
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.74rem;
  color: #475569;
}

.is-idle {
  background: rgba(16, 185, 129, 0.08);
  border-color: rgba(16, 185, 129, 0.2);
  color: #03865d;
}

.is-syncing {
  background: var(--status-info-bg);
  border-color: var(--status-info-border);
  color: var(--status-info-text);
}

.is-error {
  background: rgba(244, 63, 94, 0.08);
  border-color: rgba(244, 63, 94, 0.2);
  color: #e11d48;
}
</style>
