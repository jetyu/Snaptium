import { computed, type ComputedRef } from 'vue';
import type { Note } from '@renderer/features/workspace';

export type LocalRecommendationReasonType =
  | 'recent_focus'
  | 'semantic_related'
  | 'long_gap'
  | 'draft_signal'
  | 'same_notebook'
  | 'review';

export interface LocalSmartRecommendationItem {
  note: Note;
  reasonType: LocalRecommendationReasonType;
  reasonKey: string;
  score: number;
}

interface UseLocalSmartRecommendationsParams {
  notes: ComputedRef<Note[]>;
  limit?: number;
}

interface NoteProfile {
  note: Note;
  vector: Map<string, number>;
  magnitude: number;
  draftScore: number;
  daysSinceUpdate: number;
  recentOpenScore: number;
  sameNotebookScore: number;
  topicScore: number;
  score: number;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LIMIT = 4;
const LONG_GAP_DAYS = 45;
const RECENT_WINDOW_DAYS = 14;
const MAX_KEYWORDS_PER_NOTE = 120;
const SYNTAX_DEMO_CONTEXT_REGEX = /(?:markdown|syntax|example|demo|template|sample|cheatsheet|reference|\u8bed\u6cd5|\u793a\u4f8b|\u6f14\u793a|\u683c\u5f0f|\u6a21\u677f|\u53c2\u8003)/i;

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'this',
  'that',
  'from',
  'have',
  'will',
  'todo',
  'tbd',
  'fixme',
  '一个',
  '一些',
  '这个',
  '那个',
  '因为',
  '所以',
  '但是',
  '以及',
  '如果',
  '我们',
  '你们',
  '他们',
  '可以',
  '需要',
  '进行',
  '关于',
]);

function getDaysSince(timestamp: number): number {
  return Math.max(0, Math.floor((Date.now() - timestamp) / DAY_IN_MS));
}

function normalizeMarkdownText(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[[^\]]+\]\([^)]+\)/g, ' ')
    .replace(/^#+\s+/gm, ' ')
    .replace(/[-*+]\s+\[[ xX]\]\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\u4E00-\u9FFF]+/gu, ' ')
    .trim();
}

