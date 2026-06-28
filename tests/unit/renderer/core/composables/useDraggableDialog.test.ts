import { computed, effectScope, nextTick, ref, type ComputedRef, type EffectScope, type Ref } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDraggableDialog } from '@renderer/core/composables/useDraggableDialog';

interface MockWindowLike {
  innerWidth: number;
  innerHeight: number;
  addEventListener: (type: string, listener: MockListener) => void;
  removeEventListener: (type: string, listener: MockListener) => void;
  dispatch: (type: string, event: Record<string, unknown>) => void;
  resizeTo: (width: number, height: number) => void;
}

type MockListener = (event: Record<string, unknown>) => void;

interface DialogHarness {
  scope: EffectScope;
  mockWindow: MockWindowLike;
  isOpen: Ref<boolean>;
  dialogStyle: ComputedRef<Record<string, string>>;
  onDragHandlePointerDown: (event: PointerEvent) => void;
}

const originalWindow = globalThis.window;
const originalDocument = globalThis.document;

function createMockWindow(width: number, height: number): MockWindowLike {
  const listeners = new Map<string, Set<MockListener>>();

  return {
    innerWidth: width,
    innerHeight: height,
    addEventListener(type: string, listener: MockListener) {
      const entries = listeners.get(type) ?? new Set<MockListener>();
      entries.add(listener);
      listeners.set(type, entries);
    },
    removeEventListener(type: string, listener: MockListener) {
      listeners.get(type)?.delete(listener);
    },
    dispatch(type: string, event: Record<string, unknown>) {
      listeners.get(type)?.forEach((listener) => listener(event));
    },
    resizeTo(nextWidth: number, nextHeight: number) {
      this.innerWidth = nextWidth;
      this.innerHeight = nextHeight;
    },
  };
}

function createMockElement(size: { width: number; height: number }): HTMLElement {
  return {
    getBoundingClientRect: () => ({
      width: size.width,
      height: size.height,
      left: 0,
      top: 0,
      right: size.width,
      bottom: size.height,
      x: 0,
      y: 0,
      toJSON: () => undefined,
    }),
  } as HTMLElement;
}

function createMockTarget(interactive: boolean): EventTarget {
  return {
    closest: () => (interactive ? ({} as Element) : null),
  } as EventTarget;
}

async function flushDraggableWatchers(): Promise<void> {
  await nextTick();
  await nextTick();
}

function createHarness(): DialogHarness {
  const mockWindow = createMockWindow(1200, 800);
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: mockWindow,
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      body: {
        style: {
          userSelect: '',
        },
      },
    },
  });

  const scope = effectScope();
  const harness = scope.run(() => {
    const isOpen = ref(false);
    const overlaySize = { width: 1200, height: 800 };
    const overlayRef = ref<HTMLElement | null>(createMockElement(overlaySize));
    const dialogRef = ref<HTMLElement | null>(createMockElement({ width: 400, height: 300 }));
    const handleRef = ref<HTMLElement | null>(createMockElement({ width: 0, height: 0 }));
    const originalResizeTo = mockWindow.resizeTo.bind(mockWindow);
    mockWindow.resizeTo = (width: number, height: number) => {
      overlaySize.width = width;
      overlaySize.height = height;
      originalResizeTo(width, height);
    };
    const { dialogStyle, onDragHandlePointerDown } = useDraggableDialog({
      isOpen: computed(() => isOpen.value),
      overlayRef,
      dialogRef,
      handleRef,
    });

    return {
      isOpen,
      dialogStyle: computed(() => dialogStyle.value as Record<string, string>),
      onDragHandlePointerDown,
    };
  });

  if (!harness) {
    throw new Error('Failed to create draggable dialog harness');
  }

  return {
    scope,
    mockWindow,
    ...harness,
  };
}

afterEach(() => {
  if (originalWindow === undefined) {
    delete (globalThis as { window?: Window }).window;
  } else {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    });
  }

  if (originalDocument === undefined) {
    delete (globalThis as { document?: Document }).document;
  } else {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: originalDocument,
    });
  }
});

