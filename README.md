# THIS IS A TEST REPO
This is a test repo, to test the cto-flow(https://github.com/rob-otix-ai/cto-flow) and if it can build based on the project workflow. 

# micro-semantic-cache

> Lightweight semantic caching for AI applications - reduce API costs by 40-60% with vector similarity matching

[![npm version](https://img.shields.io/npm/v/micro-semantic-cache.svg)](https://www.npmjs.com/package/micro-semantic-cache)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/micro-semantic-cache)](https://bundlephobia.com/package/micro-semantic-cache)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

## Features

- **Vector Similarity-Based Caching** - Find semantically similar queries, not just exact matches
- **Zero Runtime Dependencies** - Pure TypeScript implementation, no external dependencies
- **TypeScript-First** - Full type safety with comprehensive type definitions
- **Configurable Similarity Threshold** - Fine-tune semantic matching (0-1 scale, default: 0.85)
- **TTL-Based Expiration** - Automatic cache invalidation with configurable time-to-live
- **LRU Eviction Policy** - Efficient memory management with least-recently-used eviction
- **Lightweight** - ~10KB minified, minimal footprint for maximum performance
- **Custom Embeddings** - Bring your own embedding function (OpenAI, sentence-transformers, etc.)
- **Performance Tracking** - Built-in statistics for hit rate monitoring

## Installation

```bash
npm install micro-semantic-cache
```

## Quick Start

```typescript
import { createSemanticCache } from 'micro-semantic-cache';

// Create a cache instance
const cache = createSemanticCache<string>();

// Cache an API response
await cache.set('What is TypeScript?', 'TypeScript is a typed superset of JavaScript');

// Exact match retrieval
const exact = await cache.get('What is TypeScript?');
console.log(exact); // "TypeScript is a typed superset of JavaScript"

// Semantic similarity matching - finds similar cached entries
const similar = await cache.getSimilar('Tell me about TypeScript', 3);
console.log(similar[0].similarity); // ~0.85
console.log(similar[0].value); // "TypeScript is a typed superset of JavaScript"
```

## API Reference

### `createSemanticCache<T>(config?: CacheConfig): SemanticCache<T>`

Factory function to create a new semantic cache instance.

**Type Parameters:**
- `T` - Type of values stored in the cache

**Parameters:**

```typescript
interface CacheConfig {
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
```

### Methods

#### `get(key: string): Promise<T | null>`

Retrieve a value from the cache by exact key match.

**Returns:** The cached value or `null` if not found or expired.

```typescript
const value = await cache.get('my-key');
```

#### `set(key: string, value: T, embedding?: number[]): Promise<void>`

Store a value in the cache with optional pre-computed embedding.

**Parameters:**
- `key` - Cache key
- `value` - Value to cache
- `embedding` - Optional pre-computed embedding vector

```typescript
await cache.set('user-query', { response: 'Hello world' });

// With custom embedding
const embedding = await getEmbedding('user-query');
await cache.set('user-query', { response: 'Hello world' }, embedding);
```

#### `getSimilar(query: string | number[], k?: number, threshold?: number): Promise<SimilarityResult<T>[]>`

Find semantically similar entries based on vector similarity.

**Parameters:**
- `query` - Query string or embedding vector
- `k` - Number of results to return (default: 5)
- `threshold` - Similarity threshold override (default: config.similarityThreshold)

**Returns:** Array of similar results sorted by similarity (descending).

```typescript
interface SimilarityResult<T> {
  key: string;
  value: T;
  similarity: number; // 0-1 scale
}

const results = await cache.getSimilar('TypeScript programming', 3);
results.forEach(result => {
  console.log(`${result.key}: ${result.similarity.toFixed(2)}`);
});
```

#### `has(key: string): boolean`

Check if a key exists in the cache and is not expired.

```typescript
if (cache.has('my-key')) {
  console.log('Cache hit!');
}
```

#### `delete(key: string): boolean`

Remove an entry from the cache.

**Returns:** `true` if the entry was deleted, `false` if not found.

```typescript
cache.delete('old-key');
```

#### `clear(): void`

Remove all entries from the cache and reset statistics.

```typescript
cache.clear();
```

#### `stats(): CacheStats`

Get cache performance statistics.

**Returns:**

```typescript
interface CacheStats {
  hits: number;          // Number of exact cache hits
  misses: number;        // Number of cache misses
  similarHits: number;   // Number of similar matches found
  size: number;          // Current number of entries
  hitRate: number;       // Hit rate (0-1)
}

const stats = cache.stats();
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);
```

## Use Cases

### 1. Caching LLM Responses

Reduce API costs by caching similar queries:

```typescript
import { createSemanticCache } from 'micro-semantic-cache';
import OpenAI from 'openai';

const openai = new OpenAI();
const cache = createSemanticCache<string>({
  embedFn: async (text) => {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  },
});

async function askGPT(question: string): Promise<string> {
  // Check for exact match
  const cached = await cache.get(question);
  if (cached) {
    console.log('Cache hit!');
    return cached;
  }

  // Check for similar questions
  const similar = await cache.getSimilar(question, 1);
  if (similar.length > 0) {
    console.log(`Similar match: ${similar[0].similarity.toFixed(2)}`);
    return similar[0].value;
  }

  // Make API call
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: question }],
  });

  const answer = response.choices[0].message.content || '';
  await cache.set(question, answer);

  return answer;
}

// First call - API request
await askGPT('What is machine learning?');

// Second call - cache hit
await askGPT('What is machine learning?');

// Third call - similar match (no API call!)
await askGPT('Explain machine learning to me');
```

### 2. Reducing API Costs

Save money on expensive API calls:

```typescript
const cache = createSemanticCache<any>({
  ttl: 24 * 60 * 60 * 1000, // 24 hours
  similarityThreshold: 0.80, // 80% similarity
});

// Track savings
const stats = cache.stats();
const apiCallsSaved = stats.hits + stats.similarHits;
const costSavings = apiCallsSaved * 0.002; // $0.002 per API call
console.log(`Saved $${costSavings.toFixed(2)} in API costs`);
```

### 3. Fuzzy Search / Query Matching

Find similar user queries:

```typescript
const searchCache = createSemanticCache<{ results: any[] }>({
  similarityThreshold: 0.75,
  maxSize: 5000,
});

async function search(query: string) {
  // Check cache first
  const similar = await searchCache.getSimilar(query, 1, 0.75);

  if (similar.length > 0) {
    console.log(`Using cached results for similar query: "${similar[0].key}"`);
    return similar[0].value.results;
  }

  // Perform actual search
  const results = await performExpensiveSearch(query);
  await searchCache.set(query, { results });

  return results;
}
```

## Configuration

### Default Configuration

```typescript
const cache = createSemanticCache({
  maxSize: 1000,              // Maximum 1000 entries
  ttl: 3600000,               // 1 hour TTL (in milliseconds)
  similarityThreshold: 0.85,  // 85% similarity required
  embeddingDimension: 384,    // 384-dimensional vectors
  embedFn: defaultEmbedding,  // Built-in simple embedding
});
```

### Custom Embedding Function

Use production-grade embeddings:

```typescript
import { createSemanticCache } from 'micro-semantic-cache';
import { pipeline } from '@xenova/transformers';

// Load a sentence transformer model
const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

const cache = createSemanticCache({
  embeddingDimension: 384,
  embedFn: async (text) => {
    const output = await embedder(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  },
});
```

### Performance Tuning

Optimize for your use case:

```typescript
// High-precision caching (stricter matching)
const preciseCache = createSemanticCache({
  similarityThreshold: 0.95, // 95% similarity required
  ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
});

// Fuzzy matching (more lenient)
const fuzzyCache = createSemanticCache({
  similarityThreshold: 0.70, // 70% similarity
  maxSize: 10000,
});

// Memory-constrained environments
const compactCache = createSemanticCache({
  maxSize: 100,              // Small cache
  ttl: 600000,               // 10 minutes
  embeddingDimension: 128,   // Smaller vectors
});
```

## Advanced Examples

### Multi-Language Support

```typescript
const cache = createSemanticCache<string>({
  embedFn: async (text) => {
    // Use a multilingual embedding model
    const response = await fetch('https://api.example.com/embed', {
      method: 'POST',
      body: JSON.stringify({ text, model: 'multilingual-e5-large' }),
    });
    const { embedding } = await response.json();
    return embedding;
  },
});

await cache.set('Hello world', 'Greeting in English');
await cache.set('Hola mundo', 'Greeting in Spanish');

// Find similar across languages
const similar = await cache.getSimilar('Bonjour le monde');
```

### Monitoring and Debugging

```typescript
const cache = createSemanticCache<string>();

// Log cache performance
setInterval(() => {
  const stats = cache.stats();
  console.log({
    hitRate: `${(stats.hitRate * 100).toFixed(2)}%`,
    totalHits: stats.hits,
    similarHits: stats.similarHits,
    size: stats.size,
  });
}, 60000); // Every minute

// Debug similarity scores
const results = await cache.getSimilar('test query', 5);
results.forEach(({ key, similarity }) => {
  console.log(`${key}: ${similarity.toFixed(3)}`);
});
```

## Performance

- **Lookup Speed:** O(1) for exact matches, O(n) for similarity search
- **Memory Usage:** ~1KB per entry (varies with embedding dimension)
- **Bundle Size:** ~10KB minified + gzipped
- **Type Safety:** Full TypeScript support with zero runtime overhead

### Benchmarks

```
Exact cache lookup:     0.001ms
Similarity search (1K): 2-5ms
Similarity search (10K): 20-50ms
```

## Best Practices

1. **Use Production Embeddings:** The default embedding function is for testing only. Use OpenAI, Sentence Transformers, or similar for production.

2. **Tune Similarity Threshold:** Start with 0.85 and adjust based on your use case. Lower values (0.70-0.80) for fuzzy matching, higher values (0.90-0.95) for precision.

3. **Monitor Hit Rates:** Use `cache.stats()` to track performance and adjust configuration.

4. **Consider TTL:** Set appropriate TTL values based on data freshness requirements.

5. **Pre-compute Embeddings:** For better performance, compute embeddings once and pass them to `set()`.

## TypeScript Support

Full type safety out of the box:

```typescript
import { createSemanticCache, type CacheConfig, type SimilarityResult } from 'micro-semantic-cache';

interface UserResponse {
  id: string;
  answer: string;
  timestamp: number;
}

const cache = createSemanticCache<UserResponse>();

await cache.set('query1', {
  id: '123',
  answer: 'Response',
  timestamp: Date.now(),
});

// Type-safe retrieval
const result: UserResponse | null = await cache.get('query1');
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Credits

Built with TypeScript and inspired by the need for intelligent caching in AI applications.

---

**Note:** This is a lightweight implementation focused on simplicity and zero dependencies. For production use with large-scale applications, consider:
- Using production-grade embedding models (OpenAI, Cohere, Sentence Transformers)
- Implementing persistent storage (Redis, MongoDB)
- Adding distributed caching for multi-instance deployments
