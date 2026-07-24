import { Document } from '@langchain/core/documents';
import type { DocumentInterface } from '@langchain/core/documents';
import type { EmbeddingsInterface } from '@langchain/core/embeddings';
import { VectorStore } from '@langchain/core/vectorstores';
import { vectorStoreService } from './vector-store.service.js';

export interface SnaptiumVectorFilter {
  noteId?: string;
  threshold?: number;
}

function textMetadata(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function numericMetadata(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export class SnaptiumLanceVectorStore extends VectorStore {
  declare FilterType: SnaptiumVectorFilter;
  lc_namespace = ['snaptium', 'knowledge_copilot', 'vectorstores'];

  constructor(embeddings: EmbeddingsInterface) {
    super(embeddings, {});
  }

  _vectorstoreType(): string {
    return 'snaptium-lance';
  }

  async initialize(workspaceRoot: string): Promise<void> {
    await vectorStoreService.initialize(workspaceRoot);
  }

  async addDocuments(documents: DocumentInterface[]): Promise<string[]> {
    const vectors = await this.embeddings.embedDocuments(documents.map((document) => document.pageContent));
    return await this.addVectors(vectors, documents);
  }

  async addVectors(vectors: number[][], documents: DocumentInterface[]): Promise<string[]> {
    const now = Date.now();
    const ids = documents.map((document, index) => document.id || textMetadata(document.metadata.id) || `chunk-${now}-${index}`);
    await vectorStoreService.addChunks(documents.map((document, index) => ({
      id: ids[index],
      noteId: textMetadata(document.metadata.noteId),
      noteTitle: textMetadata(document.metadata.noteTitle),
      content: document.pageContent,
      startPos: numericMetadata(document.metadata.startPos),
      endPos: numericMetadata(document.metadata.endPos),
      vector: vectors[index],
      createdAt: now,
      updatedAt: now,
    })));
    return ids;
  }

  async delete(params: Record<string, unknown> = {}): Promise<void> {
    const noteId = textMetadata(params.noteId);
    if (noteId) {
      await vectorStoreService.deleteByNoteId(noteId);
      return;
    }
    if (params.all === true) await vectorStoreService.clear();
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: SnaptiumVectorFilter,
  ): Promise<Array<[DocumentInterface, number]>> {
    const results = await vectorStoreService.search(query, k, filter?.threshold ?? 0);
    return results
      .filter((result) => !filter?.noteId || result.noteId === filter.noteId)
      .map((result) => [
        new Document({
          id: result.id,
          pageContent: textMetadata(result.content),
          metadata: {
            noteId: textMetadata(result.noteId),
            noteTitle: textMetadata(result.noteTitle),
            startPos: numericMetadata(result.startPos),
            endPos: numericMetadata(result.endPos),
          },
        }),
        Number(result.score),
      ]);
  }
}
