<template>
  <aside ref="sidebarRef" class="sidebar" tabindex="0" @contextmenu.prevent="handleSidebarContextMenu"
    @keydown="handleSidebarKeydown">
    <div class="sidebar-header">
      <span class="sidebar-title">{{ $t("label.allNotesList") }}</span>
      <div class="header-actions">
        <div v-if="settingsStore.config.sync.enabled" ref="syncButtonShellRef" class="sync-button-shell" tabindex="0"
          @mouseenter="showSyncHoverCard" @mouseleave="scheduleHideSyncHoverCard" @focusin="showSyncHoverCard"
          @focusout="scheduleHideSyncHoverCard">
          <button class="btn-sync icon-wrapper" :title="$t('tooltip.syncNow')" :disabled="!canTriggerSync"
            @click="handleManualSync">
            <Refresh theme="outline" :size="16" :class="{ 'is-spinning': syncStore.isSyncing }" />
          </button>
        </div>

        <button class="btn-new-note icon-wrapper" :title="$t('tooltip.newNoteOrNotebook')"
          @click="openCreateButtonMenu">
          <Plus theme="outline" :size="16" />
        </button>
        <button v-if="hasCollapsibleNotebooks" class="btn-expand-collapse icon-wrapper" :title="expandCollapseTitle"
          @click="toggleExpandCollapseAll">
          <DoubleRight v-if="isAnyNotebookCollapsed" theme="outline" :size="16" />
          <DoubleDown v-else theme="outline" :size="16" />
        </button>


      </div>
    </div>

    <ul v-if="treeEntries.length > 0" class="note-list workspace-tree" :class="{
      'workspace-tree--dragging': !!dragState,
      'workspace-tree--root-drop': dropTarget?.mode === 'root',
    }" @dragover.prevent="handleTreeDragOver" @drop.prevent="handleTreeDrop">
      <li v-for="entry in treeEntries" :key="entry.id" class="workspace-row" :class="{
        active:
          entry.kind === 'note'
            ? entry.id === activeNoteId
            : entry.id === activeNotebookId,
        'workspace-row--notebook': entry.kind === 'notebook',
        'workspace-row--note': entry.kind === 'note',
        'workspace-row--editing': isEditing(entry),
        'workspace-row--indented': entry.depth > 0,
        'workspace-row--selected': isEntrySelected(entry.id),
        'workspace-row--dragging': dragState?.id === entry.id,
        'workspace-row--drop-before': isDropBefore(entry.id),
        'workspace-row--drop-after': isDropAfter(entry.id),
        'workspace-row--drop-inside': isDropInside(entry.id),
      }" :style="{ '--tree-depth': entry.depth }" :draggable="!isEditing(entry)"
        @click="handleEntryClick(entry, $event)" @contextmenu.prevent.stop="handleEntryContextMenu(entry)"
        @dragstart="handleDragStart(entry, $event)" @dragend="handleDragEnd"
        @dragover.prevent.stop="handleRowDragOver(entry, $event)"
        @dragenter.prevent.stop="handleRowDragOver(entry, $event)" @drop.prevent.stop="handleRowDrop">
        <button v-if="entry.kind === 'notebook'" class="workspace-row__chevron icon-wrapper"
          :class="{ 'is-expanded': !collapsedIds.has(entry.id) }" :disabled="!entry.hasChildren"
          @click.stop="toggleCollapse(entry)">
          <Right v-if="entry.hasChildren" theme="outline" :size="14" />
        </button>
        <span v-else class="workspace-row__chevron workspace-row__chevron--placeholder" />

        <div class="workspace-row__icon icon-wrapper">
          <FileLockOne v-if="entry.kind === 'note' && entry.item.locked" theme="outline" :size="14" />
          <NotebookOne v-else-if="entry.kind === 'notebook'" theme="outline" :size="14" />
          <Notes v-else theme="outline" :size="14" />
        </div>
        <div class="workspace-row__content">
          <input v-if="isEditing(entry)" ref="renameInput" v-model="renameDraft" class="workspace-row__rename-input"
            @click.stop @keydown.enter.prevent="commitRename" @keydown.esc.prevent="cancelRename"
            @blur="commitRename" />
          <template v-else>
            <span class="workspace-row__title">{{
              entry.kind === "notebook" ? entry.item.name : entry.item.title
            }}</span>
            <div class="workspace-row__actions" v-show="!isEditing(entry)">
              <StarButton 
                :model-value="entry.item.starred" 
                @update:model-value="toggleNodeStar(entry.id, entry.kind, $event)" 
              />
            </div>
          </template>
        </div>
      </li>
    </ul>

    <div v-else class="sidebar-empty">
      <p>{{ $t("workspace.nodesList.emptyState") }}</p>
      <div class="empty-actions">
        <button class="btn-create-first" @click="createNote()">
          {{ $t("contextMenu.newNote") }}
        </button>
        <button class="btn-create-first secondary" @click="createNotebook()">
          {{ $t("contextMenu.newNotebook") }}
        </button>
      </div>
    </div>

    <SyncHoverCard v-model:card-ref="syncHoverCardRef" :visible="isSyncHoverCardVisible" :style="syncHoverCardStyle"
      :status-label="statusLabel" :status-tone-class="statusToneClass" :formatted-last-synced="formattedLastSynced"
      :summary-items="summaryItems" @mouseenter="showSyncHoverCard" @mouseleave="scheduleHideSyncHoverCard" />
  </aside>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useWorkspace } from "../composables/useWorkspace";