describe('useDraggableDialog', () => {
  it('centers the dialog when opened', async () => {
    const harness = createHarness();

    harness.isOpen.value = true;
    await flushDraggableWatchers();

    expect(harness.dialogStyle.value.left).toBe('400px');
    expect(harness.dialogStyle.value.top).toBe('250px');

    harness.scope.stop();
  });

  it('updates the dialog position while dragging', async () => {
    const harness = createHarness();

    harness.isOpen.value = true;
    await flushDraggableWatchers();

    const preventDefault = vi.fn();
    harness.onDragHandlePointerDown({
      button: 0,
      clientX: 600,
      clientY: 400,
      pointerId: 1,
      preventDefault,
      target: createMockTarget(false),
    } as unknown as PointerEvent);

    harness.mockWindow.dispatch('pointermove', {
      clientX: 700,
      clientY: 450,
      pointerId: 1,
    });

    expect(harness.dialogStyle.value.left).toBe('500px');
    expect(harness.dialogStyle.value.top).toBe('300px');
    expect(preventDefault).toHaveBeenCalledOnce();

    harness.scope.stop();
  });

  it('clamps the dragged position inside the viewport', async () => {
    const harness = createHarness();

    harness.isOpen.value = true;
    await flushDraggableWatchers();

    harness.onDragHandlePointerDown({
      button: 0,
      clientX: 600,
      clientY: 400,
      pointerId: 2,
      preventDefault: vi.fn(),
      target: createMockTarget(false),
    } as unknown as PointerEvent);

    harness.mockWindow.dispatch('pointermove', {
      clientX: -200,
      clientY: -200,
      pointerId: 2,
    });

    expect(harness.dialogStyle.value.left).toBe('0px');
    expect(harness.dialogStyle.value.top).toBe('0px');

    harness.mockWindow.dispatch('pointermove', {
      clientX: 2400,
      clientY: 2000,
      pointerId: 2,
    });

    expect(harness.dialogStyle.value.left).toBe('800px');
    expect(harness.dialogStyle.value.top).toBe('500px');

    harness.scope.stop();
  });

  it('resets the dialog back to center when reopened', async () => {
    const harness = createHarness();

    harness.isOpen.value = true;
    await flushDraggableWatchers();

    harness.onDragHandlePointerDown({
      button: 0,
      clientX: 600,
      clientY: 400,
      pointerId: 3,
      preventDefault: vi.fn(),
      target: createMockTarget(false),
    } as unknown as PointerEvent);
    harness.mockWindow.dispatch('pointermove', {
      clientX: 900,
      clientY: 650,
      pointerId: 3,
    });

    harness.isOpen.value = false;
    await flushDraggableWatchers();
    harness.isOpen.value = true;
    await flushDraggableWatchers();

    expect(harness.dialogStyle.value.left).toBe('400px');
    expect(harness.dialogStyle.value.top).toBe('250px');

    harness.scope.stop();
  });

  it('re-clamps the dialog when the viewport shrinks', async () => {
    const harness = createHarness();

    harness.isOpen.value = true;
    await flushDraggableWatchers();

    harness.onDragHandlePointerDown({
      button: 0,
      clientX: 600,
      clientY: 400,
      pointerId: 4,
      preventDefault: vi.fn(),
      target: createMockTarget(false),
    } as unknown as PointerEvent);
    harness.mockWindow.dispatch('pointermove', {
      clientX: 1100,
      clientY: 850,
      pointerId: 4,
    });

    harness.mockWindow.resizeTo(700, 500);
    harness.mockWindow.dispatch('resize', {});

    expect(harness.dialogStyle.value.left).toBe('300px');
    expect(harness.dialogStyle.value.top).toBe('200px');

    harness.scope.stop();
  });

  it('does not start dragging when the pointerdown comes from interactive header content', async () => {
    const harness = createHarness();

    harness.isOpen.value = true;
    await flushDraggableWatchers();

    const preventDefault = vi.fn();
    harness.onDragHandlePointerDown({
      button: 0,
      clientX: 600,
      clientY: 400,
      pointerId: 5,
      preventDefault,
      target: createMockTarget(true),
    } as unknown as PointerEvent);
    harness.mockWindow.dispatch('pointermove', {
      clientX: 900,
      clientY: 650,
      pointerId: 5,
    });

    expect(harness.dialogStyle.value.left).toBe('400px');
    expect(harness.dialogStyle.value.top).toBe('250px');
    expect(preventDefault).not.toHaveBeenCalled();

    harness.scope.stop();
  });
});
