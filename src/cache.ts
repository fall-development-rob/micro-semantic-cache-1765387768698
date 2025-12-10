/**
 * Semantic cache implementation with vector similarity matching
 */

import type {
  CacheConfig,
  CacheEntry,
  CacheStats,
  ISemanticCache,
  SimilarityResult,
} from './types.js';
import { findKNearest, defaultEmbedding } from './vector.js';

/**
 * Semantic cache implementation using vector similarity for intelligent caching
 */
export class SemanticCache<T = unknown> implements ISemanticCache<T> {
  private entries: Map<string, CacheEntry<T>>;
  private config: Required<CacheConfig>;
  private stats: { hits: number; misses: number; similarHits: number };

  constructor(config?: CacheConfig) {
    this.entries = new Map();
    this.stats = { hits: 0, misses: 0, similarHits: 0 };

    // Set defaults
    this.config = {
      maxSize: config?.maxSize ?? 1000,
      ttl: config?.ttl ?? 3600000, // 1 hour
      similarityThreshold: config?.similarityThreshold ?? 0.85,
      embeddingDimension: config?.embeddingDimension ?? 384,
      embedFn: config?.embedFn ?? ((text: string) => defaultEmbedding(text, config?.embeddingDimension ?? 384)),
    };
  }

  /**
   * Get value from cache by exact key match
   * @param key Cache key
   * @returns Cached value or null if not found/expired
   */
  async get(key: string): Promise<T | null> {
    const entry = this.entries.get(key);

    // Check if entry exists
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (entry.expiresAt < Date.now()) {
      this.entries.delete(key);
      this.stats.misses++;
      return null;
    }

    // Hit!
    this.stats.hits++;
    return entry.value;
  }

  /**
   * Set value in cache with optional embedding
   * @param key Cache key
   * @param value Value to cache
   * @param embedding Optional pre-computed embedding
   */
  async set(key: string, value: T, embedding?: number[]): Promise<void> {
    // Generate embedding if not provided
    let embeddingVector: number[];
    if (embedding) {
      if (embedding.length !== this.config.embeddingDimension) {
        throw new Error(
          `Embedding dimension mismatch: expected ${this.config.embeddingDimension}, got ${embedding.length}`
        );
      }
      embeddingVector = embedding;
    } else {
      const result = this.config.embedFn(key);
      embeddingVector = result instanceof Promise ? await result : result;
    }

    // Create cache entry
    const now = Date.now();
    const entry: CacheEntry<T> = {
      key,
      value,
      embedding: embeddingVector,
      timestamp: now,
      expiresAt: now + this.config.ttl,
    };

    // Check maxSize and evict oldest if needed
    if (this.entries.size >= this.config.maxSize && !this.entries.has(key)) {
      this.evictOldest();
    }

    // Store entry
    this.entries.set(key, entry);
  }

  /**
   * Get similar entries based on semantic similarity
   * @param query Query string or embedding vector
   * @param k Number of results to return (default: 5)
   * @param threshold Similarity threshold override (default: config.similarityThreshold)
   * @returns Array of similar results sorted by similarity
   */
  async getSimilar(
    query: string | number[],
    k: number = 5,
    threshold?: number
  ): Promise<SimilarityResult<T>[]> {
    // Generate embedding if query is a string
    let queryEmbedding: number[];
    if (typeof query === 'string') {
      const result = this.config.embedFn(query);
      queryEmbedding = result instanceof Promise ? await result : result;
    } else {
      queryEmbedding = query;
    }

    // Use configured threshold if not provided
    const similarityThreshold = threshold ?? this.config.similarityThreshold;

    // Find k-nearest neighbors
    const results = findKNearest(
      queryEmbedding,
      this.entries,
      k,
      similarityThreshold
    );

    // Track similar hits
    if (results.length > 0) {
      this.stats.similarHits += results.length;
    }

    return results;
  }

  /**
   * Check if key exists in cache (and is not expired)
   * @param key Cache key
   * @returns True if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) {
      return false;
    }

    // Check expiration
    if (entry.expiresAt < Date.now()) {
      this.entries.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete entry from cache
   * @param key Cache key
   * @returns True if entry was deleted, false if not found
   */
  delete(key: string): boolean {
    return this.entries.delete(key);
  }

  /**
   * Clear all entries from cache
   */
  clear(): void {
    this.entries.clear();
    this.stats = { hits: 0, misses: 0, similarHits: 0 };
  }

  /**
   * Get cache statistics
   * @returns Cache statistics including hit rate
   */
  stats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      similarHits: this.stats.similarHits,
      size: this.entries.size,
      hitRate,
    };
  }

  /**
   * Evict the oldest entry from cache
   * @private
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [key, entry] of this.entries.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.entries.delete(oldestKey);
    }
  }
}

/**
 * Factory function to create a semantic cache instance
 * @param config Optional cache configuration
 * @returns New SemanticCache instance
 */
export function createSemanticCache<T = unknown>(
  config?: CacheConfig
): SemanticCache<T> {
  return new SemanticCache<T>(config);
}