import { WORKSPACE_CONSTANTS } from "../constants/workspace.constants";
import SyncHoverCard from "../../sync/components/SyncHoverCard.vue";
import { useSyncPresentation } from "../../sync/composables/useSyncPresentation";
import { useSyncStore } from "../../sync/store/sync.store";
import { useSettingsStore } from "../../settings/store/settings.store";
import { useWorkbenchStore } from "../../workbench/store/workbench.store";
import { useWorkspaceStore } from "../store/workspace.store";
import { useAppShellStore } from "../../../app/store/appShell.store";
import { workspaceService, type Note, type Notebook } from "../services/workspace.service";
import {
  createMoveToSubmenu,
  showNativeWorkspaceContextMenu,
  type WorkspaceMenuItem,
  type WorkspaceMoveTarget,
} from "../services/workspaceContextMenu.service";
import { useWorkspaceContextMenu } from "../composables/useWorkspaceContextMenu";
import { Plus, Right, FileLockOne, Notes, NotebookOne, Refresh, DoubleRight, DoubleDown } from '@icon-park/vue-next';
import StarButton from "../../favorites/components/StarButton.vue";

type WorkspaceNodeKind = "note" | "notebook";
type MovableEntry = { id: string; kind: WorkspaceNodeKind; parentId: string | null };

type WorkspaceTreeNode =
  | { id: string; kind: "notebook"; parentId: string | null; order: number; item: Notebook }
  | { id: string; kind: "note"; parentId: string | null; order: number; item: Note };

type WorkspaceTreeEntry =
  | { id: string; depth: number; parentId: string | null; kind: "notebook"; item: Notebook; hasChildren: boolean }
  | { id: string; depth: number; parentId: string | null; kind: "note"; item: Note };

type RenameTarget =
  | { id: string; kind: "note" }
  | { id: string; kind: "notebook" }
  | null;

type DragPayload = { id: string; kind: WorkspaceNodeKind };

type DropMode = "before" | "after" | "inside" | "root";

type DropTarget = {
  mode: DropMode;
  targetId: string | null;
  parentId: string | null;
  index: number;
};

const {
  notes,
  notebooks,
  activeNoteId,
  activeNotebookId,
  selectNote,
  selectNotebook,
  createNote,
  createNotebook,
  moveNode,
  showNoteInFolder,
  deleteNote,
  deleteNotebook,
  renameNote,
  renameNotebook,
  toggleNodeLock,
  toggleNodeStar,
  openHistoryDialog,
} = useWorkspace();

const { t } = useI18n();
const syncStore = useSyncStore();
const settingsStore = useSettingsStore();
const workbenchStore = useWorkbenchStore();
const workspaceStore = useWorkspaceStore();
const appShellStore = useAppShellStore();
const { statusLabel, statusToneClass, summaryItems, formattedLastSynced } = useSyncPresentation();
const sidebarRef = ref<HTMLElement | null>(null);
const renameTarget = ref<RenameTarget>(null);
const syncButtonShellRef = ref<HTMLElement | null>(null);
const syncHoverCardRef = ref<HTMLElement | null>(null);
const isSyncHoverCardVisible = ref(false);
const syncHoverCardStyle = ref<Record<string, string>>({});
let syncHoverCardHideTimer: ReturnType<typeof setTimeout> | null = null;

const renameDraft = ref("");
const renameInput = ref<HTMLInputElement | null>(null);
const isSubmittingRename = ref(false);
const collapsedIds = ref<Set<string>>(new Set());
const selectedIds = ref<Set<string>>(new Set());
const selectionAnchorId = ref<string | null>(null);
const dragState = ref<DragPayload | null>(null);
const dropTarget = ref<DropTarget | null>(null);
const suppressNextClick = ref(false);

const notebookIdsWithChildren = computed(() => {
  return notebooks.value
    .filter((notebook) => (orderedChildrenByParent.value.get(notebook.id)?.length ?? 0) > 0)
    .map((notebook) => notebook.id);
});

const hasCollapsibleNotebooks = computed(() => notebookIdsWithChildren.value.length > 0);
const isAnyNotebookCollapsed = computed(() => collapsedIds.value.size > 0);
const expandCollapseTitle = computed(() =>
  isAnyNotebookCollapsed.value
    ? t("label.expandAll")
    : t("label.collapseAll")
);

