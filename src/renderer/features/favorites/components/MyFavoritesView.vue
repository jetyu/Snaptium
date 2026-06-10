<template>
  <div class="favorites-dashboard panel">
    <header class="dashboard-header">
      <div class="dashboard-title-wrap">
        <span class="dashboard-title-icon">
          <IconStar :size="16" />
        </span>
        <h1 class="dashboard-title">{{ $t('favorites.listTitle') }}</h1>
      </div>
    </header>

    <div class="dashboard-content">
      <div v-if="favoritesStore.totalCount > 0" class="favorites-table-container">
        <table class="favorites-table">
          <thead>
            <tr>
              <th class="col-icon"></th>
              <th class="col-name sortable" @click="toggleSort('name')">
                {{ $t('favorites.name') }}
                <span class="sort-icon" v-if="sortField === 'name'">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
              </th>
              <th class="col-type sortable" @click="toggleSort('type')">
                {{ $t('favorites.type') }}
                <span class="sort-icon" v-if="sortField === 'type'">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
              </th>
              <th class="col-location sortable" @click="toggleSort('location')">
                {{ $t('favorites.location') }}
                <span class="sort-icon" v-if="sortField === 'location'">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
              </th>
              <th class="col-modified sortable" @click="toggleSort('updatedAt')">
                {{ $t('favorites.lastModified') }}
                <span class="sort-icon" v-if="sortField === 'updatedAt'">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
              </th>
              <th class="col-time sortable" @click="toggleSort('starredAt')">
                {{ $t('favorites.starredAt') }}
                <span class="sort-icon" v-if="sortField === 'starredAt'">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
              </th>
              <th class="col-actions">{{ $t('favorites.operation') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in allFavorites" :key="`${item.kind}-${item.id}`" class="favorite-row"
              @click="jumpToWorkspace(item.id, item.kind)">
              <td class="col-icon">
                <IconFileCheck v-if="item.kind === 'note' && item.locked" :size="16" />
                <IconFileText v-else-if="item.kind === 'note'" :size="16" />
                <NotebookVisualIcon v-else :icon-color="item.iconColor" :icon-size="13" :box-size="18" />
              </td>
              <td class="col-name">{{ item.nameOrTitle }}</td>
              <td class="col-type">
                <span v-if="item.kind === 'notebook'" class="type-badge type-notebook">{{ $t('favorites.typeNotebook')
                }}</span>
                <span v-else class="type-badge type-note">{{ $t('favorites.typeNote') }}</span>
              </td>
              <td class="col-location">
                <span class="location-badge" :title="item.locationName">{{ item.locationName }}</span>
              </td>
              <td class="col-modified">{{ formatDate(item.updatedAt) }}</td>
              <td class="col-time">{{ formatDate(item.timeStarredAt) }}</td>
              <td class="col-actions">
                <button class="action-btn is-active" :title="t('contextMenu.unstar')"
                  @click.stop="favoritesStore.toggleStar(item.id, item.kind, false)">
                  <IconFileStar fill="currentColor" :size="16" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="favorites-empty">
        <p>{{ $t('favorites.emptyState') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useFavoritesStore } from '@renderer/features/favorites/store/favorites.store';
import { useWorkspaceStore } from '@renderer/features/workspace/store/workspace.store';
import { useAppShellStore } from '@renderer/app/store/appShell.store';
import { IconFileText, IconFileCheck, IconFileStar } from '@tabler/icons-vue';
import { useI18n } from 'vue-i18n';
import { formatDate as formatTime } from '@renderer/core/utils/date.utils';
import NotebookVisualIcon from '@renderer/features/workspace/components/NotebookVisualIcon.vue';

type SortField = 'name' | 'type' | 'location' | 'updatedAt' | 'starredAt';
type SortOrder = 'asc' | 'desc';

const favoritesStore = useFavoritesStore();
const workspaceStore = useWorkspaceStore();
const appShellStore = useAppShellStore();
const { t, locale } = useI18n();

onMounted(() => {
  void favoritesStore.initialize();
});

function formatDate(timestamp: number) {
  return formatTime(timestamp, locale.value);
}

function getLocation(parentId: string | null): string {
  if (!parentId) return t('common.workspace', 'Workspace');

  const path: string[] = [];
  let currentId: string | null = parentId;

  while (currentId) {
    const nb = workspaceStore.notebooks.find((n) => n.id === currentId);
    if (!nb) break;
    path.unshift(nb.name);
    currentId = nb.parentId;
  }

  return path.join(' / ') || t('common.workspace', 'Workspace');
}

const sortField = ref<SortField>('starredAt');
const sortOrder = ref<SortOrder>('desc');

function toggleSort(field: SortField) {
  if (sortField.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortField.value = field;
    sortOrder.value = field === 'name' || field === 'type' || field === 'location' ? 'asc' : 'desc';
  }
}

const allFavorites = computed(() => {
  const notebooks = favoritesStore.sortedStarredNotebooks.map(nb => ({
    ...nb,
    kind: 'notebook' as const,
    nameOrTitle: nb.name,
    locationName: getLocation(nb.parentId),
    timeStarredAt: nb.starredAt || nb.updatedAt
  }));
  const notes = favoritesStore.sortedStarredNotes.map(n => ({
    ...n,
    kind: 'note' as const,
    nameOrTitle: n.title,
    locationName: getLocation(n.parentId),
    timeStarredAt: n.starredAt || n.updatedAt
  }));

  const combined = [...notebooks, ...notes];

  return combined.sort((a, b) => {
    let result = 0;
    switch (sortField.value) {
      case 'name':
        result = a.nameOrTitle.localeCompare(b.nameOrTitle);
        break;
      case 'type':
        result = a.kind.localeCompare(b.kind);
        break;
      case 'location':
        result = a.locationName.localeCompare(b.locationName);
        break;
      case 'updatedAt':
        result = a.updatedAt - b.updatedAt;
        break;
      case 'starredAt':
        result = a.timeStarredAt - b.timeStarredAt;
        break;
    }
    return sortOrder.value === 'asc' ? result : -result;
  });
});

async function jumpToWorkspace(id: string, type: 'note' | 'notebook') {
  if (type === 'note') {
    workspaceStore.selectNote(id);
  } else {
    workspaceStore.selectNotebook(id);
  }
  await appShellStore.setActiveMainView('workspace');
}
</script>

<style scoped>
.favorites-dashboard {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--panel);
  overflow: hidden;
}

.dashboard-header {
  height: var(--col-header-h, 60px);
  min-height: var(--col-header-h, 60px);
  display: flex;
  align-items: center;
  padding: 0 18px;
  border-bottom: 1px solid var(--panel-border);
  background: var(--panel);
}

.dashboard-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text);
}

