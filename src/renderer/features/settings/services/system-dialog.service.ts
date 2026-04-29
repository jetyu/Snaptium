import type { MessageDialogOptions } from '@renderer/core/bridge/electronApi';
import { settingsService } from './settings.service';

type SystemDialogPayload = Omit<MessageDialogOptions, 'type'> & {
  message: string;
};

async function show(type: NonNullable<MessageDialogOptions['type']>, payload: SystemDialogPayload): Promise<void> {
  await settingsService.showMessageDialog({
    type,
    title: payload.title,
    message: payload.message,
    detail: payload.detail,
  });
}

export const systemDialog = {
  async info(payload: SystemDialogPayload): Promise<void> {
    await show('info', payload);
  },

  async warning(payload: SystemDialogPayload): Promise<void> {
    await show('warning', payload);
  },

  async error(payload: SystemDialogPayload): Promise<void> {
    await show('error', payload);
  },
};
