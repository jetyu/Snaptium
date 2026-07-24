import { nextTick } from 'vue';
import { EditorView } from '@codemirror/view';
import { electronApi } from '@renderer/core/bridge/electronApi';
import { useAppShellStore } from '@renderer/app/store/appShell.store';
import { useEditor } from '@renderer/features/editor/composables/useEditor';
import { i18n } from '@renderer/features/i18n';
import { createLogger } from '@renderer/features/logger';
import { securityService } from '@renderer/features/security/services/security.service';
import { systemDialog } from '@renderer/features/settings/services/system-dialog.service';
import { useWorkspaceStore } from '@renderer/features/workspace/store/workspace.store';
import { getErrorMessage } from '@shared/utils/error.utils';

const EDITOR_WAIT_TIMEOUT_MS = 2_000;
const EDITOR_WAIT_INTERVAL_MS = 40;
const logger = createLogger('QuickCapture');

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatQuickCaptureTimestamp(date: Date): string {
  return [
    `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`,
    `${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}:${padDatePart(date.getSeconds())}`,
  ].join(' ');
}

async function delay(durationMs: number): Promise<void> {
  await new Promise<void>(resolve => window.setTimeout(resolve, durationMs));
}

export function useQuickCapture() {
  const appShellStore = useAppShellStore();
  const workspaceStore = useWorkspaceStore();
  const { getEditorView } = useEditor();
  const t = i18n.global.t.bind(i18n.global);

  let started = false;
  let applicationReady = false;
  let pendingRequest = false;
  let processing = false;
  let removeRequestListener: (() => void) | null = null;
  let removeAccessControlListener: (() => void) | null = null;

  async function isAccessControlLocked(): Promise<boolean> {
    if (!securityService.isAccessControlAvailable()) {
      return false;
    }

    try {
      const status = await securityService.getAccessControlStatus();
      return status.config.enabled && status.isLocked;
    } catch (error: unknown) {
      logger.error(`Unable to verify access-control state; quick capture remains pending: ${getErrorMessage(error)}`);
      return true;
    }
  }

  async function waitForEditorView(): Promise<EditorView | null> {
    const deadline = Date.now() + EDITOR_WAIT_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await nextTick();
      const editorView = getEditorView();
      if (editorView) {
        return editorView;
      }
      await delay(EDITOR_WAIT_INTERVAL_MS);
    }
    return null;
  }

  async function createQuickCaptureNote(): Promise<void> {
    const title = `${t('quickCapture.noteTitlePrefix')} ${formatQuickCaptureTimestamp(new Date())}`;
    const note = await workspaceStore.createNote(null, title);
    if (!note) {
      await systemDialog.error({
        title: t('quickCapture.errorTitle'),
        message: t('quickCapture.createFailed'),
      });
      return;
    }

    await appShellStore.setActiveMainView('workspace');
    await nextTick();

    const editorView = await waitForEditorView();
    if (!editorView) {
      logger.warn('Quick capture note was created, but the editor did not become ready in time.');
      return;
    }

    const documentEnd = editorView.state.doc.length;
    editorView.dispatch({
      selection: { anchor: documentEnd },
      effects: EditorView.scrollIntoView(documentEnd, { y: 'center' }),
    });
    editorView.focus();
  }

  async function processPendingRequest(): Promise<void> {
    if (!applicationReady || !pendingRequest || processing) {
      return;
    }

    processing = true;
    let deferUntilUnlock = false;
    try {
      if (await isAccessControlLocked()) {
        deferUntilUnlock = true;
        return;
      }

      pendingRequest = false;
      await createQuickCaptureNote();
    } finally {
      processing = false;
      if (pendingRequest && !deferUntilUnlock) {
        void processPendingRequest();
      }
    }
  }

  function requestCapture(): void {
    pendingRequest = true;
    void processPendingRequest();
  }

  function start(): void {
    if (started || !electronApi.quickCapture.isAvailable()) {
      return;
    }

    started = true;
    removeRequestListener = electronApi.quickCapture.onRequested(requestCapture);
    removeAccessControlListener = securityService.onAccessControlStateChanged((payload) => {
      if (!payload.locked) {
        void processPendingRequest();
      }
    });
    electronApi.quickCapture.markReady();
  }

  function markApplicationReady(): void {
    applicationReady = true;
    void processPendingRequest();
  }

  function dispose(): void {
    removeRequestListener?.();
    removeRequestListener = null;
    removeAccessControlListener?.();
    removeAccessControlListener = null;
    started = false;
    applicationReady = false;
    pendingRequest = false;
  }

  return {
    start,
    markApplicationReady,
    dispose,
  };
}
