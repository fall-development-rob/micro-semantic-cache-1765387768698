# Architecture Design - micro-semantic-cache

## System Overview

A lightweight semantic caching library that provides similarity-based cache retrieval using vector embeddings, designed for AI applications without external dependencies.

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      SemanticCache                          │
│  - Main entry point                                         │
│  - Coordinates all operations                               │
│  - Manages configuration                                     │
└───────────┬─────────────────────────────────┬───────────────┘
            │                                 │
            │                                 │
     ┌──────▼──────┐                   ┌─────▼──────────┐
     │ VectorStore │                   │ StorageBackend │
     │             │                   │   (Interface)  │
     │ - Embeddings│                   │                │
     │ - Similarity│                   │ - set()        │
     │ - k-NN      │                   │ - get()        │
     │   search    │                   │ - delete()     │
     └──────┬──────┘                   │ - clear()      │
            │                          │ - size()       │
            │                          └────────┬───────┘
     ┌──────▼──────────┐                        │
     │   Embedding     │                 ┌──────▼─────────┐
     │   Generator     │                 │ Memory Backend │
     │                 │                 │  (Default)     │
     │ - Hash-based    │                 │                │
     │ - Deterministic │                 │ - Map-based    │
     │ - Configurable  │                 │ - In-memory    │
     │   dimension     │                 │ - TTL support  │
     └─────────────────┘                 └────────────────┘
```

## Core Components

### 1. SemanticCache (Main Controller)

**Responsibilities:**
- Public API surface (set, get, getSimilar, delete, clear)
- Configuration management (threshold, maxSize, ttl, dimension)
- Coordination between VectorStore and StorageBackend
- Metrics tracking (hits, misses, evictions)

**Key Methods:**
```typescript
set(key: string, value: T, options?: CacheOptions): Promise<void>
get(key: string): Promise<T | undefined>
getSimilar(query: string, k?: number): Promise<Array<{ key: string; value: T; similarity: number }>>
delete(key: string): Promise<boolean>
clear(): Promise<void>
```

### 2. VectorStore (Embedding Manager)

**Responsibilities:**
- Generate embeddings from text keys
- Store and index embeddings
- Perform k-NN similarity search
- Calculate cosine similarity scores

**Key Methods:**
```typescript
generateEmbedding(text: string): number[]
addEmbedding(key: string, embedding: number[]): void
findSimilar(queryEmbedding: number[], k: number, threshold: number): Array<{ key: string; similarity: number }>
removeEmbedding(key: string): void
```

### 3. EmbeddingGenerator (Vector Creation)

**Responsibilities:**
- Hash-based text vectorization
- Deterministic embedding generation
- No external dependencies

**Algorithm:**
```typescript
// Simple hash-based embedding (customizable dimension)
1. Initialize vector of zeros (configurable dimension, default 128)
2. For each character in text:
   - Calculate hash: charCode * position
   - Map to dimension index: hash % dimension
   - Increment vector[index]
3. Normalize vector (L2 normalization)
```

### 4. StorageBackend (Interface)

**Responsibilities:**
- Abstract storage implementation
- Support multiple backends (memory, redis, etc.)
- TTL-based expiration
- LRU eviction support

**Interface:**
```typescript
interface StorageBackend<T> {
  set(key: string, value: CacheEntry<T>): Promise<void>
  get(key: string): Promise<CacheEntry<T> | undefined>
  delete(key: string): Promise<boolean>
  clear(): Promise<void>
  size(): Promise<number>
  keys(): Promise<string[]>
}

interface CacheEntry<T> {
  value: T
  embedding: number[]
  createdAt: number
  ttl?: number
  accessCount: number
  lastAccessed: number
}
```

## Data Flows

### Cache SET Flow

```
User Input (key, value)
    │
    ├─> Generate Embedding
    │       │
    │       └─> Hash-based vectorization
    │           └─> Normalize vector
    │
    ├─> Create CacheEntry
    │       │
    │       └─> {value, embedding, metadata}
    │
    ├─> Check Size Limit
    │       │
    │       ├─> If full: Evict LRU entry
    │       └─> Continue
    │
    └─> Store in Backend
            │
            ├─> StorageBackend.set()
            └─> VectorStore.addEmbedding()
