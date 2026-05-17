import { computed, type ComputedRef, type Ref } from 'vue';
import type { Note } from '@renderer/features/workspace';

export interface KnowledgeTopicCluster {
  id: string;
  label: string;
  noteIds: string[];
  noteCount: number;
  heat: number;
  percent: number;
  updatedAt: number;
  keywords: string[];
}

interface UseKnowledgeTopicClustersParams {
  notes: Readonly<Ref<Note[]>>;
  limit?: number;
}

interface UseKnowledgeTopicClustersResult {
  topicClusters: ComputedRef<KnowledgeTopicCluster[]>;
  clusterSource: 'local';
}

interface NoteTopicProfile {
  note: Note;
  vector: Map<string, number>;
  magnitude: number;
}

interface TopicNoteSignal {
  profile: NoteTopicProfile;
  score: number;
}

interface TopicCandidate {
  token: string;
  noteIds: string[];
  noteCount: number;
  updatedAt: number;
  heat: number;
  keywords: string[];
}

const DEFAULT_TOPIC_LIMIT = 5;
const MAX_TOKENS_PER_NOTE = 240;
const MIN_TOPIC_NOTE_COUNT = 2;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const STOP_WORDS = new Set<string>([
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
  'fixme'
]);

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

function isTopicToken(token: string): boolean {
  if (token.length < 2 || STOP_WORDS.has(token) || /^\d+$/.test(token)) {
    return false;
  }

  return /[\p{L}\u4E00-\u9FFF]/u.test(token);
}

function pushToken(tokens: string[], token: string): void {
  const normalizedToken = token.trim().toLowerCase();
  if (!isTopicToken(normalizedToken)) {
    return;
  }

  tokens.push(normalizedToken);
}

function tokenizeChinesePhrase(tokens: string[], phrase: string): void {
  if (phrase.length <= 8) {
    pushToken(tokens, phrase);
  }

  const maxGramSize = Math.min(4, phrase.length);
  for (let gramSize = 2; gramSize <= maxGramSize; gramSize += 1) {
    if (gramSize === phrase.length && phrase.length <= 8) {
      continue;
    }

    for (let index = 0; index <= phrase.length - gramSize; index += 1) {
      pushToken(tokens, phrase.slice(index, index + gramSize));
    }
  }
}

function tokenizeText(text: string): string[] {
  const tokens: string[] = [];
  const normalizedText = normalizeMarkdownText(text).toLowerCase();

  for (const match of normalizedText.matchAll(/[a-z0-9][a-z0-9_-]{1,}/g)) {
    pushToken(tokens, match[0]);
  }

  for (const match of normalizedText.matchAll(/[\u4E00-\u9FFF]{2,}/g)) {
    tokenizeChinesePhrase(tokens, match[0]);
  }

  return tokens.slice(0, MAX_TOKENS_PER_NOTE);
}

function addTokenWeight(vector: Map<string, number>, token: string, weight: number): void {
  vector.set(token, (vector.get(token) ?? 0) + weight);
}

