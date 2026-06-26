<template>
  <Teleport to="body">
    <div ref="overlayRef" class="workbench-onboarding" role="dialog" aria-modal="true"
      aria-labelledby="workbench-onboarding-title" tabindex="0" @keydown.esc="emit('dismiss')">
      <section class="workbench-onboarding__dialog" @click.stop>
        <button type="button" class="workbench-onboarding__close dialog-close-button" :aria-label="t('button.close')"
          @click="emit('dismiss')">
          <IconX :size="16" />
        </button>

        <aside class="workbench-onboarding__rail">
          <span class="workbench-onboarding__kicker">{{ t('workbench.onboarding.kicker') }}</span>
          <h2 id="workbench-onboarding-title">{{ t('workbench.onboarding.title') }}</h2>
          <p>{{ t('workbench.onboarding.description') }}</p>

          <ol class="workbench-onboarding__steps">
            <li v-for="(step, index) in stepDefinitions" :key="step.id" class="workbench-onboarding__step" :class="{
              'is-active': index === currentStep,
              'is-complete': index < currentStep,
            }">
              <span class="workbench-onboarding__step-index">
                <IconCheck v-if="index < currentStep" :size="14" />
                <span v-else>{{ index + 1 }}</span>
              </span>
              <span class="workbench-onboarding__step-copy">
                <strong>{{ step.label }}</strong>
                <span>{{ step.caption }}</span>
              </span>
            </li>
          </ol>
        </aside>

        <main class="workbench-onboarding__main">
          <header class="workbench-onboarding__main-header">
            <span>{{ t('workbench.onboarding.stepCount', { current: currentStep + 1, total: stepDefinitions.length })
            }}</span>
            <h3>{{ activeStep.title }}</h3>
            <p>{{ activeStep.description }}</p>
          </header>

          <div v-if="currentStep === 0" class="workbench-onboarding__intent-grid">
            <button v-for="intent in intentCards" :key="intent.id" type="button"
              class="workbench-onboarding__choice-card" :class="{ 'is-selected': selectedIntent === intent.id }"
              :aria-pressed="selectedIntent === intent.id" @click="selectIntent(intent.id)">
              <span class="workbench-onboarding__choice-head">
                <span class="workbench-onboarding__choice-icon" :class="intent.toneClass">
                  <component :is="intent.icon" :size="18" />
                </span>
                <span v-if="intent.recommended" class="workbench-onboarding__badge">
                  {{ t('workbench.onboarding.recommended') }}
                </span>
              </span>
              <strong>{{ intent.title }}</strong>
              <span>{{ intent.description }}</span>
            </button>
          </div>

          <div v-else-if="currentStep === 1" class="workbench-onboarding__template-step">
            <NoteTemplatePicker v-model="selectedTemplate" />

            <section class="workbench-onboarding__start-panel">
              <div>
                <strong>{{ t('workbench.onboarding.startPanel.title') }}</strong>
                <span>{{ t('workbench.onboarding.startPanel.description') }}</span>
              </div>
              <div class="workbench-onboarding__start-actions">
                <button type="button" class="workbench-onboarding__primary-action"
                  @click="emit('create-template', selectedTemplate)">
                  <IconFilePlus :size="16" />
                  <span>{{ t('workbench.onboarding.createSelected') }}</span>
                </button>
                <button type="button" class="workbench-onboarding__secondary-action" @click="emit('import-markdown')">
                  <IconFileImport :size="16" />
                  <span>{{ t('workbench.onboarding.importCta') }}</span>
                </button>
              </div>
            </section>
          </div>

          <div v-else-if="currentStep === 2" class="workbench-onboarding__map-grid">
            <article v-for="item in workspaceMapItems" :key="item.id" class="workbench-onboarding__map-card">
              <span class="workbench-onboarding__map-icon" :class="item.toneClass">
                <component :is="item.icon" :size="18" />
              </span>
              <strong>{{ item.title }}</strong>
              <span>{{ item.description }}</span>
            </article>
          </div>

          <div v-else class="workbench-onboarding__finish-grid">
            <article v-for="item in finishItems" :key="item.id" class="workbench-onboarding__finish-card">
              <span class="workbench-onboarding__finish-icon" :class="item.toneClass">
                <component :is="item.icon" :size="18" />
              </span>
              <strong>{{ item.title }}</strong>
              <span>{{ item.description }}</span>
            </article>

            <section class="workbench-onboarding__sync-panel">
              <div>
                <strong>{{ t('workbench.onboarding.syncPanel.title') }}</strong>
                <span>{{ t('workbench.onboarding.syncPanel.description') }}</span>
              </div>
              <button type="button" class="workbench-onboarding__secondary-action" @click="emit('open-sync')">
                <IconDatabase :size="16" />
                <span>{{ t('workbench.onboarding.syncPanel.action') }}</span>
              </button>
            </section>
          </div>

          <footer class="workbench-onboarding__footer">
            <button type="button" class="workbench-onboarding__text-action" @click="emit('dismiss')">
              {{ t('workbench.onboarding.dismiss') }}
            </button>
            <div class="workbench-onboarding__nav">
              <button type="button" class="workbench-onboarding__nav-button" :disabled="currentStep === 0"
                @click="goPrevious">
                <IconArrowLeft :size="15" />
                <span>{{ t('workbench.onboarding.back') }}</span>
              </button>
              <button v-if="currentStep < lastStepIndex" type="button"
                class="workbench-onboarding__nav-button workbench-onboarding__nav-button--primary" @click="goNext">
                <span>{{ t('workbench.onboarding.next') }}</span>
                <IconArrowRight :size="15" />
              </button>
              <button v-else type="button"
                class="workbench-onboarding__nav-button workbench-onboarding__nav-button--primary"
                @click="emit('dismiss')">
                <IconCheck :size="15" />
                <span>{{ t('workbench.onboarding.finish') }}</span>
              </button>
            </div>
          </footer>
        </main>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, type Component } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  IconArrowLeft,
  IconArrowRight,
  IconBook,
  IconCheck,
  IconX,
  IconHierarchy,
  IconDatabase,
  IconFilePlus,
  IconPencil,
  IconFolderOpen,
  IconFileImport,
  IconFileText,
  IconSubtitlesAi,
  IconShield,
  IconTag,
} from '@tabler/icons-vue';
import { type NoteTemplateId } from '@renderer/features/workspace';
import NoteTemplatePicker from './NoteTemplatePicker.vue';