.dashboard-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dashboard-title-icon {
  width: 24px;
  height: 24px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: color-mix(in srgb, #3b82f6 78%, var(--text));
  background: color-mix(in srgb, #3b82f6 14%, var(--panel));
}

.dashboard-content {
  flex: 1;
  overflow-y: auto;
}

.favorites-table-container {
  width: 100%;
}

.favorites-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  table-layout: fixed;
}

.favorites-table th {
  padding: 12px 24px;
  border-bottom: 1px solid var(--panel-border);
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--panel);
  position: sticky;
  top: 0;
  z-index: 10;
}

.favorites-table td {
  padding: 12px 24px;
  border-bottom: 1px solid var(--panel-border);
}

.favorites-table th.sortable {
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s ease;
}

.favorites-table th.sortable:hover {
  background: var(--panel-hover);
}

.sort-icon {
  display: inline-block;
  margin-left: 4px;
  font-size: 0.7rem;
  color: var(--accent);
}

.favorites-table tbody tr:last-child td {
  border-bottom: none;
}

.favorite-row {
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.favorite-row:hover {
  background: var(--panel-hover);
}

.col-icon {
  width: 40px;
  color: var(--text-muted);
  text-align: center;
}

.col-name {
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--text);
  width: 30%;
}

.col-type {
  width: 120px;
}

.type-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
}

.type-notebook {
  background: var(--panel-hover);
  color: var(--text-muted);
  border: 1px solid var(--panel-border);
}

.type-note {
  background: var(--panel-hover);
  color: var(--text-muted);
  border: 1px solid var(--panel-border);
}

.col-location {
  width: 40%;
}

.location-badge {
  display: block;
  padding: 0;
  background: transparent;
  font-size: 0.8rem;
  color: var(--text-muted);
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.col-modified,
.col-time {
  width: 220px;
  min-width: 180px;
  font-size: 0.85rem;
  color: var(--text-muted);
  white-space: nowrap;
}

.col-actions {
  width: 20%;
  text-align: center;
}

.action-btn {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel-hover) 92%, white);
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
}

.action-btn:hover {
  transform: translateY(-1px);
  background: color-mix(in srgb, #3b82f6 12%, var(--panel));
  color: #2563eb;
}

.action-btn.is-active {
  background: color-mix(in srgb, #3b82f6 14%, var(--panel));
  color: #2563eb;
}

.favorites-empty {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  color: var(--text-muted);
  font-style: italic;
}
</style>
