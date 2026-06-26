<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="isOpen" class="trash-overlay" @keydown.esc="closeTrash" tabindex="0" ref="overlayRef">
        <div class="trash-dialog" @click.stop>
          <div class="trash-header">
            <div class="header-left">
              <IconTrash :size="20" class="trash-icon" />
              <h2>{{ $t('label.trash') }}</h2>
            </div>
            <div class="header-right">
              <button v-if="trashedNodes.length > 0" class="btn-empty" @click="onEmptyTrash" :title="$t('trash.empty')"
                :disabled="isEmptying || Boolean(activeNodeId)">
                <IconEraser :size="16" />
                <span>{{ $t('trash.empty') }}</span>
              </button>
              <button @click="closeTrash" class="btn-close dialog-close-button">
                <IconX :size="18" />
              </button>
            </div>
          </div>

          <div class="trash-content">
            <div v-if="error" class="error-banner" role="alert">
              <span class="error-text">{{ error }}</span>
              <button class="error-dismiss" aria-label="Dismiss error" @click="clearError">
                <IconX :size="14" />
              </button>
            </div>
            <div v-if="isLoading" class="loading-state">
              <div class="spinner"></div>
            </div>
            <div v-else-if="trashedNodes.length === 0" class="empty-state">
              <IconTrash :size="48" class="empty-icon" />
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
                        <IconFileText v-if="node.type === 'file'" :size="14" />
                        <NotebookVisualIcon v-else :icon-color="node.iconColor" :icon-size="12" :box-size="16" />
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
                          <IconRefresh :size="14" />
                        </button>
                        <button class="btn-inline-action delete" @click="onDeleteNode(node.id)"
                          :title="$t('trash.deletePermanently') || 'Delete Permanently'"
                          :disabled="Boolean(activeNodeId) || isEmptying">
                          <IconTrash :size="14" />
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
import { IconTrash, IconX, IconEraser, IconRefresh, IconFileText } from '@tabler/icons-vue';
import NotebookVisualIcon from '@renderer/features/workspace/components/NotebookVisualIcon.vue';

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
  background: var(--dialog-overlay-bg);
  backdrop-filter: var(--dialog-overlay-backdrop-filter);
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
}

.trash-dialog {
  width: 90%;
  max-width: 700px;
  height: 600px;
  background: var(--surface-raised);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.trash-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--surface-scrim);
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
  color: var(--text-primary);
}

.trash-icon {
  color: var(--accent);
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
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--danger);
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
  color: var(--text-primary);
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
  border: 1px solid var(--status-danger-border);
  background: var(--status-danger-bg);
  color: var(--status-danger-text);
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
  color: var(--text-disabled);
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
  border: 3px solid var(--border-color);
  border-top-color: var(--accent);
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
  background: var(--surface-scrim);
  color: var(--text-secondary);
  font-weight: 600;
  position: sticky;
  top: 0;
  z-index: 10;
  border-bottom: 1px solid var(--border-color);
}

.trash-table td {
  padding: 10px 20px;
  border-bottom: 1px solid var(--border-muted);
  color: var(--text-primary);
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
  color: var(--text-disabled);
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
  color: var(--text-disabled);
  transition: all 0.2s;
  display: flex;
}

.btn-empty:disabled,
.btn-inline-action:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-inline-action.restore:hover {
  background: var(--status-success-bg);
  color: var(--status-success-text);
}

.btn-inline-action.delete:hover {
  background: var(--status-danger-bg);
  color: var(--status-danger-text);
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