type OnboardingStepId = 'goal' | 'content' | 'structure' | 'finish';
type OnboardingIntentId = 'write' | 'knowledge' | 'meeting' | 'research';

interface OnboardingStepDefinition {
  id: OnboardingStepId;
  label: string;
  caption: string;
  title: string;
  description: string;
}

interface OnboardingCard<TId extends string> {
  id: TId;
  title: string;
  description: string;
  icon: Component;
  toneClass: string;
  recommended?: boolean;
}

const emit = defineEmits<{
  (event: 'create-template', templateId: NoteTemplateId): void;
  (event: 'dismiss'): void;
  (event: 'import-markdown'): void;
  (event: 'open-sync'): void;
}>();

const { t } = useI18n();
const overlayRef = ref<HTMLElement | null>(null);
const currentStep = ref(0);
const selectedIntent = ref<OnboardingIntentId>('write');
const selectedTemplate = ref<NoteTemplateId>('blank');

const intentTemplateMap: Record<OnboardingIntentId, NoteTemplateId> = {
  write: 'blank',
  knowledge: 'reading',
  meeting: 'meeting',
  research: 'daily',
};

const stepDefinitions = computed<OnboardingStepDefinition[]>(() => [
  {
    id: 'goal',
    label: t('workbench.onboarding.step.goal.label'),
    caption: t('workbench.onboarding.step.goal.caption'),
    title: t('workbench.onboarding.step.goal.title'),
    description: t('workbench.onboarding.step.goal.description'),
  },
  {
    id: 'content',
    label: t('workbench.onboarding.step.content.label'),
    caption: t('workbench.onboarding.step.content.caption'),
    title: t('workbench.onboarding.step.content.title'),
    description: t('workbench.onboarding.step.content.description'),
  },
  {
    id: 'structure',
    label: t('workbench.onboarding.step.structure.label'),
    caption: t('workbench.onboarding.step.structure.caption'),
    title: t('workbench.onboarding.step.structure.title'),
    description: t('workbench.onboarding.step.structure.description'),
  },
  {
    id: 'finish',
    label: t('workbench.onboarding.step.finish.label'),
    caption: t('workbench.onboarding.step.finish.caption'),
    title: t('workbench.onboarding.step.finish.title'),
    description: t('workbench.onboarding.step.finish.description'),
  },
]);