```

### Cache GET Flow (Exact Match)

```
User Query (key)
    │
    └─> StorageBackend.get(key)
            │
            ├─> Not found → return undefined
            │
            └─> Found → Check TTL
                    │
                    ├─> Expired → Delete & return undefined
                    │
                    └─> Valid → Update metrics
                            │
                            └─> Return value
```

### Similar Search Flow

```
User Query (text, k, threshold?)
    │
    ├─> Generate Query Embedding
    │       │
    │       └─> Same hash-based algorithm
    │
    ├─> VectorStore.findSimilar()
    │       │
    │       ├─> Calculate cosine similarity for all vectors
    │       │       │
    │       │       └─> similarity = dot(v1, v2) / (norm(v1) * norm(v2))
    │       │
    │       ├─> Filter by threshold (default 0.8)
    │       │
    │       └─> Sort by similarity (descending)
    │
    ├─> Take top k results
    │
    └─> Retrieve values from StorageBackend
            │
            └─> Return [{key, value, similarity}]
```

## Architecture Decision Records (ADRs)

### ADR-001: Hash-based Embeddings (No External Dependencies)

**Decision:** Use simple hash-based text vectorization instead of ML models

**Rationale:**
- Zero external dependencies (transformers, TensorFlow, etc.)
- Fast computation (microseconds vs milliseconds)
- Deterministic and reproducible
- Sufficient for semantic similarity in cache keys
- Library remains lightweight (<10KB minified)

**Trade-offs:**
- Lower semantic understanding vs ML models
- Works best for similar text patterns
- Not suitable for deep semantic understanding

**Alternatives Considered:**
- TF-IDF: Requires corpus and more memory
- Word2Vec: External model files needed
- BERT/Transformers: Too heavy for a cache library

### ADR-002: Cosine Similarity for Vector Comparison

**Decision:** Use cosine similarity as distance metric

**Rationale:**
- Scale-invariant (normalized vectors)
- Standard in information retrieval
- Range [0, 1] easy to threshold
- Fast computation with dot product

**Alternatives Considered:**
- Euclidean distance: Sensitive to magnitude
- Jaccard similarity: Better for sets, not vectors
- Manhattan distance: Less common in embeddings

### ADR-003: Pluggable Storage Backends

**Decision:** Define StorageBackend interface with default in-memory implementation

**Rationale:**
- Flexibility for different use cases
- Easy to add Redis, SQLite, etc.
- Testability with mock backends
- In-memory default keeps zero dependencies

**Implementation:**
```typescript
// Users can provide custom backends
const cache = new SemanticCache({
  backend: new RedisBackend({ url: 'redis://localhost:6379' })
})
```

### ADR-004: TTL-based Expiration with Lazy Cleanup

**Decision:** Expire entries on access, not with background timers

**Rationale:**
- No background processes needed
- Lower memory overhead
- Simple implementation
- Adequate for cache use case

**Implementation:**
```typescript
async get(key: string) {
  const entry = await this.backend.get(key)
  if (!entry) return undefined

  // Lazy TTL check
  if (entry.ttl && Date.now() - entry.createdAt > entry.ttl) {
    await this.delete(key)
    return undefined
  }

  return entry.value
}
```

**Trade-offs:**
- Expired entries may linger if not accessed
- Periodic cleanup needed for size management
- Acceptable for cache scenarios

## Memory Management Strategy

### LRU Eviction Policy

When `maxSize` is reached:

```typescript
async evictLRU(): Promise<void> {
  const keys = await this.backend.keys()
  const entries = await Promise.all(
    keys.map(async k => ({
      key: k,
      entry: await this.backend.get(k)
    }))
  )

  // Sort by lastAccessed (oldest first)
  entries.sort((a, b) => a.entry.lastAccessed - b.entry.lastAccessed)

  // Remove oldest entry
  const toEvict = entries[0]
  await this.delete(toEvict.key)
  this.metrics.evictions++
}
```

### Lazy TTL Cleanup

**On Access:**
- Check TTL when retrieving entry
- Delete if expired
- Update lastAccessed if valid

**On Set:**
- Check size limit
- Evict LRU if needed
- Store new entry

**Periodic Cleanup (Optional):**
```typescript
async cleanupExpired(): Promise<number> {
  const keys = await this.backend.keys()
  let cleaned = 0

  for (const key of keys) {
    const entry = await this.backend.get(key)
    if (entry && entry.ttl && Date.now() - entry.createdAt > entry.ttl) {
      await this.delete(key)
      cleaned++
    }
  }

  return cleaned
}
```

### Configurable Embedding Dimension

**Default:** 128 dimensions (good balance)

**Trade-offs:**
- Higher dimension → Better separation, more memory
- Lower dimension → Less memory, faster computation, potential collisions

**Memory per entry:**
- 128D embedding: ~1KB (Float64Array)
- 256D embedding: ~2KB
- 64D embedding: ~512 bytes

**Recommendation:**
- Small cache (<1000 entries): 128D
- Medium cache (1000-10000): 128D-256D
- Large cache (>10000): Consider external vectorDB

## Performance Characteristics

### Time Complexity

| Operation | Complexity | Notes |
|-----------|-----------|-------|
| set() | O(n + d) | n = text length, d = dimension |
| get() | O(1) | Exact key lookup |
| getSimilar() | O(m * d) | m = cache size, d = dimension |
| delete() | O(1) | Hash-based removal |
| clear() | O(m) | m = cache size |

### Space Complexity

| Component | Memory Usage |
|-----------|-------------|
| Cache Entry | ~1KB (128D) + value size |
| Vector Index | O(m * d) where m = entries, d = dimension |
| Storage Backend | O(m) entries |
| Total | ~1KB per entry + overhead |

### Optimization Strategies

1. **Approximate k-NN:** Consider LSH (Locality-Sensitive Hashing) for >10K entries
2. **Quantization:** Use Int8 instead of Float64 for embeddings (8x smaller)
3. **Batch Operations:** Support batch set/get for efficiency
4. **Incremental Indexing:** Update index on write, not rebuild

## Extension Points

### Custom Backends

```typescript
class RedisBackend implements StorageBackend<any> {
  constructor(private client: Redis) {}