function buildRawVector(note: Note): Map<string, number> {
  const vector = new Map<string, number>();
  for (const token of tokenizeText(note.title)) {
    addTokenWeight(vector, token, 3.2);
  }
  for (const token of tokenizeText(extractHeadings(note.content))) {
    addTokenWeight(vector, token, 2.2);
  }
  for (const token of tokenizeText(note.content)) {
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

function buildProfiles(notes: Note[]): NoteTopicProfile[] {
  const rawVectors = notes.map((note) => buildRawVector(note));
  const idfMap = buildIdfMap(rawVectors, notes.length);

  return notes.map((note, index) => {
    const vector = applyIdf(rawVectors[index], idfMap);
    return {
      note,
      vector,
      magnitude: getMagnitude(vector),
    };
  });
}

function getRecencyWeight(updatedAt: number): number {
  const ageDays = Math.max(0, Math.floor((Date.now() - updatedAt) / DAY_IN_MS));
  if (ageDays <= 1) {
    return 1;
  }
  if (ageDays <= 7) {
    return 0.74;
  }
  if (ageDays <= 30) {
    return 0.42;
  }
  return 0.18;
}

function getNoteSignalScore(profile: NoteTopicProfile, tokenScore: number): number {
  const normalizedScore = profile.magnitude === 0 ? tokenScore : (tokenScore / profile.magnitude) * 100;
  return Math.min(8, Math.log1p(normalizedScore));
}

function getCandidateKeywords(token: string, noteSignals: TopicNoteSignal[]): string[] {
  const keywordScores = new Map<string, number>();
  for (const { profile } of noteSignals) {
    for (const [keyword, score] of profile.vector) {
      if (keyword === token || !isTopicToken(keyword)) {
        continue;
      }

      keywordScores.set(keyword, (keywordScores.get(keyword) ?? 0) + Math.log1p(score));
    }
  }

  return [
    token,
    ...[...keywordScores.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3)
      .map(([keyword]) => keyword),
  ];
}

function getCandidateHeat(noteSignals: TopicNoteSignal[]): number {
  const noteCountScore = noteSignals.length * 12;
  const recencyScore = noteSignals.reduce((total, { profile }) => {
    return total + getRecencyWeight(profile.note.updatedAt) * 4;
  }, 0);
  const starredScore = noteSignals.reduce((total, { profile }) => {
    return total + (profile.note.starred ? 4 : 0);
  }, 0);
  const signalScore = Math.min(12, noteSignals.reduce((total, entry) => total + entry.score, 0) * 1.6);

  return noteCountScore + recencyScore + starredScore + signalScore;
}

function buildTopicCandidates(profiles: NoteTopicProfile[]): TopicCandidate[] {
  const tokenSignals = new Map<string, TopicNoteSignal[]>();

  for (const profile of profiles) {
    for (const [token, tokenScore] of profile.vector) {
      if (!isTopicToken(token)) {
        continue;
      }

      const noteSignals = tokenSignals.get(token) ?? [];
      noteSignals.push({
        profile,
        score: getNoteSignalScore(profile, tokenScore),
      });
      tokenSignals.set(token, noteSignals);
    }
  }

  const candidates: TopicCandidate[] = [];
  for (const [token, noteSignals] of tokenSignals) {
    if (noteSignals.length < MIN_TOPIC_NOTE_COUNT) {
      continue;
    }

    const sortedSignals = [...noteSignals].sort((left, right) => right.profile.note.updatedAt - left.profile.note.updatedAt);
    const noteIds = sortedSignals.map(({ profile }) => profile.note.id);
    const heat = getCandidateHeat(sortedSignals);
    candidates.push({
      token,
      noteIds,
      noteCount: sortedSignals.length,
      updatedAt: sortedSignals[0]?.profile.note.updatedAt ?? 0,
      heat,
      keywords: getCandidateKeywords(token, sortedSignals),
    });
  }

  return candidates;
}

function getOverlapRatio(leftIds: string[], rightIds: string[]): number {
  const rightSet = new Set(rightIds);
  const overlap = leftIds.filter((id) => rightSet.has(id)).length;
  return overlap / Math.max(1, Math.min(leftIds.length, rightIds.length));
}

function isRedundantCandidate(candidate: TopicCandidate, selected: TopicCandidate): boolean {
  const hasContainedLabel = selected.token.includes(candidate.token) || candidate.token.includes(selected.token);
  if (!hasContainedLabel) {
    return false;
  }

  return getOverlapRatio(candidate.noteIds, selected.noteIds) >= 0.75;
}

function sortTopicCandidates(candidates: TopicCandidate[]): TopicCandidate[] {
  return [...candidates].sort((left, right) => {
    if (right.noteCount !== left.noteCount) {
      return right.noteCount - left.noteCount;
    }
    if (right.heat !== left.heat) {
      return right.heat - left.heat;
    }
    if (right.token.length !== left.token.length) {
      return right.token.length - left.token.length;
    }
    return right.updatedAt - left.updatedAt;
  });
}

function selectTopicCandidates(candidates: TopicCandidate[], limit: number): TopicCandidate[] {
  const selected: TopicCandidate[] = [];

  for (const candidate of sortTopicCandidates(candidates)) {
    if (selected.some((entry) => isRedundantCandidate(candidate, entry))) {
      continue;
    }

    selected.push(candidate);
    if (selected.length >= limit) {
      break;
    }
  }

  return selected;
}

function toKnowledgeTopicClusters(candidates: TopicCandidate[], limit: number): KnowledgeTopicCluster[] {
  const selectedCandidates = selectTopicCandidates(candidates, limit);
  const maxHeat = Math.max(1, ...selectedCandidates.map((entry) => entry.heat));

  return selectedCandidates.map((candidate) => ({
    id: candidate.token,
    label: candidate.token,
    noteIds: candidate.noteIds,
    noteCount: candidate.noteCount,
    heat: candidate.heat,
    percent: Math.max(8, Math.round((candidate.heat / maxHeat) * 100)),
    updatedAt: candidate.updatedAt,
    keywords: candidate.keywords,
  }));
}

export function useKnowledgeTopicClusters(params: UseKnowledgeTopicClustersParams): UseKnowledgeTopicClustersResult {
  const topicClusters = computed<KnowledgeTopicCluster[]>(() => {
    const notes = params.notes.value.filter((note) => {
      return note.title.trim().length > 0 || note.content.trim().length > 0;
    });

    if (notes.length < MIN_TOPIC_NOTE_COUNT) {
      return [];
    }

    const limit = Math.max(1, params.limit ?? DEFAULT_TOPIC_LIMIT);
    const profiles = buildProfiles(notes).filter((profile) => profile.magnitude > 0);
    if (profiles.length < MIN_TOPIC_NOTE_COUNT) {
      return [];
    }

    return toKnowledgeTopicClusters(buildTopicCandidates(profiles), limit);
  });

  return {
    topicClusters,
    clusterSource: 'local',
  };
}
