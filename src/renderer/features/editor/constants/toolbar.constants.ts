export interface ToolbarAction {
  name: string;
  i18nKey: string;
  icon: string;
  group: 'heading' | 'format' | 'list' | 'block' | 'insert';
}

export const TOOLBAR_ACTIONS: ToolbarAction[] = [
  { name: 'heading1', i18nKey: 'toolbar.heading1', icon: 'heading-1', group: 'heading' },
  { name: 'heading2', i18nKey: 'toolbar.heading2', icon: 'heading-2', group: 'heading' },
  
  { name: 'bold', i18nKey: 'toolbar.bold', icon: 'bold', group: 'format' },
  { name: 'italic', i18nKey: 'toolbar.italic', icon: 'italic', group: 'format' },
  { name: 'strikethrough', i18nKey: 'toolbar.strikethrough', icon: 'strikethrough', group: 'format' },
  
  { name: 'bulletList', i18nKey: 'toolbar.bulletList', icon: 'list-bullet', group: 'list' },
  { name: 'numberedList', i18nKey: 'toolbar.numberedList', icon: 'list-numbered', group: 'list' },
  { name: 'taskList', i18nKey: 'toolbar.taskList', icon: 'list-check', group: 'list' },
  
  { name: 'quote', i18nKey: 'toolbar.quote', icon: 'quote', group: 'block' },
  { name: 'codeBlock', i18nKey: 'toolbar.codeBlock', icon: 'code', group: 'block' },
  
  { name: 'insertLink', i18nKey: 'toolbar.insertLink', icon: 'link', group: 'insert' },
  { name: 'insertImage', i18nKey: 'toolbar.insertImage', icon: 'image', group: 'insert' },
  { name: 'insertTable', i18nKey: 'toolbar.insertTable', icon: 'table', group: 'insert' },
];

export const TOOLBAR_GROUPS = {
  heading: TOOLBAR_ACTIONS.filter(a => a.group === 'heading'),
  format: TOOLBAR_ACTIONS.filter(a => a.group === 'format'),
  list: TOOLBAR_ACTIONS.filter(a => a.group === 'list'),
  block: TOOLBAR_ACTIONS.filter(a => a.group === 'block'),
  insert: TOOLBAR_ACTIONS.filter(a => a.group === 'insert'),
};