function toggleExpandCollapseAll() {
  if (!hasCollapsibleNotebooks.value) {
    return;
  }

  if (isAnyNotebookCollapsed.value) {
    collapsedIds.value = new Set();
    return;
  }

  collapsedIds.value = new Set(notebookIdsWithChildren.value);
}

function compareTreeNodeOrder(left: WorkspaceTreeNode, right: WorkspaceTreeNode) {
  const leftOrder = Number(left.order ?? left.item.createdAt ?? 0);
  const rightOrder = Number(right.order ?? right.item.createdAt ?? 0);

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  const leftCreatedAt = Number(left.item.createdAt ?? 0);
  const rightCreatedAt = Number(right.item.createdAt ?? 0);

  if (leftCreatedAt !== rightCreatedAt) {
    return leftCreatedAt - rightCreatedAt;
  }

  return left.id.localeCompare(right.id);
}

function focusSidebar() {
  sidebarRef.value?.focus({ preventScroll: true });
}

function getCurrentActiveId() {
  return activeNoteId.value ?? activeNotebookId.value ?? null;
}

function setSelectedIdSet(ids: Iterable<string>) {
  selectedIds.value = new Set(ids);
}

function setSingleSelection(entry: WorkspaceTreeEntry) {
  setSelectedIdSet([entry.id]);
  selectionAnchorId.value = entry.id;
}

function syncSelectionToActive() {
  const activeId = getCurrentActiveId();
  setSelectedIdSet(activeId ? [activeId] : []);
  selectionAnchorId.value = activeId;
}

function isEntrySelected(entryId: string) {
  return selectedIds.value.has(entryId);
}

function createMovableEntry(id: string, kind: WorkspaceNodeKind, parentId: string | null): MovableEntry {
  return { id, kind, parentId };
}

function parseMoveAction(action: string | null): { parentId: string | null } | null {
  if (!action || !action.startsWith(`${WORKSPACE_CONSTANTS.ACTIONS.MOVE_TO_PREFIX}:`)) {
    return null;
  }

  const encodedParentId = action.slice(WORKSPACE_CONSTANTS.ACTIONS.MOVE_TO_PREFIX.length + 1);
  return {
    parentId: encodedParentId === "root" ? null : encodedParentId,
  };
}

function getSiblingNodes(parentId: string | null, excludeNodeId?: string) {
  const siblings = orderedChildrenByParent.value.get(parentId) ?? [];

  if (!excludeNodeId) {
    return siblings;
  }

  return siblings.filter((node) => node.id !== excludeNodeId);
}

function isNotebookTargetInvalid(parentId: string | null, notebookId: string) {
  let currentId = parentId;

  while (currentId) {
    if (currentId === notebookId) {
      return true;
    }

    currentId = notebookMap.value.get(currentId)?.parentId ?? null;
  }

  return false;
}

function isValidDropParent(parentId: string | null) {
  const dragged = dragState.value;
  if (!dragged) {
    return false;
  }

  if (dragged.kind !== "notebook") {
    return true;
  }

  return !isNotebookTargetInvalid(parentId, dragged.id);
}

function getNotebookPathLabel(notebookId: string) {
  const segments: string[] = [];
  const visited = new Set<string>();
  let current = notebookMap.value.get(notebookId);

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    segments.unshift(current.name);
    current = current.parentId ? notebookMap.value.get(current.parentId) : undefined;
  }

  return segments.join(" / ");
}

function sortNotebooksForMoveTargets(items: Notebook[]) {
  return [...items].sort((left, right) =>
    getNotebookPathLabel(left.id).localeCompare(getNotebookPathLabel(right.id))
  );
}

function canMoveEntryToParent(entry: MovableEntry, parentId: string | null) {
  if (entry.kind === "note") {
    return true;
  }

  if (parentId === entry.id) {
    return false;
  }

  return !isNotebookTargetInvalid(parentId, entry.id);
}

function buildMoveTargets(entries: MovableEntry[], disallowedTargetIds: Set<string> = new Set()): WorkspaceMoveTarget[] {
  const targets: WorkspaceMoveTarget[] = [];

  if (entries.length === 0) {
    return targets;
  }

  if (entries.some((entry) => entry.parentId !== null) && entries.every((entry) => canMoveEntryToParent(entry, null))) {
    targets.push({
      action: `${WORKSPACE_CONSTANTS.ACTIONS.MOVE_TO_PREFIX}:root`,
      label: t(WORKSPACE_CONSTANTS.MENU.MOVE_TO_ROOT),
    });
  }

  for (const notebook of sortNotebooksForMoveTargets(notebooks.value)) {
    if (disallowedTargetIds.has(notebook.id)) {
      continue;
    }

    if (!entries.every((entry) => canMoveEntryToParent(entry, notebook.id))) {
      continue;
    }

    if (entries.every((entry) => entry.parentId === notebook.id)) {
      continue;
    }

    targets.push({
      action: `${WORKSPACE_CONSTANTS.ACTIONS.MOVE_TO_PREFIX}:${notebook.id}`,
      label: t(WORKSPACE_CONSTANTS.MENU.MOVE_TO_NOTEBOOK, {
        name: getNotebookPathLabel(notebook.id),
      }),
    });
  }

  return targets;
}

