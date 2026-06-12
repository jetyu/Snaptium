import {
  DEFAULT_SYNC_SETTINGS,
  SYNC_INTERVALS,
  SYNC_STATUS,
  SYNC_TRIGGERS,
} from '@shared/sync.constants';

export { DEFAULT_SYNC_SETTINGS, SYNC_INTERVALS, SYNC_STATUS, SYNC_TRIGGERS };

export const SYNC_INTERVAL_OPTIONS = [
  { value: SYNC_INTERVALS.MANUAL, labelKey: 'option.sync.manual' },
  { value: SYNC_INTERVALS.FIVE_MINUTES, labelKey: 'option.sync.5min' },
  { value: SYNC_INTERVALS.TEN_MINUTES, labelKey: 'option.sync.10min' },
  { value: SYNC_INTERVALS.FIFTEEN_MINUTES, labelKey: 'option.sync.15min' },
] as const;