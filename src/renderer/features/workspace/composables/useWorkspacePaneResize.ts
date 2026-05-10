import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type CSSProperties, type Ref } from 'vue';

type ResizeHandle = 'sidebar' | 'preview';

interface UseWorkspacePaneResizeOptions {
  rootRef: Ref<HTMLElement | null>;
  sidebarRef: Ref<HTMLElement | null>;
  editorRef: Ref<HTMLElement | null>;
  hasTrailingContentRef: Ref<boolean>;
  canResizePreviewRef: Ref<boolean>;
}

const EDGE_HITBOX_PX = 10;
const SIDEBAR_DEFAULT_WIDTH = 260;
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 420;
const EDITOR_MIN_WIDTH = 460;
const PREVIEW_DEFAULT_WIDTH = 420;
const PREVIEW_MIN_WIDTH = 260;
const PREVIEW_MAX_WIDTH = 760;

function clampValue(value: number, minValue: number, maxValue: number) {
  const resolvedMax = Math.max(0, maxValue);
  const resolvedMin = Math.min(minValue, resolvedMax);

  return Math.min(Math.max(Math.round(value), resolvedMin), resolvedMax);
}

export function useWorkspacePaneResize(options: UseWorkspacePaneResizeOptions) {
  const sidebarWidth = ref(SIDEBAR_DEFAULT_WIDTH);
  const previewWidth = ref(PREVIEW_DEFAULT_WIDTH);
  const hoverHandle = ref<ResizeHandle | null>(null);
  const activeHandle = ref<ResizeHandle | null>(null);
  const previousBodyCursor = ref('');
  const previousBodyUserSelect = ref('');

  const isResizing = computed(() => activeHandle.value !== null);
  const highlightedHandle = computed<ResizeHandle | null>(() => activeHandle.value ?? hoverHandle.value);

  function getContainerRect() {
    return options.rootRef.value?.getBoundingClientRect() ?? null;
  }

  function getSidebarMaxWidth(containerWidth: number) {
    const remainingMinWidth = options.canResizePreviewRef.value
      ? EDITOR_MIN_WIDTH + PREVIEW_MIN_WIDTH
      : EDITOR_MIN_WIDTH;

    return Math.min(SIDEBAR_MAX_WIDTH, containerWidth - remainingMinWidth);
  }

  function getPreviewMaxWidth(containerWidth: number) {
    const remainingMinWidth = SIDEBAR_MIN_WIDTH + EDITOR_MIN_WIDTH;
    return Math.min(PREVIEW_MAX_WIDTH, containerWidth - remainingMinWidth);
  }

  function clampPreviewWidthToFit(containerWidth: number) {
    if (!options.canResizePreviewRef.value) {
      return;
    }

    const maxP = containerWidth - sidebarWidth.value - EDITOR_MIN_WIDTH;
    previewWidth.value = clampValue(
      previewWidth.value,
      PREVIEW_MIN_WIDTH,
      Math.min(PREVIEW_MAX_WIDTH, maxP),
    );
  }

  function clampSidebarWidthToFit(containerWidth: number) {
    const maxS = containerWidth - previewWidth.value - EDITOR_MIN_WIDTH;
    sidebarWidth.value = clampValue(
      sidebarWidth.value,
      SIDEBAR_MIN_WIDTH,
      Math.min(SIDEBAR_MAX_WIDTH, maxS),
    );
  }

  function normalizePaneWidths() {
    const containerWidth = options.rootRef.value?.clientWidth ?? 0;
    if (containerWidth <= 0) {
      return;
    }

    sidebarWidth.value = clampValue(
      sidebarWidth.value,
      SIDEBAR_MIN_WIDTH,
      getSidebarMaxWidth(containerWidth),
    );

    const availableForPreview = containerWidth - sidebarWidth.value - EDITOR_MIN_WIDTH;
    if (options.canResizePreviewRef.value) {
      previewWidth.value = clampValue(
        previewWidth.value,
        PREVIEW_MIN_WIDTH,
        Math.min(PREVIEW_MAX_WIDTH, availableForPreview),
      );
    }
  }

  function updateSidebarWidth(clientX: number) {
    const containerRect = getContainerRect();
    if (!containerRect) {
      return;
    }

    const containerWidth = containerRect.width;
    const newS = clampValue(
      clientX - containerRect.left,
      SIDEBAR_MIN_WIDTH,
      getSidebarMaxWidth(containerWidth),
    );

    sidebarWidth.value = newS;

    // Push logic: if sidebar + current preview + editor_min > total, shrink preview
    if (options.canResizePreviewRef.value) {
      const maxP = containerWidth - newS - EDITOR_MIN_WIDTH;
      if (previewWidth.value > maxP) {
        previewWidth.value = clampValue(maxP, PREVIEW_MIN_WIDTH, PREVIEW_MAX_WIDTH);
      }
    }
  }

  function updatePreviewWidth(clientX: number) {
    if (!options.canResizePreviewRef.value) {
      return;
    }

    const containerRect = getContainerRect();
    if (!containerRect) {
      return;
    }

    const containerWidth = containerRect.width;
    const newP = clampValue(
      containerRect.right - clientX,
      PREVIEW_MIN_WIDTH,
      getPreviewMaxWidth(containerWidth),
    );

    previewWidth.value = newP;

    // Push logic: if preview + current sidebar + editor_min > total, shrink sidebar
    const maxS = containerWidth - newP - EDITOR_MIN_WIDTH;
    if (sidebarWidth.value > maxS) {
      sidebarWidth.value = clampValue(maxS, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH);
    }
  }

  function resolveHandle(clientX: number) {
    const containerRect = getContainerRect();
    if (!containerRect || clientX < containerRect.left || clientX > containerRect.right) {
      return null;
    }

    const sidebarRect = options.sidebarRef.value?.getBoundingClientRect();
    if (options.hasTrailingContentRef.value && sidebarRect) {
      // Hitbox: 0px to the left (on the border), 10px to the right.
      const diff = clientX - sidebarRect.right;
      if (diff >= 0 && diff <= 10) {
        return 'sidebar';
      }
    }

    if (options.canResizePreviewRef.value) {
      const editorRect = options.editorRef.value?.getBoundingClientRect();
      if (editorRect) {
        // Hitbox: 0px to the left, 10px to the right.
        const diff = clientX - editorRect.right;
        if (diff >= 0 && diff <= 10) {
          return 'preview';
        }
      }
    }

    return null;
  }

  function resolveResizeCursor() {
    const root = options.rootRef.value;
    if (!root) {
      return 'col-resize';
    }

    const configuredCursor = getComputedStyle(root)
      .getPropertyValue('--workspace-resize-cursor')
      .trim();

    return configuredCursor || 'col-resize';
  }

  function applyGlobalResizeState() {
    previousBodyCursor.value = document.body.style.cursor;
    previousBodyUserSelect.value = document.body.style.userSelect;
    document.body.style.cursor = resolveResizeCursor();
    document.body.style.userSelect = 'none';
  }

  function resetGlobalResizeState() {
    document.body.style.cursor = previousBodyCursor.value;
    document.body.style.userSelect = previousBodyUserSelect.value;
  }

  function stopResize() {
    activeHandle.value = null;
    hoverHandle.value = null;
    resetGlobalResizeState();
    window.removeEventListener('pointermove', handleWindowPointerMove);
    window.removeEventListener('pointerup', handleWindowPointerUp);
    window.removeEventListener('pointercancel', handleWindowPointerUp);
  }

  function handleWindowPointerMove(event: PointerEvent) {
    if (!activeHandle.value) {
      return;
    }

    if (activeHandle.value === 'sidebar') {
      updateSidebarWidth(event.clientX);
      return;
    }

    updatePreviewWidth(event.clientX);
  }

  function handleWindowPointerUp() {
    stopResize();
  }

  function handlePointerMove(event: PointerEvent) {
    if (isResizing.value) {
      return;
    }

    hoverHandle.value = resolveHandle(event.clientX);
  }

  function handlePointerLeave() {
    if (isResizing.value) {
      return;
    }

    hoverHandle.value = null;
  }

  function startResize(handle: ResizeHandle, event: PointerEvent) {
    if (!event.isPrimary || event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    hoverHandle.value = handle;
    activeHandle.value = handle;
    applyGlobalResizeState();

    if (handle === 'sidebar') {
      updateSidebarWidth(event.clientX);
    } else {
      updatePreviewWidth(event.clientX);
    }

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);
  }

  function handleSidebarPointerDown(event: PointerEvent) {
    startResize('sidebar', event);
  }

  function handlePreviewPointerDown(event: PointerEvent) {
    startResize('preview', event);
  }

  function handlePointerDown(event: PointerEvent) {
    if (!event.isPrimary || event.button !== 0) {
      return;
    }

    const handle = resolveHandle(event.clientX);
    if (!handle) {
      return;
    }

    startResize(handle, event);
  }

  const workspaceViewClass = computed<Record<string, boolean>>(() => {
    return {
      'workspace-view--resize-ready': highlightedHandle.value !== null,
      'workspace-view--resizing': isResizing.value,
      'workspace-view--sidebar-highlighted': highlightedHandle.value === 'sidebar',
      'workspace-view--preview-highlighted': highlightedHandle.value === 'preview',
    };
  });

  const sidebarPaneStyle = computed<CSSProperties>(() => {
    const width = `${sidebarWidth.value}px`;
    return {
      width,
      minWidth: width,
      maxWidth: width,
      flex: `0 0 ${width}`,
    };
  });

  const editorPaneStyle = computed<CSSProperties>(() => {
    return {
      flex: '1 1 auto',
      minWidth: `${EDITOR_MIN_WIDTH}px`,
    };
  });

  const previewPaneStyle = computed<CSSProperties>(() => {
    if (!options.canResizePreviewRef.value) {
      return {
        flex: '1 1 auto',
        minWidth: '0',
      };
    }

    const width = `${previewWidth.value}px`;
    return {
      width,
      minWidth: width,
      maxWidth: width,
      flex: `0 0 ${width}`,
    };
  });

  watch(
    [options.hasTrailingContentRef, options.canResizePreviewRef],
    async ([hasTrailingContent, canResizePreview]) => {
      if (!hasTrailingContent && activeHandle.value === 'sidebar') {
        stopResize();
      }

      if (!canResizePreview && activeHandle.value === 'preview') {
        stopResize();
      }

      await nextTick();
      normalizePaneWidths();
    },
    { immediate: true },
  );

  onMounted(() => {
    nextTick(() => {
      normalizePaneWidths();
    });
    window.addEventListener('resize', normalizePaneWidths);
  });

  onBeforeUnmount(() => {
    stopResize();
    window.removeEventListener('resize', normalizePaneWidths);
  });

  return {
    workspaceViewClass,
    sidebarPaneStyle,
    editorPaneStyle,
    previewPaneStyle,
    handlePointerMove,
    handlePointerLeave,
    handlePointerDown,
    handleSidebarPointerDown,
    handlePreviewPointerDown,
  };
}