  async set(key: string, value: CacheEntry<any>): Promise<void> {
    await this.client.set(key, JSON.stringify(value))
  }

  // ... other methods
}
```

### Custom Similarity Metrics

```typescript
interface SimilarityMetric {
  compute(v1: number[], v2: number[]): number
}

class EuclideanSimilarity implements SimilarityMetric {
  compute(v1: number[], v2: number[]): number {
    // Custom distance calculation
  }
}
```

### Middleware/Hooks

```typescript
interface CacheMiddleware<T> {
  beforeSet?(key: string, value: T): Promise<void>
  afterGet?(key: string, value: T | undefined): Promise<void>
  onEvict?(key: string): Promise<void>
}
```

## Testing Strategy

### Unit Tests
- VectorStore: Embedding generation, similarity calculation
- StorageBackend: CRUD operations, TTL handling
- SemanticCache: Integration of all components

### Integration Tests
- Full cache workflows (set → get → similar)
- TTL expiration scenarios
- LRU eviction behavior
- Concurrent access patterns

### Performance Tests
- Benchmark embedding generation (target: <1ms)
- Benchmark similarity search (target: <10ms for 1K entries)
- Memory profiling (target: <2KB per entry)

## Deployment Considerations

### Bundle Size
- Target: <10KB minified + gzipped
- No external dependencies
- Tree-shakeable exports

### Runtime Compatibility
- Node.js 14+
- Browser (ES2020+)
- Edge runtime (Cloudflare Workers, Vercel Edge)

### Configuration Defaults

```typescript
const defaults = {
  threshold: 0.8,        // 80% similarity
  maxSize: 1000,         // 1K entries
  ttl: undefined,        // No expiration
  dimension: 128,        // 128D embeddings
  backend: new MemoryBackend()
}
```

---

## Summary

This architecture provides:
- ✅ Lightweight implementation (<10KB)
- ✅ Zero external dependencies
- ✅ Fast similarity search (<10ms for 1K entries)
- ✅ Flexible storage backends
- ✅ TTL-based expiration
- ✅ LRU eviction
- ✅ Simple, maintainable codebase

**Key Innovation:** Hash-based embeddings provide semantic similarity without ML models, making this the lightest semantic cache library available.
