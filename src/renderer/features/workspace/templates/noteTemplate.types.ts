export type NoteTemplateId = 'blank' | 'daily' | 'meeting' | 'reading' | 'project-plan' | 'task-list';

export type NoteTemplateIconName = 'docAdd' | 'edit' | 'notes' | 'bookOpen';

export interface NoteTemplateDefinition {
  id: NoteTemplateId;
  titleKey: string;
  descriptionKey: string;
  iconName: NoteTemplateIconName;
  toneClass: string;
}

export interface NoteTemplate {
  title: string;
  content: string;
}

export type NoteTemplateTranslate = (key: string, named?: Record<string, string | number>) => string;
