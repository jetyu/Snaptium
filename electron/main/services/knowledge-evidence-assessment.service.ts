const KNOWLEDGE_STRICT_EVIDENCE_THRESHOLD = 0.58;
const KNOWLEDGE_AVERAGE_EVIDENCE_THRESHOLD = 0.5;
const KNOWLEDGE_AVERAGE_EVIDENCE_WINDOW = 3;

export interface KnowledgeEvidenceScoreLike {
  score: number;
}

export interface KnowledgeEvidenceAssessment {
  sufficient: boolean;
  strictThreshold: number;
  averageThreshold: number;
  averageWindow: number;
  highestScore: number;
  averageScore: number;
  consideredCount: number;
}

function normalizeScore(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function assessKnowledgeEvidence(results: KnowledgeEvidenceScoreLike[]): KnowledgeEvidenceAssessment {
  if (!results.length) {
    return {
      sufficient: false,
      strictThreshold: KNOWLEDGE_STRICT_EVIDENCE_THRESHOLD,
      averageThreshold: KNOWLEDGE_AVERAGE_EVIDENCE_THRESHOLD,
      averageWindow: KNOWLEDGE_AVERAGE_EVIDENCE_WINDOW,
      highestScore: 0,
      averageScore: 0,
      consideredCount: 0,
    };
  }

  const highestScore = normalizeScore(results[0]?.score ?? 0);
  const consideredResults = results.slice(0, Math.min(KNOWLEDGE_AVERAGE_EVIDENCE_WINDOW, results.length));
  const consideredCount = consideredResults.length;
  const averageScore = consideredCount > 0
    ? consideredResults.reduce((sum, result) => sum + normalizeScore(result.score), 0) / consideredCount
    : 0;
  const sufficient = highestScore >= KNOWLEDGE_STRICT_EVIDENCE_THRESHOLD
    || averageScore >= KNOWLEDGE_AVERAGE_EVIDENCE_THRESHOLD;

  return {
    sufficient,
    strictThreshold: KNOWLEDGE_STRICT_EVIDENCE_THRESHOLD,
    averageThreshold: KNOWLEDGE_AVERAGE_EVIDENCE_THRESHOLD,
    averageWindow: KNOWLEDGE_AVERAGE_EVIDENCE_WINDOW,
    highestScore,
    averageScore,
    consideredCount,
  };
}
