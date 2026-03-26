/**
 * 应用默认设置项
 */
export const DEFAULT_SETTINGS = {
  language: "zh-CN", // 默认为中文
  theme: "system",
  editor: {
    fontSize: "16",
    fontFamily: "'Arial', sans-serif",
  },
  preview: {
    fontSize: "16",
    fontFamily: "'Arial', sans-serif",
  },
  aiSettings: {
    enabled: false,
    model: "",
    apiKey: "",
    endpoint: "",
    systemPrompt: "",
    typingDelay: 2000,
    minInputLength: 10,
  },
  noteSavePath: "",
  startupOnLogin: false,
  autoUpdate: true,
  loggingSettings: {
    enabled: true,
    level: "info",
  },
};
