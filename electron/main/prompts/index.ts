import type { AiPromptPreset, AiWritingScenario, AiWritingStyle } from '../../shared/ai.constants.js';
import type { PromptLanguageContext, PromptTemplateLanguage } from './language.js';
import { buildAgentPromptEnUs } from './agent/en-US.js';
import { buildAgentPromptZhCn } from './agent/zh-CN.js';
import { buildKnowledgeAnswerPromptEnUs } from './knowledge-agent/en-US.js';
import { buildKnowledgeAnswerPromptZhCn } from './knowledge-agent/zh-CN.js';
import { buildAssistantPromptEnUs } from './assistant/en-US.js';
import { buildAssistantPromptZhCn } from './assistant/zh-CN.js';
import { buildEditorPromptEnUs } from './editor/en-US.js';
import { buildEditorPromptZhCn } from './editor/zh-CN.js';
import { resolvePromptLanguage } from './language.js';

export interface AgentPromptContext extends PromptLanguageContext {
  writeMode: 'confirm' | 'auto';
}

export interface KnowledgeAnswerPromptContext extends PromptLanguageContext {
  contextText: string;
}

export interface AssistantPromptContext extends PromptLanguageContext {
  writingStyle: AiWritingStyle;
  writingScenario: AiWritingScenario;
}

export interface EditorPromptContext extends PromptLanguageContext {
  preset: AiPromptPreset;
}

function chooseBuilder<TContext>(
  language: PromptTemplateLanguage,
  zhBuilder: (context: TContext) => string,
  enBuilder: (context: TContext) => string,
): (context: TContext) => string {
  return language === 'zh-CN' ? zhBuilder : enBuilder;
}

export function buildAgentSystemPrompt(writeMode: 'confirm' | 'auto', uiLanguage: string, inputText: string): string {
  const language = resolvePromptLanguage(uiLanguage, inputText);
  const builder = chooseBuilder(language.effectiveLanguage, buildAgentPromptZhCn, buildAgentPromptEnUs);
  const context: AgentPromptContext = {
    writeMode,
    uiLanguage: language.uiLanguage,
    inputLanguage: language.inputLanguage,
    fallbackLanguage: language.fallbackLanguage,
  };

  return builder(context);
}

export function buildKnowledgeAnswerPrompt(uiLanguage: string, inputText: string, contextText: string): string {
  const language = resolvePromptLanguage(uiLanguage, inputText);
  const builder = chooseBuilder(language.effectiveLanguage, buildKnowledgeAnswerPromptZhCn, buildKnowledgeAnswerPromptEnUs);
  const context: KnowledgeAnswerPromptContext = {
    uiLanguage: language.uiLanguage,
    inputLanguage: language.inputLanguage,
    fallbackLanguage: language.fallbackLanguage,
    contextText,
  };

  return builder(context);
}

export function buildAssistantSystemPrompt(
  uiLanguage: string,
  inputText: string,
  writingStyle: AssistantPromptContext['writingStyle'],
  writingScenario: AssistantPromptContext['writingScenario'],
): string {
  const language = resolvePromptLanguage(uiLanguage, inputText);
  const builder = chooseBuilder(language.effectiveLanguage, buildAssistantPromptZhCn, buildAssistantPromptEnUs);
  const context: AssistantPromptContext = {
    uiLanguage: language.uiLanguage,
    inputLanguage: language.inputLanguage,
    fallbackLanguage: language.fallbackLanguage,
    writingStyle,
    writingScenario,
  };

  return builder(context);
}

export function buildEditorSystemPrompt(
  uiLanguage: string,
  inputText: string,
  preset: EditorPromptContext['preset'],
): string {
  const language = resolvePromptLanguage(uiLanguage, inputText);
  const builder = chooseBuilder(language.effectiveLanguage, buildEditorPromptZhCn, buildEditorPromptEnUs);
  const context: EditorPromptContext = {
    uiLanguage: language.uiLanguage,
    inputLanguage: language.inputLanguage,
    fallbackLanguage: language.fallbackLanguage,
    preset,
  };

  return builder(context);
}
