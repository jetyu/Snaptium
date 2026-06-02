import blankTemplateMarkdown from './markdown/blank.md?raw';
import dailyTemplateMarkdown from './markdown/daily.md?raw';
import meetingTemplateMarkdown from './markdown/meeting.md?raw';
import projectPlanTemplateMarkdown from './markdown/project-plan.md?raw';
import readingTemplateMarkdown from './markdown/reading.md?raw';
import taskListTemplateMarkdown from './markdown/task-list.md?raw';
import { NOTE_TEMPLATE_IDS } from './noteTemplate.catalog';
import type { NoteTemplate, NoteTemplateId, NoteTemplateTranslate } from './noteTemplate.types';

const NOTE_TEMPLATE_MARKDOWN_BY_ID = {
  [NOTE_TEMPLATE_IDS.BLANK]: blankTemplateMarkdown,
  [NOTE_TEMPLATE_IDS.DAILY]: dailyTemplateMarkdown,
  [NOTE_TEMPLATE_IDS.MEETING]: meetingTemplateMarkdown,
  [NOTE_TEMPLATE_IDS.READING]: readingTemplateMarkdown,
  [NOTE_TEMPLATE_IDS.PROJECT_PLAN]: projectPlanTemplateMarkdown,
  [NOTE_TEMPLATE_IDS.TASK_LIST]: taskListTemplateMarkdown,
} as const satisfies Record<NoteTemplateId, string>;

const NOTE_TEMPLATE_TOKEN_KEYS = {
  'placeholder.addItem': 'workbench.onboarding.generated.placeholder.addItem',
  'placeholder.quote': 'workbench.onboarding.generated.placeholder.quote',
  'placeholder.task': 'workbench.onboarding.generated.placeholder.task',
  'placeholder.writeHere': 'workbench.onboarding.generated.placeholder.writeHere',
  'section.actionItems': 'workbench.onboarding.generated.section.actionItems',
  'section.attendees': 'workbench.onboarding.generated.section.attendees',
  'section.blocked': 'workbench.onboarding.generated.section.blocked',
  'section.capture': 'workbench.onboarding.generated.section.capture',
  'section.decisions': 'workbench.onboarding.generated.section.decisions',
  'section.done': 'workbench.onboarding.generated.section.done',
  'section.focus': 'workbench.onboarding.generated.section.focus',
  'section.followUp': 'workbench.onboarding.generated.section.followUp',
  'section.inProgress': 'workbench.onboarding.generated.section.inProgress',
  'section.keyIdeas': 'workbench.onboarding.generated.section.keyIdeas',
  'section.milestones': 'workbench.onboarding.generated.section.milestones',
  'section.nextActions': 'workbench.onboarding.generated.section.nextActions',
  'section.objective': 'workbench.onboarding.generated.section.objective',
  'section.priority': 'workbench.onboarding.generated.section.priority',
  'section.quotes': 'workbench.onboarding.generated.section.quotes',
  'section.risks': 'workbench.onboarding.generated.section.risks',
  'section.scope': 'workbench.onboarding.generated.section.scope',
  'section.source': 'workbench.onboarding.generated.section.source',
  'section.time': 'workbench.onboarding.generated.section.time',
} as const satisfies Record<string, string>;

export function buildNoteTemplate(templateId: NoteTemplateId, t: NoteTemplateTranslate, now: Date = new Date()): NoteTemplate {
  const dateText = formatTemplateDate(now);
  const title = buildNoteTemplateTitle(templateId, t, dateText);

  return {
    title,
    content: renderNoteTemplateMarkdown(NOTE_TEMPLATE_MARKDOWN_BY_ID[templateId], t, {
      date: dateText,
      title,
    }),
  };
}

function buildNoteTemplateTitle(templateId: NoteTemplateId, t: NoteTemplateTranslate, dateText: string): string {
  if (templateId === NOTE_TEMPLATE_IDS.DAILY) {
    return t('workbench.onboarding.generated.dailyTitle', { date: dateText });
  }

  if (templateId === NOTE_TEMPLATE_IDS.MEETING) {
    return t('workbench.onboarding.generated.meetingTitle', { date: dateText });
  }

  if (templateId === NOTE_TEMPLATE_IDS.READING) {
    return t('workbench.onboarding.generated.readingTitle');
  }

  if (templateId === NOTE_TEMPLATE_IDS.PROJECT_PLAN) {
    return t('workbench.onboarding.generated.projectPlanTitle');
  }

  if (templateId === NOTE_TEMPLATE_IDS.TASK_LIST) {
    return t('workbench.onboarding.generated.taskListTitle');
  }

  return t('workbench.onboarding.generated.blankTitle');
}

function renderNoteTemplateMarkdown(
  markdown: string,
  t: NoteTemplateTranslate,
  values: Record<'date' | 'title', string>,
): string {
  const tokenValues: Record<string, string> = {
    date: values.date,
    title: values.title,
    ...Object.fromEntries(
      Object.entries(NOTE_TEMPLATE_TOKEN_KEYS).map(([token, key]) => [token, t(key)]),
    ),
  };

  return markdown.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match: string, token: string): string => {
    return tokenValues[token] ?? match;
  });
}

function formatTemplateDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