const lastStepIndex = computed<number>(() => stepDefinitions.value.length - 1);
const activeStep = computed<OnboardingStepDefinition>(() => stepDefinitions.value[currentStep.value]);

const intentCards = computed<Array<OnboardingCard<OnboardingIntentId>>>(() => [
  {
    id: 'write',
    title: t('workbench.onboarding.intent.write.title'),
    description: t('workbench.onboarding.intent.write.description'),
    icon: IconPencil,
    toneClass: 'tone-primary',
    recommended: true,
  },
  {
    id: 'knowledge',
    title: t('workbench.onboarding.intent.knowledge.title'),
    description: t('workbench.onboarding.intent.knowledge.description'),
    icon: IconBook,
    toneClass: 'tone-sky',
  },
  {
    id: 'meeting',
    title: t('workbench.onboarding.intent.meeting.title'),
    description: t('workbench.onboarding.intent.meeting.description'),
    icon: IconFileText,
    toneClass: 'tone-soft',
  },
  {
    id: 'research',
    title: t('workbench.onboarding.intent.research.title'),
    description: t('workbench.onboarding.intent.research.description'),
    icon: IconHierarchy,
    toneClass: 'tone-deep',
  },
]);

const workspaceMapItems = computed<Array<OnboardingCard<string>>>(() => [
  {
    id: 'workspace',
    title: t('workbench.onboarding.map.workspace.title'),
    description: t('workbench.onboarding.map.workspace.description'),
    icon: IconFileText,
    toneClass: 'tone-primary',
  },
  {
    id: 'notebooks',
    title: t('workbench.onboarding.map.notebooks.title'),
    description: t('workbench.onboarding.map.notebooks.description'),
    icon: IconFolderOpen,
    toneClass: 'tone-sky',
  },
  {
    id: 'tags',
    title: t('workbench.onboarding.map.tags.title'),
    description: t('workbench.onboarding.map.tags.description'),
    icon: IconTag,
    toneClass: 'tone-soft',
  },
  {
    id: 'search',
    title: t('workbench.onboarding.map.search.title'),
    description: t('workbench.onboarding.map.search.description'),
    icon: IconSubtitlesAi,
    toneClass: 'tone-deep',
  },
]);

const finishItems = computed<Array<OnboardingCard<string>>>(() => [
  {
    id: 'local',
    title: t('workbench.onboarding.finish.local.title'),
    description: t('workbench.onboarding.finish.local.description'),
    icon: IconShield,
    toneClass: 'tone-sky',
  },
  {
    id: 'review',
    title: t('workbench.onboarding.finish.review.title'),
    description: t('workbench.onboarding.finish.review.description'),
    icon: IconSubtitlesAi,
    toneClass: 'tone-primary',
  },
]);

function selectIntent(intentId: OnboardingIntentId): void {
  selectedIntent.value = intentId;
  selectedTemplate.value = intentTemplateMap[intentId];
}

function goPrevious(): void {
  currentStep.value = Math.max(0, currentStep.value - 1);
}

function goNext(): void {
  currentStep.value = Math.min(lastStepIndex.value, currentStep.value + 1);
}

onMounted(async () => {
  await nextTick();
  overlayRef.value?.focus();
});
</script>

