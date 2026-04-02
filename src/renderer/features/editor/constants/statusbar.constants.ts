/**
 * Editor status bar constants
 */

export const STATUSBAR_CONSTANTS = {
  REGEX: {
    CHINESE_CHARS: /[\u4e00-\u9fa5]/g,
    ENGLISH_WORDS: /[a-zA-Z0-9]+(?:[-'][a-zA-Z0-9]+)*/g,
    PARAGRAPH: /\n\s*\n/g, // 段落分隔（空行）
  },
  
  FILE_SIZE: {
    UNITS: ['B', 'KB', 'MB', 'GB'] as const,
    THRESHOLD: 1024,
  },
} as const;