function getNoteMoveTargets(note: Note): WorkspaceMoveTarget[] {
  return buildMoveTargets([createMovableEntry(note.id, "note", note.parentId)]);
}

function getNotebookMoveTargets(notebook: Notebook): WorkspaceMoveTarget[] {
  return buildMoveTargets([createMovableEntry(notebook.id, "notebook", notebook.parentId)]);
}

function resolveMoveIndex(parentId: string | null, excludeNodeId: string) {
  return getSiblingNodes(parentId, excludeNodeId).length;
}

function hasSelectedAncestor(entry: WorkspaceTreeEntry) {
  let parentId = entry.parentId;

  while (parentId) {
    if (selectedIds.value.has(parentId)) {
      return true;
    }

    parentId = notebookMap.value.get(parentId)?.parentId ?? null;
  }

  return false;
}

function getEntryDisplayName(entry: WorkspaceTreeEntry) {
  return entry.kind === "note" ? entry.item.title : entry.item.name;
}

function selectEntryRange(entry: WorkspaceTreeEntry) {
  const anchorId = selectionAnchorId.value ?? getCurrentActiveId() ?? entry.id;
  const anchorIndex = treeEntries.value.findIndex((candidate) => candidate.id === anchorId);
  const targetIndex = treeEntries.value.findIndex((candidate) => candidate.id === entry.id);

  if (anchorIndex === -1 || targetIndex === -1) {
    setSingleSelection(entry);
    return;
  }

  const [start, end] = anchorIndex < targetIndex
    ? [anchorIndex, targetIndex]
    : [targetIndex, anchorIndex];
  setSelectedIdSet(treeEntries.value.slice(start, end + 1).map((candidate) => candidate.id));
}

function toggleEntrySelection(entry: WorkspaceTreeEntry) {
  const nextSelectedIds = new Set(selectedIds.value);

  if (nextSelectedIds.has(entry.id)) {
    nextSelectedIds.delete(entry.id);
    if (nextSelectedIds.size === 0) {
      nextSelectedIds.add(entry.id);
    }
  } else {
    nextSelectedIds.add(entry.id);
  }

  setSelectedIdSet(nextSelectedIds);
  selectionAnchorId.value = nextSelectedIds.has(entry.id)
    ? entry.id
    : Array.from(nextSelectedIds).at(-1) ?? null;
}

function getSelectionMenuItems(): WorkspaceMenuItem[] {
  const moveTargets = buildMoveTargets(
    selectedRootEntries.value.map((entry) => createMovableEntry(entry.id, entry.kind, entry.parentId)),
    new Set(selectedIds.value),
  );
  const moveToSubmenu = createMoveToSubmenu(moveTargets);

  return [
    ...(moveToSubmenu ? [moveToSubmenu] : []),
    ...(moveToSubmenu ? [{ type: WORKSPACE_CONSTANTS.MENU_ITEM_TYPE.SEPARATOR as 'separator' }] : []),
    {
      action: WORKSPACE_CONSTANTS.ACTIONS.DELETE_SELECTION,
      label: t("contextMenu.deleteSelected"),
    },
  ];
}

function getDropMode(entry: WorkspaceTreeEntry, event: DragEvent): Exclude<DropMode, "root"> {
  const currentTarget = event.currentTarget as HTMLElement | null;
  if (!currentTarget) {
    return entry.kind === "notebook" ? "inside" : "after";
  }

  const rect = currentTarget.getBoundingClientRect();
  const offsetY = event.clientY - rect.top;
  const edgeThreshold = Math.max(6, Math.min(12, rect.height * 0.25));

  if (entry.kind === "notebook") {
    if (offsetY <= edgeThreshold) {
      return "before";
    }

    if (offsetY >= rect.height - edgeThreshold) {
      return "after";
    }

    return "inside";
  }

  return offsetY <= rect.height / 2 ? "before" : "after";
}