<style scoped>
.workbench-onboarding {
  position: fixed;
  inset: 0;
  z-index: 1150;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--bg, #f0f2f5);
  outline: none;
}

.workbench-onboarding__dialog {
  position: relative;
  width: min(920px, calc(100vw - 32px));
  max-height: calc(100vh - 48px);
  overflow: hidden;
  display: grid;
  grid-template-columns: 270px minmax(0, 1fr);
  border: 1px solid color-mix(in srgb, var(--panel-border, #dbe3ef) 86%, transparent);
  border-radius: 12px;
  background: var(--panel, #ffffff);
  color: var(--text, #111827);
  box-shadow: 0 26px 76px rgba(15, 23, 42, 0.3);
}

.workbench-onboarding__close {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
}

.workbench-onboarding__rail {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 26px 22px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--accent) 10%, transparent), transparent 52%),
    color-mix(in srgb, var(--panel, #ffffff) 94%, #f4f7fb);
  border-right: 1px solid var(--panel-border, #dbe3ef);
}

.workbench-onboarding__kicker {
  width: fit-content;
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 8px;
  border: 1px solid color-mix(in srgb, var(--accent) 24%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent) 9%, transparent);
  color: color-mix(in srgb, var(--accent) 72%, var(--text, #111827));
  font-size: 0.74rem;
  font-weight: 720;
  line-height: 1;
}

.workbench-onboarding__rail h2 {
  margin: 0;
  color: var(--text, #111827);
  font-size: 1.32rem;
  font-weight: 760;
  line-height: 1.18;
}

.workbench-onboarding__rail p {
  margin: 0;
  color: var(--text-secondary, #64748b);
  font-size: 0.86rem;
  line-height: 1.55;
}

.workbench-onboarding__steps {
  display: grid;
  gap: 8px;
  padding: 8px 0 0;
  margin: 0;
  list-style: none;
}

.workbench-onboarding__step {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  padding: 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--text-secondary, #64748b);
}

.workbench-onboarding__step.is-active {
  border-color: color-mix(in srgb, var(--accent) 30%, transparent);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  color: var(--text, #111827);
}

.workbench-onboarding__step.is-complete {
  color: color-mix(in srgb, var(--accent-hover) 78%, var(--text, #111827));
}

.workbench-onboarding__step-index {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: color-mix(in srgb, var(--text-muted, #64748b) 10%, transparent);
  color: inherit;
  font-size: 0.78rem;
  font-weight: 760;
}

.workbench-onboarding__step.is-active .workbench-onboarding__step-index {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: color-mix(in srgb, var(--accent) 82%, var(--text, #111827));
}

.workbench-onboarding__step-copy {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.workbench-onboarding__step-copy strong {
  overflow: hidden;
  font-size: 0.84rem;
  font-weight: 720;
  line-height: 1.18;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workbench-onboarding__step-copy span {
  overflow: hidden;
  font-size: 0.74rem;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workbench-onboarding__main {
  min-width: 0;
  min-height: 560px;
  max-height: calc(100vh - 48px);
  overflow: auto;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 18px;
  padding: 28px 28px 22px;
}

.workbench-onboarding__main-header {
  display: grid;
  gap: 7px;
  padding-right: 28px;
}

.workbench-onboarding__main-header>span {
  color: color-mix(in srgb, var(--accent) 74%, var(--text, #111827));
  font-size: 0.74rem;
  font-weight: 760;
  line-height: 1;
}

.workbench-onboarding__main-header h3 {
  margin: 0;
  color: var(--text, #111827);
  font-size: 1.18rem;
  font-weight: 760;
  line-height: 1.18;
}

.workbench-onboarding__main-header p {
  max-width: 560px;
  margin: 0;
  color: var(--text-secondary, #64748b);
  font-size: 0.88rem;
  line-height: 1.55;
}

.workbench-onboarding__intent-grid,
.workbench-onboarding__map-grid,
.workbench-onboarding__finish-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  align-content: start;
}

.workbench-onboarding__template-step {
  display: grid;
  gap: 14px;
  align-content: start;
}

.workbench-onboarding__choice-card,
.workbench-onboarding__map-card,
.workbench-onboarding__finish-card {
  min-width: 0;
  border: 1px solid var(--panel-border, #dbe3ef);
  border-radius: 8px;
  background: color-mix(in srgb, var(--panel, #ffffff) 96%, #f8fafc);
  color: var(--text, #111827);
}

.workbench-onboarding__choice-card {
  cursor: pointer;
  text-align: left;
  transition: border-color 0.16s ease, background-color 0.16s ease, box-shadow 0.16s ease;
}

.workbench-onboarding__choice-card:hover {
  border-color: var(--panel-border, #dbe3ef);
  background: var(--panel-hover, #f5f7fa);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.09);
}

.workbench-onboarding__choice-card.is-selected {
  border-color: color-mix(in srgb, var(--accent) 58%, var(--panel-border, #dbe3ef));
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 11%, var(--panel, #ffffff)), var(--panel, #ffffff));
}

.workbench-onboarding__choice-card {
  min-height: 144px;
  display: grid;
  gap: 10px;
  align-content: start;
  padding: 14px;
}

.workbench-onboarding__choice-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.workbench-onboarding__choice-icon,
.workbench-onboarding__map-icon,
.workbench-onboarding__finish-icon {
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: 8px;
}

.workbench-onboarding__badge {
  max-width: 92px;
  overflow: hidden;
  padding: 3px 7px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent-hover);
  font-size: 0.68rem;
  font-weight: 760;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workbench-onboarding__choice-card strong,
.workbench-onboarding__map-card strong,
.workbench-onboarding__finish-card strong {
  color: var(--text, #111827);
  font-size: 0.94rem;
  font-weight: 720;
  line-height: 1.26;
}

.workbench-onboarding__choice-card>span:last-child,
.workbench-onboarding__map-card>span:last-child,
.workbench-onboarding__finish-card>span:last-child {
  color: var(--text-secondary, #64748b);
  font-size: 0.8rem;
  line-height: 1.45;
}

.workbench-onboarding__start-panel,
.workbench-onboarding__sync-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px;
  border: 1px solid color-mix(in srgb, var(--accent) 24%, var(--panel-border, #dbe3ef));
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent) 7%, transparent);
}

.workbench-onboarding__start-panel>div:first-child,
.workbench-onboarding__sync-panel>div:first-child {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.workbench-onboarding__start-panel strong,
.workbench-onboarding__sync-panel strong {
  color: var(--text, #111827);
  font-size: 0.88rem;
  font-weight: 720;
  line-height: 1.24;
}

.workbench-onboarding__start-panel span,
.workbench-onboarding__sync-panel span {
  color: var(--text-secondary, #64748b);
  font-size: 0.78rem;
  line-height: 1.38;
}

.workbench-onboarding__start-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.workbench-onboarding__primary-action,
.workbench-onboarding__secondary-action,
.workbench-onboarding__nav-button,
.workbench-onboarding__text-action {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 680;
  line-height: 1;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, opacity 0.16s ease;
}

.workbench-onboarding__nav-button--primary {
  border: 1px solid color-mix(in srgb, var(--accent) 78%, var(--accent-hover));
  background: color-mix(in srgb, var(--accent) 92%, var(--accent-hover));
  color: #ffffff;
}

.workbench-onboarding__primary-action {
  padding: 0 13px;
}

.workbench-onboarding__primary-action,
.workbench-onboarding__secondary-action,
.workbench-onboarding__nav-button {
  padding: 0 12px;
  border: 1px solid var(--panel-border, #dbe3ef);
  background: var(--panel, #ffffff);
  color: var(--text, #111827);
}

.workbench-onboarding__primary-action:hover,
.workbench-onboarding__secondary-action:hover,
.workbench-onboarding__nav-button:hover:not(:disabled) {
  border-color: var(--panel-border, #dbe3ef);
  background: var(--panel-hover, #f5f7fa);
  color: var(--text, #111827);
}

.workbench-onboarding__nav-button--primary:hover:not(:disabled) {
  border-color: var(--panel-border, #dbe3ef);
  background: var(--panel-hover, #f5f7fa);
  color: var(--text, #111827);
}

.workbench-onboarding__nav-button:disabled {
  cursor: default;
  opacity: 0.48;
}

.workbench-onboarding__map-card,
.workbench-onboarding__finish-card {
  min-height: 126px;
  display: grid;
  gap: 9px;
  align-content: start;
  padding: 14px;
}

.workbench-onboarding__sync-panel {
  grid-column: 1 / -1;
}

.workbench-onboarding__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding-top: 4px;
  border-top: 1px solid var(--panel-border, #dbe3ef);
}

.workbench-onboarding__text-action {
  padding: 0 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary, #64748b);
}

.workbench-onboarding__text-action:hover {
  color: var(--text, #111827);
}

.workbench-onboarding__nav {
  display: flex;
  gap: 8px;
}

.tone-primary {
  background: color-mix(in srgb, var(--accent) 13%, transparent);
  color: color-mix(in srgb, var(--accent) 86%, var(--text, #111827));
}

.tone-sky {
  background: color-mix(in srgb, var(--accent) 9%, var(--panel, #ffffff));
  color: var(--accent);
}

.tone-soft {
  background: color-mix(in srgb, var(--accent) 6%, var(--panel, #ffffff));
  color: color-mix(in srgb, var(--accent) 80%, var(--text, #111827));
}

.tone-deep {
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  color: var(--accent-hover);
}

:global([data-theme='dark']) .workbench-onboarding__dialog {
  border-color: rgba(148, 163, 184, 0.18);
  background: #191f2d;
  box-shadow: 0 26px 76px rgba(0, 0, 0, 0.48);
}

:global([data-theme='dark']) .workbench-onboarding__rail {
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--accent) 15%, transparent), transparent 54%),
    #171d2a;
  border-right-color: rgba(148, 163, 184, 0.16);
}

:global([data-theme='dark']) .workbench-onboarding__choice-card,
:global([data-theme='dark']) .workbench-onboarding__map-card,
:global([data-theme='dark']) .workbench-onboarding__finish-card,
:global([data-theme='dark']) .workbench-onboarding__secondary-action,
:global([data-theme='dark']) .workbench-onboarding__nav-button,
:global([data-theme='dark']) .workbench-onboarding__choice-card.is-selected {
  background: color-mix(in srgb, var(--accent) 13%, transparent);
}

:global([data-theme='dark']) .workbench-onboarding__choice-card:hover {
  background: var(--panel-hover, #252932);
}

@media (max-width: 760px) {
  .workbench-onboarding {
    align-items: flex-end;
    padding: 12px;
  }

  .workbench-onboarding__dialog {
    width: 100%;
    max-height: calc(100vh - 24px);
    grid-template-columns: minmax(0, 1fr);
    overflow: auto;
  }

  .workbench-onboarding__rail {
    padding: 20px;
    border-right: none;
    border-bottom: 1px solid var(--panel-border, #dbe3ef);
  }

  .workbench-onboarding__steps {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .workbench-onboarding__step {
    grid-template-columns: minmax(0, 1fr);
    justify-items: center;
    text-align: center;
  }

  .workbench-onboarding__step-copy span {
    display: none;
  }

  .workbench-onboarding__main {
    min-height: auto;
    max-height: none;
    padding: 20px;
  }

  .workbench-onboarding__intent-grid,
  .workbench-onboarding__map-grid,
  .workbench-onboarding__finish-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .workbench-onboarding__start-panel,
  .workbench-onboarding__sync-panel,
  .workbench-onboarding__footer {
    align-items: stretch;
    flex-direction: column;
  }

  .workbench-onboarding__start-actions,
  .workbench-onboarding__nav {
    justify-content: stretch;
  }

  .workbench-onboarding__primary-action,
  .workbench-onboarding__secondary-action,
  .workbench-onboarding__nav-button {
    flex: 1;
  }
}
</style>
