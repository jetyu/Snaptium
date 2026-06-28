import { computed, nextTick, onScopeDispose, ref, watch, type CSSProperties, type Ref } from 'vue';

interface DraggableDialogOptions {
  isOpen: Ref<boolean>;
  overlayRef: Ref<HTMLElement | null>;
  dialogRef: Ref<HTMLElement | null>;
  handleRef: Ref<HTMLElement | null>;
}

interface DialogPosition {
  left: number;
  top: number;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  originLeft: number;
  originTop: number;
}

const INTERACTIVE_HEADER_SELECTOR = [
  'button',
  'a',
  'input',
  'select',
  'textarea',
  'label',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[data-dialog-drag-ignore]',
].join(', ');

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function hasClosest(target: EventTarget | null): target is EventTarget & { closest: (selector: string) => Element | null } {
  return typeof (target as { closest?: unknown } | null)?.closest === 'function';
}

export function useDraggableDialog({
  isOpen,
  overlayRef,
  dialogRef,
  handleRef,
}: DraggableDialogOptions) {
  const position = ref<DialogPosition | null>(null);
  const dragState = ref<DragState | null>(null);
  let previousBodyUserSelect = '';

  function getViewportSize(): { width: number; height: number } {
    const overlay = overlayRef.value;
    if (overlay) {
      const rect = overlay.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return {
          width: rect.width,
          height: rect.height,
        };
      }
    }

    if (typeof window === 'undefined') {
      return { width: 0, height: 0 };
    }

    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  function getDialogSize(): { width: number; height: number } {
    const dialog = dialogRef.value;
    if (!dialog) {
      return { width: 0, height: 0 };
    }

    const rect = dialog.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
    };
  }

  function clampPosition(left: number, top: number): DialogPosition {
    const { width: viewportWidth, height: viewportHeight } = getViewportSize();
    const { width: dialogWidth, height: dialogHeight } = getDialogSize();
    const maxLeft = Math.max(0, viewportWidth - dialogWidth);
    const maxTop = Math.max(0, viewportHeight - dialogHeight);

    return {
      left: Math.round(clamp(left, 0, maxLeft)),
      top: Math.round(clamp(top, 0, maxTop)),
    };
  }

  function resetDialogPosition(): void {
    if (!dialogRef.value) {
      return;
    }

    const { width: viewportWidth, height: viewportHeight } = getViewportSize();
    const { width: dialogWidth, height: dialogHeight } = getDialogSize();
    position.value = clampPosition(
      (viewportWidth - dialogWidth) / 2,
      (viewportHeight - dialogHeight) / 2,
    );
  }

  function restoreBodyUserSelect(): void {
    if (typeof document === 'undefined') {
      return;
    }

    document.body.style.userSelect = previousBodyUserSelect;
    previousBodyUserSelect = '';
  }

  function stopDragging(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
    }

    dragState.value = null;
    restoreBodyUserSelect();
  }

  function updateDraggedPosition(clientX: number, clientY: number): void {
    if (!dragState.value) {
      return;
    }

    const left = dragState.value.originLeft + (clientX - dragState.value.startX);
    const top = dragState.value.originTop + (clientY - dragState.value.startY);
    position.value = clampPosition(left, top);
  }

  function handleWindowPointerMove(event: PointerEvent): void {
    if (!dragState.value || event.pointerId !== dragState.value.pointerId) {
      return;
    }

    updateDraggedPosition(event.clientX, event.clientY);
  }

  function handleWindowPointerUp(event: PointerEvent): void {
    if (!dragState.value || event.pointerId !== dragState.value.pointerId) {
      return;
    }

    stopDragging();
  }

  function onDragHandlePointerDown(event: PointerEvent): void {
    if (event.button !== 0 || !handleRef.value || !dialogRef.value) {
      return;
    }

    if (hasClosest(event.target) && event.target.closest(INTERACTIVE_HEADER_SELECTOR)) {
      return;
    }

    if (!position.value) {
      resetDialogPosition();
    }

    if (!position.value) {
      return;
    }

    dragState.value = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originLeft: position.value.left,
      originTop: position.value.top,
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('pointermove', handleWindowPointerMove);
      window.addEventListener('pointerup', handleWindowPointerUp);
      window.addEventListener('pointercancel', handleWindowPointerUp);
    }

    if (typeof document !== 'undefined') {
      previousBodyUserSelect = document.body.style.userSelect;
      document.body.style.userSelect = 'none';
    }

    event.preventDefault();
  }

  function handleWindowResize(): void {
    if (!isOpen.value || !position.value) {
      return;
    }

    position.value = clampPosition(position.value.left, position.value.top);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleWindowResize);
  }

  watch(isOpen, async (open) => {
    stopDragging();

    if (!open) {
      position.value = null;
      return;
    }

    await nextTick();
    resetDialogPosition();
  });

  onScopeDispose(() => {
    stopDragging();
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', handleWindowResize);
    }
  });

  const dialogStyle = computed<CSSProperties>(() => {
    if (!position.value) {
      return {
        position: 'absolute',
        visibility: 'hidden',
      };
    }

    return {
      position: 'absolute',
      left: `${position.value.left}px`,
      top: `${position.value.top}px`,
    };
  });

  return {
    dialogStyle,
    onDragHandlePointerDown,
    resetDialogPosition,
  };
}