function buildRowDropTarget(entry: WorkspaceTreeEntry, mode: Exclude<DropMode, "root">): DropTarget | null {
  const dragged = dragState.value;
  if (!dragged) {
    return null;
  }

  if (mode === "inside") {
    if (entry.kind !== "notebook" || dragged.id === entry.id || !isValidDropParent(entry.id)) {
      return null;
    }

    return {
      mode,
      targetId: entry.id,
      parentId: entry.id,
      index: getSiblingNodes(entry.id, dragged.id).length,
    };
  }

  if (!isValidDropParent(entry.parentId ?? null)) {
    return null;
  }

  const siblings = getSiblingNodes(entry.parentId ?? null, dragged.id);
  const siblingIndex = siblings.findIndex((sibling) => sibling.id === entry.id);

  if (siblingIndex === -1) {
    return null;
  }

  return {
    mode,
    targetId: entry.id,
    parentId: entry.parentId ?? null,
    index: mode === "before" ? siblingIndex : siblingIndex + 1,
  };
}

function buildRootDropTarget(): DropTarget | null {
  const dragged = dragState.value;
  if (!dragged || !isValidDropParent(null)) {
    return null;
  }

  return {
    mode: "root",
    targetId: null,
    parentId: null,
    index: getSiblingNodes(null, dragged.id).length,
  };
}

function releaseClickSuppression() {
  window.setTimeout(() => {
    suppressNextClick.value = false;
  }, 0);
}

function toggleCollapse(entry: Extract<WorkspaceTreeEntry, { kind: "notebook" }>) {
  if (!entry.hasChildren) {
    return;
  }

  if (collapsedIds.value.has(entry.id)) {
    collapsedIds.value.delete(entry.id);
  } else {
    collapsedIds.value.add(entry.id);
  }
}

async function handleEntrySelect(entry: WorkspaceTreeEntry) {
  if (suppressNextClick.value) {
    return;
  }

  if (entry.kind === 'note') {
    selectNote(entry.id);
    await workbenchStore.recordOpenedNote(entry.id);
  } else {
    selectNotebook(entry.id);
  }

  if (appShellStore.activeMainView === 'workbench') {
    await appShellStore.setActiveMainView('workspace');
  }
}

async function moveSelectedEntries(parentId: string | null) {
  const entries = [...selectedRootEntries.value];
  if (entries.length === 0) {
    return;
  }

  let insertIndex = getSiblingNodes(parentId).filter((entry) => !selectedIds.value.has(entry.id)).length;

  for (const entry of entries) {
    await moveNode({
      nodeId: entry.id,
      parentId,
      index: insertIndex,
    });
    insertIndex += 1;
  }
}

async function deleteSelectedEntries() {
  const entries = [...selectedRootEntries.value];

  if (entries.length === 0) {
    return;
  }

  const label = entries.length === 1
    ? getEntryDisplayName(entries[0])
    : t("common.selectedItemsCount", { count: selectedIds.value.size });
  const confirmed = await workspaceService.confirmDeleteNode(label);

  if (!confirmed) {
    return;
  }

  for (const entry of entries) {
    if (entry.kind === "note") {
      await workspaceStore.deleteNote(entry.id);
    } else {
      await workspaceStore.deleteNotebook(entry.id);
    }
  }

  syncSelectionToActive();
}

async function openSelectionMenu() {
  const action = await showNativeWorkspaceContextMenu(t, getSelectionMenuItems());
  const moveTarget = parseMoveAction(action);

  if (moveTarget) {
    await moveSelectedEntries(moveTarget.parentId);
    return;
  }

  if (action === WORKSPACE_CONSTANTS.ACTIONS.DELETE_SELECTION) {
    await deleteSelectedEntries();
  }
}

async function handleEntryClick(entry: WorkspaceTreeEntry, event: MouseEvent) {
  focusSidebar();

  if (suppressNextClick.value) {
    return;
  }

  if (event.shiftKey) {
    selectEntryRange(entry);
    return;
  }

  if (event.metaKey || event.ctrlKey) {
    toggleEntrySelection(entry);
    return;
  }

  setSingleSelection(entry);
  await handleEntrySelect(entry);

  if (entry.kind === "notebook" && entry.hasChildren) {
    toggleCollapse(entry);
  }
}

async function handleEntryContextMenu(entry: WorkspaceTreeEntry) {
  focusSidebar();

  const useSelectionMenu = selectedIds.value.size > 1 && selectedIds.value.has(entry.id);

  if (!useSelectionMenu) {
    setSingleSelection(entry);
  }

  if (useSelectionMenu) {
    await openSelectionMenu();
    return;
  }

  if (entry.kind === "note") {
    await openNoteMenu(entry.item);
  } else {
    await openNotebookMenu(entry.item);
  }
}

async function handleSidebarContextMenu(event: MouseEvent) {
  focusSidebar();

  const target = event.target as HTMLElement | null;
  if (target?.closest(".workspace-row") || target?.closest(".sidebar-header")) {
    return;
  }

  if (selectedIds.value.size > 1) {
    await openSelectionMenu();
    return;
  }

  await openRootMenu();
}

