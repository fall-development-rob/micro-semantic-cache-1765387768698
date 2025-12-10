/**
 * Core type definitions for micro-semantic-cache
 */

export interface CacheConfig {
  /** Maximum number of entries to store (default: 1000) */
  maxSize?: number;
  /** Time-to-live in milliseconds (default: 3600000 - 1 hour) */
  ttl?: number;
  /** Similarity threshold for semantic matching (0-1, default: 0.85) */
  similarityThreshold?: number;
  /** Embedding dimension size (default: 384) */
  embeddingDimension?: number;
  /** Custom embedding function */
  embedFn?: (text: string) => Promise<number[]> | number[];
}

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  embedding: number[];
  timestamp: number;
  expiresAt: number;
}

export interface SimilarityResult<T = unknown> {
  key: string;
  value: T;
  similarity: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  similarHits: number;
  size: number;
  hitRate: number;
}

export interface ISemanticCache<T = unknown> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T, embedding?: number[]): Promise<void>;
  getSimilar(query: string | number[], k?: number, threshold?: number): Promise<SimilarityResult<T>[]>;
  has(key: string): boolean;
  delete(key: string): boolean;
  clear(): void;
  stats(): CacheStats;
}
