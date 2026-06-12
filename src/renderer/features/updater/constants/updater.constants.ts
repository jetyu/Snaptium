/**
 * Updater related constants for renderer process
 */
export const UPDATER_CONSTANTS = {
  // 更新检查间隔（毫秒）
  DEFAULT_CHECK_INTERVAL: 43200000, // 12 hours = 12 * 60 * 60 * 1000
  
  // 启动后首次检查延迟（毫秒）
  INITIAL_CHECK_DELAY: 10000, // 10 seconds
} as const;
