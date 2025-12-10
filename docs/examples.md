# Examples

This document contains practical examples for using micro-semantic-cache in various scenarios.

## Table of Contents

1. [Basic Usage](#basic-usage)
2. [OpenAI Integration](#openai-integration)
3. [Custom Embeddings](#custom-embeddings)
4. [Performance Monitoring](#performance-monitoring)
5. [Production Patterns](#production-patterns)

## Basic Usage

### Simple String Caching

```typescript
import { createSemanticCache } from 'micro-semantic-cache';

const cache = createSemanticCache<string>();

// Store responses
await cache.set('What is Node.js?', 'Node.js is a JavaScript runtime built on Chrome\'s V8 engine');
await cache.set('What is Deno?', 'Deno is a secure runtime for JavaScript and TypeScript');

// Exact retrieval
const nodeAnswer = await cache.get('What is Node.js?');
console.log(nodeAnswer);

// Semantic search
const similar = await cache.getSimilar('Tell me about Node.js');
console.log(similar[0].value); // Returns the Node.js answer
console.log(similar[0].similarity); // Similarity score
```

### Typed Cache

```typescript
interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
}

const productCache = createSemanticCache<Product>({
  ttl: 24 * 60 * 60 * 1000, // 24 hours
  maxSize: 5000,
});

await productCache.set('laptop-gaming', {
  id: 'prod-123',
  name: 'Gaming Laptop',
  price: 1299,
  description: 'High-performance gaming laptop with RTX 4070',
});

// Type-safe retrieval
const product = await productCache.get('laptop-gaming');
if (product) {
  console.log(product.price); // TypeScript knows this is a number
}
```

## OpenAI Integration

### LLM Response Caching

```typescript
import { createSemanticCache } from 'micro-semantic-cache';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Create cache with OpenAI embeddings
const llmCache = createSemanticCache<string>({
  ttl: 60 * 60 * 1000, // 1 hour
  similarityThreshold: 0.88,
  embeddingDimension: 1536, // text-embedding-3-small
  embedFn: async (text) => {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  },
});

async function askGPT(question: string): Promise<string> {
  // Try exact match
  const cached = await llmCache.get(question);
  if (cached) {
    console.log('[Cache Hit] Exact match found');
    return cached;
  }

  // Try semantic match
  const similar = await llmCache.getSimilar(question, 1, 0.88);
  if (similar.length > 0) {
    console.log(`[Cache Hit] Similar match (${similar[0].similarity.toFixed(3)})`);
    return similar[0].value;
  }

  // Make API call
  console.log('[Cache Miss] Calling OpenAI API');
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: question }],
  });

  const answer = response.choices[0].message.content || '';
  await llmCache.set(question, answer);

  return answer;
}

// Usage
const answer1 = await askGPT('What is TypeScript?');
const answer2 = await askGPT('What is TypeScript?'); // Exact hit
const answer3 = await askGPT('Explain TypeScript'); // Semantic hit
```

### Cost Tracking

```typescript
interface LLMResponse {
  answer: string;
  tokens: number;
  cost: number;
}

const costCache = createSemanticCache<LLMResponse>({
  embedFn: async (text) => {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  },
});

async function askWithCostTracking(question: string): Promise<LLMResponse> {
  const similar = await costCache.getSimilar(question, 1);

  if (similar.length > 0) {
    console.log(`Saved $${similar[0].value.cost.toFixed(4)}`);
    return similar[0].value;
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: question }],
  });

  const answer = response.choices[0].message.content || '';
  const tokens = response.usage?.total_tokens || 0;
  const cost = (tokens / 1000) * 0.03; // $0.03 per 1K tokens

  const result: LLMResponse = { answer, tokens, cost };
  await costCache.set(question, result);

  return result;
}

// Track total savings
const stats = costCache.stats();
console.log(`Total requests: ${stats.hits + stats.misses}`);
console.log(`Cache hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);
```

## Custom Embeddings

### Using Transformers.js

```typescript
import { createSemanticCache } from 'micro-semantic-cache';
import { pipeline } from '@xenova/transformers';

// Load sentence transformer model (runs locally!)
const embedder = await pipeline(
  'feature-extraction',
  'Xenova/all-MiniLM-L6-v2'
);

const localCache = createSemanticCache<string>({
  embeddingDimension: 384,
  embedFn: async (text) => {
    const output = await embedder(text, {
      pooling: 'mean',
      normalize: true,
    });
    return Array.from(output.data);
  },
});

// No API calls required!
await localCache.set('machine learning', 'ML is a subset of AI');
const similar = await localCache.getSimilar('AI and ML');
```

### Multilingual Embeddings

```typescript
import { pipeline } from '@xenova/transformers';

const multilingualEmbedder = await pipeline(
  'feature-extraction',
  'Xenova/multilingual-e5-base'
);

const multilingualCache = createSemanticCache<string>({
  embeddingDimension: 768,
  embedFn: async (text) => {
    const output = await multilingualEmbedder(text, {
      pooling: 'mean',
      normalize: true,
    });
    return Array.from(output.data);
  },
});

// Cache in different languages
await multilingualCache.set('Hello world', 'English greeting');
await multilingualCache.set('Hola mundo', 'Spanish greeting');
await multilingualCache.set('Bonjour le monde', 'French greeting');

// Find similar across languages
const results = await multilingualCache.getSimilar('Greetings');
console.log(results); // All three greetings with high similarity
```

## Performance Monitoring

### Real-time Monitoring

```typescript
const cache = createSemanticCache<string>();

// Monitor cache performance
setInterval(() => {
  const stats = cache.stats();

  console.log({
    timestamp: new Date().toISOString(),
    hitRate: `${(stats.hitRate * 100).toFixed(2)}%`,
    totalRequests: stats.hits + stats.misses,
    exactHits: stats.hits,
    semanticHits: stats.similarHits,
    cacheSize: stats.size,
  });
}, 60000); // Every minute

// Log individual query performance
async function queryWithMetrics(query: string) {
  const startTime = performance.now();

  const exact = await cache.get(query);
  if (exact) {
    const duration = performance.now() - startTime;
    console.log(`[Exact Hit] ${duration.toFixed(2)}ms`);
    return exact;
  }

  const similar = await cache.getSimilar(query, 1);
  const duration = performance.now() - startTime;

  if (similar.length > 0) {
    console.log(`[Semantic Hit] ${duration.toFixed(2)}ms (${similar[0].similarity.toFixed(3)})`);
    return similar[0].value;
  }

  console.log(`[Cache Miss] ${duration.toFixed(2)}ms`);
  return null;
}
```

### Similarity Distribution Analysis

```typescript
async function analyzeSimilarityDistribution(query: string) {
  const results = await cache.getSimilar(query, 10, 0); // Get top 10, no threshold

  console.log('\nSimilarity Distribution:');
  console.log('------------------------');

  results.forEach((result, index) => {
    const bar = '█'.repeat(Math.floor(result.similarity * 50));
    console.log(`${index + 1}. [${result.similarity.toFixed(3)}] ${bar}`);
    console.log(`   "${result.key}"`);
  });
}
```

## Production Patterns

### Graceful Degradation

```typescript
import { createSemanticCache } from 'micro-semantic-cache';
import OpenAI from 'openai';

const openai = new OpenAI();

async function createEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Embedding API failed, using fallback', error);
    // Fallback to simple embedding
    return defaultEmbedding(text, 1536);
  }
}

const robustCache = createSemanticCache<string>({
  embedFn: createEmbedding,
});
```

### Rate Limiting Integration

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({ /* config */ });
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '10 s'),
});

const cache = createSemanticCache<string>({
  embedFn: async (text) => {
    const { success } = await ratelimit.limit('embedding-api');

    if (!success) {
      // Use cached embedding or fallback
      const cached = await cache.getSimilar(text, 1);
      if (cached.length > 0) {
        return cached[0].value;
      }
      throw new Error('Rate limit exceeded');
    }

    // Make API call
    return await getEmbedding(text);
  },
});
```

### Persistent Storage Integration

```typescript
import { createSemanticCache } from 'micro-semantic-cache';
import { Redis } from 'ioredis';

const redis = new Redis();

class PersistentSemanticCache<T> {
  private cache: ReturnType<typeof createSemanticCache<T>>;

  constructor() {
    this.cache = createSemanticCache<T>();
    this.loadFromRedis();
  }

  private async loadFromRedis() {
    const keys = await redis.keys('cache:*');

    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        const { value, embedding } = JSON.parse(data);
        await this.cache.set(key.replace('cache:', ''), value, embedding);
      }
    }
  }

  async set(key: string, value: T, embedding?: number[]): Promise<void> {
    await this.cache.set(key, value, embedding);

    // Persist to Redis
    await redis.set(
      `cache:${key}`,
      JSON.stringify({ value, embedding }),
      'EX',
      3600 // 1 hour TTL
    );
  }

  async get(key: string): Promise<T | null> {
    return this.cache.get(key);
  }

  async getSimilar(query: string, k?: number) {
    return this.cache.getSimilar(query, k);
  }
}

const persistentCache = new PersistentSemanticCache<string>();
```

### Circuit Breaker Pattern

```typescript
import { createSemanticCache } from 'micro-semantic-cache';

class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private threshold = 5;
  private timeout = 60000; // 1 minute

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error('Circuit breaker is open');
    }

    try {
      const result = await fn();
      this.reset();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private isOpen(): boolean {
    return this.failures >= this.threshold &&
           Date.now() - this.lastFailure < this.timeout;
  }

  private recordFailure() {
    this.failures++;
    this.lastFailure = Date.now();
  }

  private reset() {
    this.failures = 0;
  }
}

const breaker = new CircuitBreaker();
const cache = createSemanticCache<string>({
  embedFn: async (text) => {
    return breaker.execute(() => callEmbeddingAPI(text));
  },
});
```

### Batching Requests

```typescript
class BatchedSemanticCache<T> {
  private cache: ReturnType<typeof createSemanticCache<T>>;
  private batchQueue: Array<{ key: string; value: T }> = [];
  private batchSize = 10;
  private batchTimeout = 1000; // 1 second
  private timeoutId?: NodeJS.Timeout;

  constructor() {
    this.cache = createSemanticCache<T>();
  }

  async set(key: string, value: T): Promise<void> {
    this.batchQueue.push({ key, value });

    if (this.batchQueue.length >= this.batchSize) {
      await this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  private scheduleFlush() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(() => this.flush(), this.batchTimeout);
  }

  private async flush() {
    if (this.batchQueue.length === 0) return;

    const batch = [...this.batchQueue];
    this.batchQueue = [];

    // Batch embed all texts
    const embeddings = await batchEmbed(batch.map(item => item.key));

    // Store all at once
    await Promise.all(
      batch.map((item, index) =>
        this.cache.set(item.key, item.value, embeddings[index])
      )
    );
  }

  async get(key: string): Promise<T | null> {
    return this.cache.get(key);
  }
}

async function batchEmbed(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
  });

  return response.data.map(item => item.embedding);
}
```

## Advanced Scenarios

### Multi-Tenant Caching

```typescript
class MultiTenantCache<T> {
  private caches = new Map<string, ReturnType<typeof createSemanticCache<T>>>();

  private getCache(tenantId: string) {
    if (!this.caches.has(tenantId)) {
      this.caches.set(tenantId, createSemanticCache<T>({
        maxSize: 1000,
        ttl: 3600000,
      }));
    }
    return this.caches.get(tenantId)!;
  }

  async set(tenantId: string, key: string, value: T): Promise<void> {
    const cache = this.getCache(tenantId);
    await cache.set(key, value);
  }

  async get(tenantId: string, key: string): Promise<T | null> {
    const cache = this.getCache(tenantId);
    return cache.get(key);
  }

  getStats(tenantId: string) {
    const cache = this.getCache(tenantId);
    return cache.stats();
  }
}

const multiTenantCache = new MultiTenantCache<string>();

// Usage
await multiTenantCache.set('tenant-1', 'query', 'response');
await multiTenantCache.set('tenant-2', 'query', 'different-response');
```

### A/B Testing Cache Strategies

```typescript
interface CacheStrategy {
  threshold: number;
  ttl: number;
  name: string;
}

const strategies: CacheStrategy[] = [
  { threshold: 0.85, ttl: 3600000, name: 'conservative' },
  { threshold: 0.75, ttl: 7200000, name: 'aggressive' },
];

async function testStrategies(queries: string[]) {
  const results = new Map<string, { hits: number; misses: number }>();

  for (const strategy of strategies) {
    const cache = createSemanticCache<string>({
      similarityThreshold: strategy.threshold,
      ttl: strategy.ttl,
    });

    let hits = 0;
    let misses = 0;

    for (const query of queries) {
      const similar = await cache.getSimilar(query, 1);

      if (similar.length > 0) {
        hits++;
      } else {
        misses++;
        await cache.set(query, `Response for ${query}`);
      }
    }

    results.set(strategy.name, { hits, misses });
  }

  return results;
}
```
