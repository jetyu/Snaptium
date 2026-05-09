<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="isOpen" class="trash-overlay" @keydown.esc="closeTrash" tabindex="0" ref="overlayRef">
        <div class="trash-dialog" @click.stop>
          <div class="trash-header">
            <div class="header-left">
              <Delete theme="outline" :size="20" class="trash-icon" />
              <h2>{{ $t('label.trash') }}</h2>
            </div>
            <div class="header-right">
              <button v-if="trashedNodes.length > 0" class="btn-empty" @click="onEmptyTrash" :title="$t('trash.empty')"
                :disabled="isEmptying || Boolean(activeNodeId)">
                <Clear theme="outline" :size="16" />
                <span>{{ $t('trash.empty') }}</span>
              </button>
              <button @click="closeTrash" class="btn-close">
                <Close theme="outline" :size="18" />
              </button>
            </div>
          </div>

          <div class="trash-content">
            <div v-if="error" class="error-banner" role="alert">
              <span class="error-text">{{ error }}</span>
              <button class="error-dismiss" aria-label="Dismiss error" @click="clearError">
                <Close theme="outline" :size="14" />
              </button>
            </div>
            <div v-if="isLoading" class="loading-state">
              <div class="spinner"></div>
            </div>
            <div v-else-if="trashedNodes.length === 0" class="empty-state">
              <Delete theme="outline" :size="48" class="empty-icon" />
              <p>{{ $t('trash.emptyState') }}</p>
            </div>
            <div v-else class="trash-list-wrapper">
              <table class="trash-table">
                <thead>
                  <tr>
                    <th>{{ $t('trash.name') }}</th>
                    <th>{{ $t('trash.deletedAt') }}</th>
                    <th class="actions-col">{{ $t('trash.actions') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="node in trashedNodes" :key="node.id">
                    <td>
                      <div class="node-name">
                        <Notes v-if="node.type === 'file'" theme="outline" :size="14" />
                        <NotebookOne v-else theme="outline" :size="14" />
                        <span class="name-text">{{ node.name }}</span>
                        <span v-if="node.childCount > 0" class="child-count">
                          ({{ $t('trash.containsItems', { count: node.childCount }) }})
                        </span>
                      </div>
                    </td>
                    <td>{{ formatTime(node.updatedAt) }}</td>
                    <td class="actions-col">
                      <div class="action-buttons">
                        <button class="btn-inline-action restore" @click="onRestoreNode(node.id)"
                          :title="$t('trash.restore') || 'Restore'" :disabled="Boolean(activeNodeId) || isEmptying">
                          <Refresh theme="outline" :size="14" />
                        </button>
                        <button class="btn-inline-action delete" @click="onDeleteNode(node.id)"
                          :title="$t('trash.deletePermanently') || 'Delete Permanently'"
                          :disabled="Boolean(activeNodeId) || isEmptying">
                          <Delete theme="outline" :size="14" />
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { useTrash } from '../composables/useTrash';
import { Delete, Close, Clear, Refresh, Notes, NotebookOne } from '@icon-park/vue-next';

const { isOpen, trashedNodes, isLoading, error, clearError, closeTrash, restoreNode, permanentlyDeleteNode, emptyTrash } = useTrash();
const overlayRef = ref<HTMLElement | null>(null);
const activeNodeId = ref<string | null>(null);
const isEmptying = ref(false);

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleString();
};

const onEmptyTrash = async () => {
  isEmptying.value = true;
  try {
    await emptyTrash();
  } finally {
    isEmptying.value = false;
  }
};

const onRestoreNode = async (nodeId: string) => {
  activeNodeId.value = nodeId;
  try {
    await restoreNode(nodeId);
  } finally {
    activeNodeId.value = null;
  }
};

const onDeleteNode = async (nodeId: string) => {
  activeNodeId.value = nodeId;
  try {
    await permanentlyDeleteNode(nodeId);
  } finally {
    activeNodeId.value = null;
  }
};

watch(isOpen, async (newVal) => {
  if (newVal) {
    await nextTick();
    overlayRef.value?.focus();
  }
});
</script>

<style scoped>
.trash-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
}

.trash-dialog {
  width: 90%;
  max-width: 700px;
  height: 600px;
  background: var(--panel, #ffffff);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--panel-border, #e5e7eb);
}

.trash-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--panel-border, #e5e7eb);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--panel-header, #f9fafb);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-left h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text, #111827);
}

.trash-icon {
  color: var(--accent, #dc2626);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-empty {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: transparent;
  border: 1px solid var(--panel-border, #e5e7eb);
  border-radius: 6px;
  color: var(--text-muted, #ef4444);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-empty:hover {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  border-color: var(--accent);
  color: var(--accent);
}

.btn-close {
  background: transparent;
  border: none;
  color: var(--text-muted, #6b7280);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
}

.btn-close:hover {
  background: var(--panel-hover, #f3f4f6);
  color: var(--text, #111827);
}

.trash-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.error-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 12px 16px 0;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(220, 38, 38, 0.24);
  background: rgba(220, 38, 38, 0.08);
  color: #991b1b;
}

.error-text {
  font-size: 0.88rem;
  line-height: 1.45;
}

.error-dismiss {
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 2px;
}

.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted, #9ca3af);
  gap: 16px;
}

.empty-icon {
  opacity: 0.3;
}

.loading-state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner {
  width: 30px;
  height: 30px;
  border: 3px solid var(--panel-border, #e5e7eb);
  border-top-color: var(--accent, #3b82f6);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.trash-list-wrapper {
  padding: 0;
}

.trash-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.trash-table th {
  text-align: left;
  padding: 12px 20px;
  background: var(--panel-header, #f9fafb);
  color: var(--text-muted, #4b5563);
  font-weight: 600;
  position: sticky;
  top: 0;
  z-index: 10;
  border-bottom: 1px solid var(--panel-border, #e5e7eb);
}

.trash-table td {
  padding: 10px 20px;
  border-bottom: 1px solid var(--panel-border, #f3f4f6);
  color: var(--text, #374151);
}

.node-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.name-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 250px;
}

.child-count {
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--text-muted, #9ca3af);
  flex-shrink: 0;
}

.actions-col {
  width: 100px;
  text-align: center;
}

.action-buttons {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.btn-inline-action {
  background: transparent;
  border: 1px solid transparent;
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-muted, #9ca3af);
  transition: all 0.2s;
  display: flex;
}

.btn-empty:disabled,
.btn-inline-action:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-inline-action.restore:hover {
  background: color-mix(in srgb, #10b981 12%, transparent);
  color: #059669;
}

.btn-inline-action.delete:hover {
  background: color-mix(in srgb, #ef4444 12%, transparent);
  color: #dc2626;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