function handleSidebarKeydown(event: KeyboardEvent) {
  if (renameTarget.value) {
    return;
  }

  const target = event.target as HTMLElement | null;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable) {
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
    event.preventDefault();
    setSelectedIdSet(treeEntries.value.map((entry) => entry.id));
    selectionAnchorId.value = selectionAnchorId.value ?? treeEntries.value[0]?.id ?? null;
    return;
  }

  if (event.key === "Escape" && selectedIds.value.size > 1) {
    event.preventDefault();
    syncSelectionToActive();
  }
}

function handleDragStart(entry: WorkspaceTreeEntry, event: DragEvent) {
  if (isEditing(entry)) {
    event.preventDefault();
    return;
  }

  dragState.value = {
    id: entry.id,
    kind: entry.kind,
  };
  dropTarget.value = null;

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", entry.id);
  }
}

function handleDragEnd() {
  dragState.value = null;
  dropTarget.value = null;
}

function handleRowDragOver(entry: WorkspaceTreeEntry, event: DragEvent) {
  if (!dragState.value) {
    return;
  }

  const nextTarget = buildRowDropTarget(entry, getDropMode(entry, event));
  dropTarget.value = nextTarget;

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = nextTarget ? "move" : "none";
  }
}

function handleTreeDragOver(event: DragEvent) {
  if (!dragState.value) {
    return;
  }

  const nextTarget = buildRootDropTarget();
  dropTarget.value = nextTarget;

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = nextTarget ? "move" : "none";
  }
}

async function applyDropTarget() {
  const dragged = dragState.value;
  const target = dropTarget.value;

  if (!dragged || !target) {
    handleDragEnd();
    return;
  }

  suppressNextClick.value = true;

  if (target.mode === "inside" && target.targetId) {
    collapsedIds.value.delete(target.targetId);
  }

  try {
    await moveNode({
      nodeId: dragged.id,
      parentId: target.parentId,
      index: target.index,
    });
  } finally {
    handleDragEnd();
    releaseClickSuppression();
  }
}

async function handleRowDrop() {
  await applyDropTarget();
}

async function handleTreeDrop() {
  await applyDropTarget();
}

function focusRenameInput() {
  nextTick(() => {
    renameInput.value?.focus();
    renameInput.value?.select();
  });
}

function beginRenamingNote(note: Note) {
  selectNote(note.id);
  renameTarget.value = { id: note.id, kind: "note" };
  renameDraft.value = note.title;
  focusRenameInput();
}

function beginRenamingNotebook(notebook: Notebook) {
  selectNotebook(notebook.id);
  renameTarget.value = { id: notebook.id, kind: "notebook" };
  renameDraft.value = notebook.name;
  focusRenameInput();
}

function isEditing(entry: WorkspaceTreeEntry) {
  return (
    renameTarget.value?.id === entry.id &&
    renameTarget.value?.kind === entry.kind
  );
}

function isDropBefore(entryId: string) {
  return dropTarget.value?.targetId === entryId && dropTarget.value.mode === "before";
}

function isDropAfter(entryId: string) {
  return dropTarget.value?.targetId === entryId && dropTarget.value.mode === "after";
}

function isDropInside(entryId: string) {
  return dropTarget.value?.targetId === entryId && dropTarget.value.mode === "inside";
}

function cancelRename() {
  renameTarget.value = null;
  renameDraft.value = "";
}

function clearSyncHoverCardHideTimer() {
  if (!syncHoverCardHideTimer) {
    return;
  }

  clearTimeout(syncHoverCardHideTimer);
  syncHoverCardHideTimer = null;
}

function updateSyncHoverCardPosition() {
  const anchor = syncButtonShellRef.value;
  if (!anchor) {
    return;
  }

  const rect = anchor.getBoundingClientRect();
  const cardWidth = syncHoverCardRef.value?.offsetWidth ?? 240;
  const cardHeight = syncHoverCardRef.value?.offsetHeight ?? 0;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const gap = 8;
  const margin = 12;
  const horizontalOffset = 200;

  let left = rect.right - cardWidth + horizontalOffset;
  let top = rect.bottom + gap;

  if (left + cardWidth > viewportWidth - margin) {
    left = viewportWidth - margin - cardWidth;
  }

  if (left < margin) {
    left = margin;
  }

  if (cardHeight > 0 && top + cardHeight > viewportHeight - margin) {
    top = Math.max(margin, rect.top - gap - cardHeight);
  }

  syncHoverCardStyle.value = {
    left: `${left}px`,
    top: `${top}px`,
  };
}

function showSyncHoverCard() {
  clearSyncHoverCardHideTimer();
  isSyncHoverCardVisible.value = true;
  nextTick(() => {
    updateSyncHoverCardPosition();
  });
}

function scheduleHideSyncHoverCard() {
  clearSyncHoverCardHideTimer();
  syncHoverCardHideTimer = setTimeout(() => {
    isSyncHoverCardVisible.value = false;
  }, 100);
}

