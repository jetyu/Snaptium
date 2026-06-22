const RAG_STRICT_EVIDENCE_THRESHOLD = 0.58;
const RAG_AVERAGE_EVIDENCE_THRESHOLD = 0.5;
const RAG_AVERAGE_EVIDENCE_WINDOW = 3;

export interface RagEvidenceScoreLike {
  score: number;
}

export interface RagEvidenceAssessment {
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

export function assessRagEvidence(results: RagEvidenceScoreLike[]): RagEvidenceAssessment {
  if (!results.length) {
    return {
      sufficient: false,
      strictThreshold: RAG_STRICT_EVIDENCE_THRESHOLD,
      averageThreshold: RAG_AVERAGE_EVIDENCE_THRESHOLD,
      averageWindow: RAG_AVERAGE_EVIDENCE_WINDOW,
      highestScore: 0,
      averageScore: 0,
      consideredCount: 0,
    };
  }

  const highestScore = normalizeScore(results[0]?.score ?? 0);
  const consideredResults = results.slice(0, Math.min(RAG_AVERAGE_EVIDENCE_WINDOW, results.length));
  const consideredCount = consideredResults.length;
  const averageScore = consideredCount > 0
    ? consideredResults.reduce((sum, result) => sum + normalizeScore(result.score), 0) / consideredCount
    : 0;
  const sufficient = highestScore >= RAG_STRICT_EVIDENCE_THRESHOLD
    || averageScore >= RAG_AVERAGE_EVIDENCE_THRESHOLD;

  return {
    sufficient,
    strictThreshold: RAG_STRICT_EVIDENCE_THRESHOLD,
    averageThreshold: RAG_AVERAGE_EVIDENCE_THRESHOLD,
    averageWindow: RAG_AVERAGE_EVIDENCE_WINDOW,
    highestScore,
    averageScore,
    consideredCount,
  };
}
