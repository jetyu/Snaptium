import { remoteAiService } from './remote-ai.service.js';
import { loggerService } from './logger.service.js';

const logger = loggerService.createLogger('Electron:Embedding Service');

function normalizeEmbedding(embedding) {
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error('Invalid embedding vector');
  }

  const magnitude = Math.sqrt(embedding.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(magnitude) || magnitude === 0) {
    throw new Error('Invalid embedding magnitude');
  }

  return embedding.map(value => value / magnitude);
}

/**
 * Generate embeddings for text chunks
 * @param {Array<string>} texts - Array of text strings to embed
 * @param {Object} config - Embedding configuration
 * @param {string} config.endpoint - API endpoint
 * @param {string} config.apiKey - API key
 * @param {string} config.model - Model name
 * @returns {Promise<Array<Array<number>>>} Array of embedding vectors
 */
export async function generateEmbeddings(texts, config) {
  const { endpoint, apiKey, model } = config;

  if (!endpoint || !apiKey || !model) {
    throw new Error('Missing embedding configuration');
  }

  if (!texts || texts.length === 0) {
    return [];
  }

  try {
    const data = await remoteAiService.embed({
      endpoint,
      apiKey,
      model,
      input: texts,
    });

    if (!data.data || !Array.isArray(data.data)) {
      logger.error('Invalid response format received from embedding endpoint', {
        hasData: Boolean(data?.data),
      });
      throw new Error('Invalid embedding response format');
    }

    const embeddings = data.data.map(item => normalizeEmbedding(item.embedding));
    return embeddings;
  } catch (error) {
    logger.error('Failed to generate embeddings', { error: error.message });
    throw error;
  }
}

/**
 * Generate a single embedding for a string
 */
export async function generateEmbeddingSingle(text, config) {
  const embeddings = await generateEmbeddings([text], config);
  logger.debug('Single embedding generated', {
    vectorLength: Array.isArray(embeddings[0]) ? embeddings[0].length : 0,
  });
  return embeddings[0];
}

/**
 * Generate embeddings in batches to avoid token limits or request size limits
 */
export async function generateEmbeddingsBatch(texts, config, batchSize = 100) {
  const results = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const embeddings = await generateEmbeddings(batch, config);
    results.push(...embeddings);
    // Add a small delay between batches to avoid rate limiting
    if (i + batchSize < texts.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  return results;
}

