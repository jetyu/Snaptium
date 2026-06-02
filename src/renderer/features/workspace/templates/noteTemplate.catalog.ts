import type { NoteTemplateDefinition, NoteTemplateId } from './noteTemplate.types';

export const NOTE_TEMPLATE_IDS = {
  BLANK: 'blank',
  DAILY: 'daily',
  MEETING: 'meeting',
  READING: 'reading',
  PROJECT_PLAN: 'project-plan',
  TASK_LIST: 'task-list',
} as const satisfies Record<string, NoteTemplateId>;

export const NOTE_TEMPLATE_DEFAULT_ID = NOTE_TEMPLATE_IDS.BLANK;

export const NOTE_TEMPLATE_DEFINITIONS = [
  {
    id: NOTE_TEMPLATE_IDS.BLANK,
    titleKey: 'workbench.onboarding.template.blank.title',
    descriptionKey: 'workbench.onboarding.template.blank.description',
    iconName: 'docAdd',
    toneClass: 'tone-primary',
  },
  {
    id: NOTE_TEMPLATE_IDS.DAILY,
    titleKey: 'workbench.onboarding.template.daily.title',
    descriptionKey: 'workbench.onboarding.template.daily.description',
    iconName: 'edit',
    toneClass: 'tone-sky',
  },
  {
    id: NOTE_TEMPLATE_IDS.MEETING,
    titleKey: 'workbench.onboarding.template.meeting.title',
    descriptionKey: 'workbench.onboarding.template.meeting.description',
    iconName: 'notes',
    toneClass: 'tone-soft',
  },
  {
    id: NOTE_TEMPLATE_IDS.READING,
    titleKey: 'workbench.onboarding.template.reading.title',
    descriptionKey: 'workbench.onboarding.template.reading.description',
    iconName: 'bookOpen',
    toneClass: 'tone-deep',
  },
  {
    id: NOTE_TEMPLATE_IDS.PROJECT_PLAN,
    titleKey: 'workbench.onboarding.template.projectPlan.title',
    descriptionKey: 'workbench.onboarding.template.projectPlan.description',
    iconName: 'bookOpen',
    toneClass: 'tone-primary',
  },
  {
    id: NOTE_TEMPLATE_IDS.TASK_LIST,
    titleKey: 'workbench.onboarding.template.taskList.title',
    descriptionKey: 'workbench.onboarding.template.taskList.description',
    iconName: 'notes',
    toneClass: 'tone-soft',
  },
] as const satisfies readonly NoteTemplateDefinition[];

export function isNoteTemplateId(value: string): value is NoteTemplateId {
  return Object.values(NOTE_TEMPLATE_IDS).some((templateId) => templateId === value);
}
