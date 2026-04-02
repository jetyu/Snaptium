/**
 * 格式化快捷键显示
 * 将 Electron 的快捷键格式转换为用户友好的显示格式
 */
export function formatKeybinding(key: string): string {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  
  let formatted = key;
  
  // 替换 CommandOrControl
  if (isMac) {
    formatted = formatted.replace(/CommandOrControl|CmdOrCtrl/gi, '⌘');
  } else {
    formatted = formatted.replace(/CommandOrControl|CmdOrCtrl/gi, 'Ctrl');
  }
  
  // 替换其他修饰键
  if (isMac) {
    formatted = formatted
      .replace(/Command|Cmd/gi, '⌘')
      .replace(/Control|Ctrl/gi, '⌃')
      .replace(/Alt/gi, '⌥')
      .replace(/Shift/gi, '⇧')
      .replace(/Option/gi, '⌥');
  } else {
    formatted = formatted
      .replace(/Command|Cmd/gi, 'Win')
      .replace(/Control|Ctrl/gi, 'Ctrl')
      .replace(/Alt/gi, 'Alt')
      .replace(/Shift/gi, 'Shift');
  }
  
  // 替换特殊键
  formatted = formatted
    .replace(/Plus/gi, '+')
    .replace(/Space/gi, 'Space')
    .replace(/Tab/gi, 'Tab')
    .replace(/Backspace/gi, 'Backspace')
    .replace(/Delete/gi, 'Delete')
    .replace(/Insert/gi, 'Insert')
    .replace(/Return|Enter/gi, 'Enter')
    .replace(/Up/gi, '↑')
    .replace(/Down/gi, '↓')
    .replace(/Left/gi, '←')
    .replace(/Right/gi, '→')
    .replace(/Home/gi, 'Home')
    .replace(/End/gi, 'End')
    .replace(/PageUp/gi, 'PageUp')
    .replace(/PageDown/gi, 'PageDown')
    .replace(/Escape|Esc/gi, 'Esc');
  
  return formatted;
}
