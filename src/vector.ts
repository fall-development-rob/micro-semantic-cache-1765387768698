/**
 * Vector similarity utilities for semantic matching
 */

import type { CacheEntry, SimilarityResult } from './types.js';

/**
 * Calculate cosine similarity between two vectors
 * @param a First vector
 * @param b Second vector
 * @returns Similarity score between 0 and 1
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);

  if (magnitude === 0) {
    return 0;
  }

  return dotProduct / magnitude;
}

/**
 * Find k-nearest neighbors based on cosine similarity
 * @param queryEmbedding Query vector
 * @param entries Cache entries to search
 * @param k Number of results to return
 * @param threshold Minimum similarity threshold
 * @returns Array of similarity results sorted by similarity (descending)
 */
export function findKNearest<T>(
  queryEmbedding: number[],
  entries: Map<string, CacheEntry<T>>,
  k: number = 5,
  threshold: number = 0
): SimilarityResult<T>[] {
  const results: SimilarityResult<T>[] = [];

  for (const entry of entries.values()) {
    // Skip expired entries
    if (entry.expiresAt < Date.now()) {
      continue;
    }

    const similarity = cosineSimilarity(queryEmbedding, entry.embedding);

    if (similarity >= threshold) {
      results.push({
        key: entry.key,
        value: entry.value,
        similarity,
      });
    }
  }

  // Sort by similarity (descending) and take top k
  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);
}

/**
 * Normalize a vector to unit length
 * @param vector Vector to normalize
 * @returns Normalized vector
 */
export function normalize(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));

  if (magnitude === 0) {
    return vector;
  }

  return vector.map(val => val / magnitude);
}

/**
 * Default simple embedding function using character codes
 * This is a placeholder - production should use proper embeddings (e.g., OpenAI, sentence-transformers)
 * @param text Input text
 * @param dimension Target embedding dimension
 * @returns Simple embedding vector
 */
export function defaultEmbedding(text: string, dimension: number = 384): number[] {
  const embedding = new Array(dimension).fill(0);
  const normalized = text.toLowerCase();

  // Simple hash-based embedding - NOT suitable for production
  for (let i = 0; i < normalized.length; i++) {
    const charCode = normalized.charCodeAt(i);
    const idx = charCode % dimension;
    embedding[idx] += Math.sin(i * charCode) * 0.1;
  }

  return normalize(embedding);
}