const canTriggerSync = computed(() => {
  return settingsStore.config.sync.enabled && !syncStore.isSyncing;
});

async function handleManualSync() {
  if (!canTriggerSync.value) {
    return;
  }

  await workspaceStore.forceFlushAutoSave();
  await syncStore.runSync(settingsStore.config.sync, 'manual');
}

const notebookMap = computed<Map<string, Notebook>>(() => {
  return new Map(notebooks.value.map((notebook: Notebook) => [notebook.id, notebook] as const));
});

const orderedChildrenByParent = computed<Map<string | null, WorkspaceTreeNode[]>>(() => {
  const buckets = new Map<string | null, WorkspaceTreeNode[]>();

  const appendNode = (node: WorkspaceTreeNode) => {
    const key = node.parentId ?? null;
    const bucket = buckets.get(key) ?? [];
    bucket.push(node);
    buckets.set(key, bucket);
  };

  for (const notebook of notebooks.value) {
    appendNode({
      id: notebook.id,
      kind: "notebook",
      parentId: notebook.parentId ?? null,
      order: notebook.order,
      item: notebook,
    });
  }

  for (const note of notes.value) {
    appendNode({
      id: note.id,
      kind: "note",
      parentId: note.parentId ?? null,
      order: note.order,
      item: note,
    });
  }

  for (const bucket of buckets.values()) {
    bucket.sort(compareTreeNodeOrder);
  }

  return buckets;
});

watch(
  notebooks,
  (nextNotebooks: Notebook[]) => {
    const validIds = new Set(nextNotebooks.map((notebook: Notebook) => notebook.id));
    collapsedIds.value = new Set(
      [...collapsedIds.value].filter((id) => validIds.has(id))
    );
  },
  { deep: true }
);

watch(
  [activeNoteId, activeNotebookId],
  () => {
    if (selectedIds.value.size <= 1) {
      syncSelectionToActive();
    }
  },
  { immediate: true }
);

watch(
  [activeNoteId, activeNotebookId],
  ([nextActiveNoteId, nextActiveNotebookId]) => {
    const target = renameTarget.value;

    if (!target) {
      return;
    }

    const isTargetStillActive =
      target.kind === "note"
        ? target.id === nextActiveNoteId
        : target.id === nextActiveNotebookId;

    if (!isTargetStillActive) {
      cancelRename();
    }
  }
);

async function commitRename() {
  const target = renameTarget.value;
  const nextName = renameDraft.value.trim();

  if (!target || isSubmittingRename.value) {
    return;
  }

  if (!nextName) {
    cancelRename();
    return;
  }

  isSubmittingRename.value = true;

  try {
    if (target.kind === "note") {
      await renameNote(target.id, nextName);
    } else {
      await renameNotebook(target.id, nextName);
    }
  } finally {
    isSubmittingRename.value = false;
    cancelRename();
  }
}

const { openCreateButtonMenu, openRootMenu, openNoteMenu, openNotebookMenu } =
  useWorkspaceContextMenu({
    t,
    createNote,
    createNotebook,
    moveNode,
    showNoteInFolder,
    deleteNote,
    deleteNotebook,
    getNoteMoveTargets,
    getNotebookMoveTargets,
    resolveMoveIndex,
    selectNote,
    selectNotebook,
    beginRenamingNote,
    beginRenamingNotebook,
    toggleNodeLock,
    toggleNodeStar,
    openHistory: openHistoryDialog,
  });

const treeEntries = computed<WorkspaceTreeEntry[]>(() => {
  const entries: WorkspaceTreeEntry[] = [];

  const visit = (parentId: string | null, depth: number) => {
    for (const node of orderedChildrenByParent.value.get(parentId) ?? []) {
      if (node.kind === "notebook") {
        const hasChildren = (orderedChildrenByParent.value.get(node.id)?.length ?? 0) > 0;

        entries.push({
          id: node.id,
          depth,
          parentId: node.parentId,
          kind: "notebook",
          item: node.item,
          hasChildren,
        });

        if (!collapsedIds.value.has(node.id)) {
          visit(node.id, depth + 1);
        }

        continue;
      }

      entries.push({
        id: node.id,
        depth,
        parentId: node.parentId,
        kind: "note",
        item: node.item,
      });
    }
  };

  visit(null, 0);
  return entries;
});

const selectedEntries = computed(() => {
  return treeEntries.value.filter((entry) => selectedIds.value.has(entry.id));
});

const selectedRootEntries = computed(() => {
  return selectedEntries.value.filter((entry) => !hasSelectedAncestor(entry));
});

