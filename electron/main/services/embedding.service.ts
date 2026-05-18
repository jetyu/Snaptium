import { remoteAiService } from './remote-ai.service.js';
import { loggerService } from './logger.service.js';
import { getErrorMessage } from '../services/error.service.js';

const logger = loggerService.createLogger('Electron:Embedding Service');

interface EmbeddingConfig {
  endpoint: string;
  apiKey: string;
  model: string;
}

interface EmbeddingApiItem {
  embedding?: unknown;
}

interface EmbeddingApiResponse {
  data?: EmbeddingApiItem[];
}

function normalizeEmbedding(embedding: number[]): number[] {
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error('Invalid embedding vector');
  }

  const magnitude = Math.sqrt(embedding.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(magnitude) || magnitude === 0) {
    throw new Error('Invalid embedding magnitude');
  }

  return embedding.map((value) => value / magnitude);
}

function toNumericEmbedding(value: unknown): number[] {
  if (!Array.isArray(value)) {
    throw new Error('Embedding item is not an array');
  }

  const embedding = value.map((item) => Number(item));
  if (!embedding.every((item) => Number.isFinite(item))) {
    throw new Error('Embedding contains non-numeric values');
  }

  return embedding;
}

export async function generateEmbeddings(
  texts: string[],
  config: EmbeddingConfig,
): Promise<number[][]> {
  const { endpoint, apiKey, model } = config;

  if (!endpoint || !apiKey || !model) {
    throw new Error('Missing embedding configuration');
  }

  if (texts.length === 0) {
    return [];
  }

  try {
    const data = await remoteAiService.embed({
      endpoint,
      apiKey,
      model,
      input: texts,
    }) as EmbeddingApiResponse;

    if (!Array.isArray(data.data)) {
      logger.error('Invalid response format received from embedding endpoint', {
        hasData: Boolean(data?.data),
      });
      throw new Error('Invalid embedding response format');
    }

    return data.data.map((item) => normalizeEmbedding(toNumericEmbedding(item.embedding)));
  } catch (error) {
    logger.error('Failed to generate embeddings', { error: getErrorMessage(error) });
    throw error;
  }
}

export async function generateEmbeddingSingle(
  text: string,
  config: EmbeddingConfig,
): Promise<number[]> {
  const embeddings = await generateEmbeddings([text], config);
  const [firstEmbedding] = embeddings;

  if (!firstEmbedding) {
    throw new Error('No embedding generated for input text');
  }

  logger.debug('Single embedding generated', {
    vectorLength: firstEmbedding.length,
  });
  return firstEmbedding;
}

export async function generateEmbeddingsBatch(
  texts: string[],
  config: EmbeddingConfig,
  batchSize = 100,
): Promise<number[][]> {
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const embeddings = await generateEmbeddings(batch, config);
    results.push(...embeddings);

    if (i + batchSize < texts.length) {
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
}