function extractHeadings(content: string): string {
  return content
    .split('\n')
    .filter((line) => /^#{1,4}\s+/.test(line.trim()))
    .map((line) => line.replace(/^#{1,4}\s+/, '').trim())
    .join(' ');
}

function pushToken(tokens: string[], token: string): void {
  const normalizedToken = token.trim().toLowerCase();
  if (normalizedToken.length < 2 || STOP_WORDS.has(normalizedToken)) {
    return;
  }

  tokens.push(normalizedToken);
}

function tokenizeText(text: string): string[] {
  const tokens: string[] = [];
  const normalizedText = normalizeMarkdownText(text).toLowerCase();

  for (const match of normalizedText.matchAll(/[a-z0-9][a-z0-9_-]{1,}/g)) {
    pushToken(tokens, match[0]);
  }

  for (const match of normalizedText.matchAll(/[\u4E00-\u9FFF]{2,}/g)) {
    const phrase = match[0];
    if (phrase.length <= 4) {
      pushToken(tokens, phrase);
    }

    for (let index = 0; index < phrase.length - 1; index += 1) {
      pushToken(tokens, phrase.slice(index, index + 2));
    }

    for (let index = 0; index < phrase.length - 2; index += 1) {
      pushToken(tokens, phrase.slice(index, index + 3));
    }
  }

  return tokens.slice(0, MAX_KEYWORDS_PER_NOTE);
}

function addTokenWeight(vector: Map<string, number>, token: string, weight: number): void {
  vector.set(token, (vector.get(token) ?? 0) + weight);
}

function buildRawVector(note: Note): Map<string, number> {
  const vector = new Map<string, number>();
  const titleTokens = tokenizeText(note.title);
  const headingTokens = tokenizeText(extractHeadings(note.content));
  const contentTokens = tokenizeText(note.content);

  for (const token of titleTokens) {
    addTokenWeight(vector, token, 3);
  }

  for (const token of headingTokens) {
    addTokenWeight(vector, token, 2);
  }

  for (const token of contentTokens) {
    addTokenWeight(vector, token, 1);
  }

  return vector;
}

function buildIdfMap(rawVectors: Map<string, number>[], totalNotes: number): Map<string, number> {
  const documentFrequency = new Map<string, number>();

  for (const vector of rawVectors) {
    for (const token of vector.keys()) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }

  const idfMap = new Map<string, number>();
  for (const [token, count] of documentFrequency) {
    idfMap.set(token, Math.log((1 + totalNotes) / (1 + count)) + 1);
  }

  return idfMap;
}

function applyIdf(rawVector: Map<string, number>, idfMap: Map<string, number>): Map<string, number> {
  const vector = new Map<string, number>();
  for (const [token, weight] of rawVector) {
    vector.set(token, weight * (idfMap.get(token) ?? 1));
  }

  return vector;
}

function getMagnitude(vector: Map<string, number>): number {
  let total = 0;
  for (const weight of vector.values()) {
    total += weight * weight;
  }

  return Math.sqrt(total);
}

function getCosineSimilarity(left: NoteProfile, right: NoteProfile): number {
  if (left.magnitude === 0 || right.magnitude === 0) {
    return 0;
  }

  let dotProduct = 0;
  const [smaller, larger] = left.vector.size < right.vector.size
    ? [left.vector, right.vector]
    : [right.vector, left.vector];

  for (const [token, weight] of smaller) {
    dotProduct += weight * (larger.get(token) ?? 0);
  }

  return dotProduct / (left.magnitude * right.magnitude);
}

function stripCodeRegions(content: string): string {
  const lines = content.split('\n');
  const visibleLines: string[] = [];
  let isInFence = false;

  for (const line of lines) {
    if (/^\s*(?:```|~~~)/.test(line)) {
      isInFence = !isInFence;
      continue;
    }

    if (!isInFence) {
      visibleLines.push(line.replace(/`[^`]*`/g, ' '));
    }
  }

  return visibleLines.join('\n');
}

function isSyntaxDemoNote(note: Note, visibleContent: string): boolean {
  const context = `${note.title}\n${extractHeadings(visibleContent)}`;
  return SYNTAX_DEMO_CONTEXT_REGEX.test(context);
}

function hasRealDraftMarker(visibleContent: string): boolean {
  return visibleContent.split('\n').some((line) => {
    const normalizedLine = line.trim();
    return /^(?:[-*+]\s+)?(?:TODO|TBD|FIXME)\b\s*[:：-]?/i.test(normalizedLine)
      || /^[-*+]\s+\[\s\]\s+\S/.test(normalizedLine);
  });
}

function getDraftScore(note: Note): number {
  const content = note.content.trim();
  if (!content) {
    return 1;
  }

  const visibleContent = stripCodeRegions(content);
  if (!isSyntaxDemoNote(note, visibleContent) && hasRealDraftMarker(visibleContent)) {
    return 1;
  }

  return 0;
}

function getRecentOpenScore(daysSinceUpdate: number): number {
  if (daysSinceUpdate <= 1) {
    return 1;
  }

  if (daysSinceUpdate <= 3) {
    return 0.82;
  }

  if (daysSinceUpdate <= 7) {
    return 0.64;
  }

  if (daysSinceUpdate <= 14) {
    return 0.42;
  }

  return 0;
}

function getSameNotebookScore(note: Note, focusProfiles: NoteProfile[]): number {
  if (!note.parentId) {
    return 0;
  }

  const hasRecentSibling = focusProfiles.some((profile) => {
    return profile.note.id !== note.id && profile.note.parentId === note.parentId;
  });

  return hasRecentSibling ? 0.7 : 0;
}

function getFocusProfiles(profiles: NoteProfile[]): NoteProfile[] {
  return [...profiles]
    .sort((left, right) => right.note.updatedAt - left.note.updatedAt)
    .slice(0, 3);
}

function getTopicScore(profile: NoteProfile, focusProfiles: NoteProfile[]): number {
  return focusProfiles.reduce((maxScore, focusProfile) => {
    if (focusProfile.note.id === profile.note.id) {
      return Math.max(maxScore, 0.45);
    }

    return Math.max(maxScore, getCosineSimilarity(profile, focusProfile));
  }, 0);
}

function getLongGapScore(daysSinceUpdate: number, recentOpenScore: number): number {
  if (recentOpenScore > 0 || daysSinceUpdate < LONG_GAP_DAYS) {
    return 0;
  }

  return Math.min(1, daysSinceUpdate / 180);
}

function getFreshnessScore(daysSinceUpdate: number): number {
  if (daysSinceUpdate > RECENT_WINDOW_DAYS) {
    return 0;
  }

  return Math.max(0, 1 - daysSinceUpdate / RECENT_WINDOW_DAYS);
}

function getReasonType(profile: NoteProfile): LocalRecommendationReasonType {
  if (profile.draftScore >= 0.65) {
    return 'draft_signal';
  }

  if (profile.topicScore >= 0.22) {
    return 'semantic_related';
  }

  if (getLongGapScore(profile.daysSinceUpdate, profile.recentOpenScore) > 0) {
    return 'long_gap';
  }

  if (profile.recentOpenScore >= 0.45) {
    return 'recent_focus';
  }

  if (profile.sameNotebookScore > 0) {
    return 'same_notebook';
  }

  return 'review';
}

function getReasonKey(reasonType: LocalRecommendationReasonType): string {
  const reasonKeyMap: Record<LocalRecommendationReasonType, string> = {
    recent_focus: 'workbench.recommendation.reason.recentFocus',
    semantic_related: 'workbench.recommendation.reason.semanticRelated',
    long_gap: 'workbench.recommendation.reason.longGap',
    draft_signal: 'workbench.recommendation.reason.draftSignal',
    same_notebook: 'workbench.recommendation.reason.sameNotebook',
    review: 'workbench.recommendation.reason.review',
  };

  return reasonKeyMap[reasonType];
}

function calculateProfileScore(profile: NoteProfile): number {
  const longGapScore = getLongGapScore(profile.daysSinceUpdate, profile.recentOpenScore);
  const freshnessScore = getFreshnessScore(profile.daysSinceUpdate);

  return profile.topicScore * 0.34
    + profile.recentOpenScore * 0.24
    + freshnessScore * 0.13
    + profile.draftScore * 0.17
    + longGapScore * 0.08
    + profile.sameNotebookScore * 0.04;
}

function applyDiversity(
  profiles: NoteProfile[],
  limit: number,
): NoteProfile[] {
  const selectedProfiles: NoteProfile[] = [];
  const parentCountMap = new Map<string, number>();

  for (const profile of profiles) {
    const parentKey = profile.note.parentId ?? 'root';
    const parentCount = parentCountMap.get(parentKey) ?? 0;
    if (parentCount >= 2 && selectedProfiles.length >= Math.min(limit - 1, 1)) {
      continue;
    }

    selectedProfiles.push(profile);
    parentCountMap.set(parentKey, parentCount + 1);

    if (selectedProfiles.length >= limit) {
      break;
    }
  }

  if (selectedProfiles.length >= limit) {
    return selectedProfiles;
  }

  for (const profile of profiles) {
    if (selectedProfiles.some((selectedProfile) => selectedProfile.note.id === profile.note.id)) {
      continue;
    }

    selectedProfiles.push(profile);
    if (selectedProfiles.length >= limit) {
      break;
    }
  }

  return selectedProfiles;
}

function buildProfiles(notes: Note[]): NoteProfile[] {
  const rawVectors = notes.map((note) => buildRawVector(note));
  const idfMap = buildIdfMap(rawVectors, notes.length);

  const profiles = notes.map((note, index) => {
    const vector = applyIdf(rawVectors[index], idfMap);
    const daysSinceUpdate = getDaysSince(note.updatedAt);

    return {
      note,
      vector,
      magnitude: getMagnitude(vector),
      draftScore: getDraftScore(note),
      daysSinceUpdate,
      recentOpenScore: getRecentOpenScore(daysSinceUpdate),
      sameNotebookScore: 0,
      topicScore: 0,
      score: 0,
    };
  });

  const focusProfiles = getFocusProfiles(profiles);
  return profiles.map((profile) => {
    const topicScore = getTopicScore(profile, focusProfiles);
    const sameNotebookScore = getSameNotebookScore(profile.note, focusProfiles);
    const nextProfile = {
      ...profile,
      topicScore,
      sameNotebookScore,
      score: 0,
    };

    return {
      ...nextProfile,
      score: calculateProfileScore(nextProfile),
    };
  });
}

export function useLocalSmartRecommendations(params: UseLocalSmartRecommendationsParams) {
  const smartRecommendations = computed<LocalSmartRecommendationItem[]>(() => {
    const notes = params.notes.value;
    if (notes.length === 0) {
      return [];
    }

    const limit = params.limit ?? DEFAULT_LIMIT;
    const profiles = buildProfiles(notes)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return right.note.updatedAt - left.note.updatedAt;
      });

    return applyDiversity(profiles, Math.min(limit, notes.length)).map((profile) => {
      const reasonType = getReasonType(profile);
      return {
        note: profile.note,
        reasonType,
        reasonKey: getReasonKey(reasonType),
        score: profile.score,
      };
    });
  });

  return {
    smartRecommendations,
  };
}