watch(
  treeEntries,
  (nextEntries) => {
    const validIds = new Set(nextEntries.map((entry) => entry.id));
    const nextSelectedIds = [...selectedIds.value].filter((id) => validIds.has(id));

    if (nextSelectedIds.length !== selectedIds.value.size) {
      setSelectedIdSet(nextSelectedIds);
    }

    if (selectionAnchorId.value && !validIds.has(selectionAnchorId.value)) {
      selectionAnchorId.value = nextSelectedIds[0] ?? getCurrentActiveId();
    }

    if (nextSelectedIds.length === 0 && nextEntries.length > 0 && getCurrentActiveId()) {
      syncSelectionToActive();
    }
  },
  { deep: true }
);

watch([statusLabel, formattedLastSynced, summaryItems], () => {
  if (!isSyncHoverCardVisible.value) {
    return;
  }

  nextTick(() => {
    updateSyncHoverCardPosition();
  });
});

onBeforeUnmount(() => {
  clearSyncHoverCardHideTimer();
  window.removeEventListener('resize', updateSyncHoverCardPosition);
  window.removeEventListener('scroll', updateSyncHoverCardPosition, true);
});

onMounted(() => {
  window.addEventListener('resize', updateSyncHoverCardPosition);
  window.addEventListener('scroll', updateSyncHoverCardPosition, true);
});
</script>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  background: var(--panel);
  position: relative;
  overflow: visible;
}

.sidebar:focus {
  outline: none;
}

.sidebar-header {
  position: relative;
  z-index: 2;
  overflow: visible;
}

.note-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px 0;
}

.workspace-tree {
  position: relative;
}

.workspace-tree--dragging {
  user-select: none;
}

.workspace-tree--root-drop::after {
  content: "";
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 6px;
  height: 2px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 85%, white 15%);
}

.workspace-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  padding-left: calc(1px + (var(--tree-depth, 0) * 20px));
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: background 0.12s, border-color 0.12s, opacity 0.12s;
  position: relative;
}

.workspace-row--dragging {
  opacity: 0.46;
}

.workspace-row--indented::before {
  position: absolute;
  left: calc(1px + (var(--tree-depth, 0) * 20px) - 10px);
  top: 0;
  bottom: 0;
  width: 1px;
  background: color-mix(in srgb, var(--text-muted, #888) 25%, transparent);
  pointer-events: none;
  content: "";
}

.workspace-row--drop-before::after,
.workspace-row--drop-after::after {
  content: "";
  position: absolute;
  left: calc(18px + (var(--tree-depth, 0) * 20px));
  right: 12px;
  height: 2px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 90%, white 10%);
  pointer-events: none;
}

.workspace-row--drop-before::after {
  top: 0;
}

.workspace-row--drop-after::after {
  bottom: 0;
}

.workspace-row--drop-inside {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 40%, transparent);
}

.workspace-row:hover {
  background: var(--panel-hover);
}

.workspace-row--selected {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

.workspace-row--selected .workspace-row__title {
  color: color-mix(in srgb, var(--text) 88%, var(--accent) 12%);
}

.workspace-row.active {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-left-color: var(--accent);
}

.workspace-row__chevron {
  flex: 0 0 16px;
  width: 16px;
  height: 16px;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  color: var(--text-muted);
  border-radius: 3px;
  transition: color 0.15s, background 0.15s, transform 0.15s;
}

.workspace-row__chevron:hover:not(:disabled) {
  color: var(--text);
}

.workspace-row__chevron:disabled {
  cursor: default;
  opacity: 0.35;
}

.workspace-row__chevron.is-expanded {
  transform: rotate(90deg);
}

.workspace-row__chevron--placeholder {
  pointer-events: none;
}

.workspace-row__content {
  min-width: 0;
  display: flex;
  flex: 1;
  flex-direction: row;
  align-items: center;
  gap: 6px;
}

.workspace-row__title {
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.workspace-row__actions {
  display: flex;
  align-items: center;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.14s ease;
}

.workspace-row:hover .workspace-row__actions,
.workspace-row:focus-within .workspace-row__actions {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

.workspace-row.active .workspace-row__title,
.workspace-row--drop-inside .workspace-row__title {
  color: var(--accent-hover);
}

.workspace-row__rename-input {
  width: 100%;
  min-width: 0;
  padding: 4px 6px;
  border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
  border-radius: 6px;
  background: var(--panel);
  color: var(--text);
  font: inherit;
}

.empty-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.secondary {
  background: transparent;
  border: 1px solid var(--color-border, #d1d5db);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-sync,
.btn-new-note,
.btn-expand-collapse {
  flex: 0 0 auto;
  min-width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  padding: 0 8px;
}

.btn-sync:hover,
.btn-new-note:hover,
.btn-expand-collapse:hover {
  background: var(--panel-hover);
  color: var(--accent);
}

.btn-sync:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.is-spinning {
  animation: sync-spin 1s linear infinite;
}

.sync-button-shell {
  display: inline-flex;
  outline: none;
}

@keyframes sync-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
