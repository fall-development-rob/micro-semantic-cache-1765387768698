/**
 * Micro Semantic Cache - Lightweight semantic caching library
 * @module micro-semantic-cache
 */

export * from './types.js';
export * from './vector.js';
export * from './cache.js';

// Re-export main factory as default
export { createSemanticCache as default } from './cache.js';
