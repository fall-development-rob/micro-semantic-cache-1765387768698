import assert from 'assert';
import { SemanticCache, createSemanticCache } from '../src/cache.ts';
import { generateEmbedding, cosineSimilarity } from '../src/vector.ts';

// Test runner
const tests: Array<{ name: string; fn: () => Promise<void> | void }> = [];
function test(name: string, fn: () => Promise<void> | void) {
  tests.push({ name, fn });
}

// Helper to wait for a duration
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================================================
// Vector Tests
// ============================================================================

test('generateEmbedding returns correct dimension', async () => {
  const embedding = generateEmbedding('test query');
  assert.strictEqual(embedding.length, 384, 'Embedding should have 384 dimensions');
  assert.ok(embedding.every(n => typeof n === 'number'), 'All values should be numbers');
});

test('cosineSimilarity of identical vectors is 1', async () => {
  const vec = generateEmbedding('hello world');
  const similarity = cosineSimilarity(vec, vec);
  assert.ok(Math.abs(similarity - 1.0) < 0.0001, `Expected ~1.0, got ${similarity}`);
});

test('cosineSimilarity of orthogonal vectors is 0', async () => {
  const vec1 = new Array(384).fill(0);
  vec1[0] = 1;
  const vec2 = new Array(384).fill(0);
  vec2[1] = 1;
  const similarity = cosineSimilarity(vec1, vec2);
  assert.strictEqual(similarity, 0, 'Orthogonal vectors should have similarity 0');
});

test('cosineSimilarity of similar text is high', async () => {
  const vec1 = generateEmbedding('machine learning');
  const vec2 = generateEmbedding('artificial intelligence');
  const similarity = cosineSimilarity(vec1, vec2);
  assert.ok(similarity > 0.5, `Similar text should have high similarity, got ${similarity}`);
});

test('cosineSimilarity of different text is low', async () => {
  const vec1 = generateEmbedding('banana fruit');
  const vec2 = generateEmbedding('database query');
  const similarity = cosineSimilarity(vec1, vec2);
  assert.ok(similarity < 0.7, `Different text should have lower similarity, got ${similarity}`);
});

// ============================================================================
// Cache Basic Operations
// ============================================================================

test('set and get returns correct value', async () => {
  const cache = createSemanticCache();
  cache.set('greeting', 'Hello, World!');
  const result = await await cache.get('greeting');
  assert.strictEqual(result, 'Hello, World!', 'Should return the set value');
});

test('get returns null for missing key', async () => {
  const cache = createSemanticCache();
  const result = await await cache.get('nonexistent');
  assert.strictEqual(result, null, 'Should return null for missing key');
});

test('has returns correct boolean', async () => {
  const cache = createSemanticCache();
  cache.set('key1', 'value1');
  assert.strictEqual(cache.has('key1'), true, 'Should return true for existing key');
  assert.strictEqual(cache.has('key2'), false, 'Should return false for missing key');
});

test('delete removes entry', async () => {
  const cache = createSemanticCache();
  cache.set('key1', 'value1');
  assert.strictEqual(cache.has('key1'), true, 'Key should exist before delete');

  const deleted = cache.delete('key1');
  assert.strictEqual(deleted, true, 'Delete should return true');
  assert.strictEqual(cache.has('key1'), false, 'Key should not exist after delete');
  assert.strictEqual(await await cache.get('key1'), null, 'Get should return null after delete');
});

test('delete returns false for missing key', async () => {
  const cache = createSemanticCache();
  const deleted = cache.delete('nonexistent');
  assert.strictEqual(deleted, false, 'Delete should return false for missing key');
});

test('clear removes all entries', async () => {
  const cache = createSemanticCache();
  cache.set('key1', 'value1');
  cache.set('key2', 'value2');
  cache.set('key3', 'value3');

  assert.strictEqual(cache.has('key1'), true, 'Key1 should exist before clear');
  assert.strictEqual(cache.has('key2'), true, 'Key2 should exist before clear');

  cache.clear();

  assert.strictEqual(cache.has('key1'), false, 'Key1 should not exist after clear');
  assert.strictEqual(cache.has('key2'), false, 'Key2 should not exist after clear');
  assert.strictEqual(cache.has('key3'), false, 'Key3 should not exist after clear');
  assert.strictEqual(cache.size(), 0, 'Cache size should be 0 after clear');
});

test('size returns correct count', async () => {
  const cache = createSemanticCache();
  assert.strictEqual(cache.size(), 0, 'Initial size should be 0');

  cache.set('key1', 'value1');
  assert.strictEqual(cache.size(), 1, 'Size should be 1 after one set');

  cache.set('key2', 'value2');
  assert.strictEqual(cache.size(), 2, 'Size should be 2 after two sets');

  cache.delete('key1');
  assert.strictEqual(cache.size(), 1, 'Size should be 1 after delete');
});

// ============================================================================
// Semantic Similarity Tests
// ============================================================================

test('getSimilar finds similar entries', async () => {
  const cache = createSemanticCache({ threshold: 0.7 });
  cache.set('machine learning basics', 'ML is a subset of AI');
  cache.set('weather forecast', 'Sunny with clouds');

  const similar = await cache.getSimilar('artificial intelligence fundamentals');
  assert.ok(similar.length > 0, 'Should find similar entries');
  assert.strictEqual(similar[0].value, 'ML is a subset of AI', 'Should find ML entry');
  assert.ok(similar[0].similarity >= 0.7, 'Similarity should meet threshold');
});

test('getSimilar respects threshold', async () => {
  const cache = createSemanticCache({ threshold: 0.9 });
  cache.set('banana fruit', 'Yellow fruit');
  cache.set('database query', 'SQL SELECT');

  const similar = await cache.getSimilar('database SQL', 0.9);
  const dissimilar = similar.find(s => s.key === 'banana fruit');

  assert.ok(!dissimilar || dissimilar.similarity < 0.9, 'Should not include low similarity items');
});

test('similar queries return cached values', async () => {
  const cache = createSemanticCache({ threshold: 0.8 });
  cache.set('What is Node.js?', 'JavaScript runtime');

  // Query with similar meaning
  const result = await await cache.get('Tell me about Node.js');

  // Should find similar entry
  const similar = await cache.getSimilar('Tell me about Node.js', 0.8);
  assert.ok(similar.length > 0, 'Should find similar entry');
  assert.ok(similar[0].similarity >= 0.8, 'Similarity should be high');
});

test('getSimilar returns empty array when no similar entries', async () => {
  const cache = createSemanticCache({ threshold: 0.95 });
  cache.set('apple fruit', 'Red fruit');

  const similar = await cache.getSimilar('quantum physics theory', 0.95);
  assert.strictEqual(similar.length, 0, 'Should return empty array for dissimilar queries');
});

test('getSimilar returns results sorted by similarity', async () => {
  const cache = createSemanticCache({ threshold: 0.5 });
  cache.set('machine learning', 'ML algorithms');
  cache.set('deep learning', 'Neural networks');
  cache.set('artificial intelligence', 'AI systems');

  const similar = await cache.getSimilar('AI and ML', 0.5);

  // Check that results are sorted in descending order
  for (let i = 1; i < similar.length; i++) {
    assert.ok(
      similar[i - 1].similarity >= similar[i].similarity,
      'Results should be sorted by similarity descending'
    );
  }
});

// ============================================================================
// TTL and Eviction Tests
// ============================================================================

test('expired entries are not returned', async () => {
  const cache = createSemanticCache({ ttl: 100 }); // 100ms TTL
  cache.set('temp', 'temporary value');

  assert.strictEqual(await await cache.get('temp'), 'temporary value', 'Should get value immediately');

  await wait(150); // Wait for expiration

  const result = await await cache.get('temp');
  assert.strictEqual(result, null, 'Should return null after TTL expires');
  assert.strictEqual(cache.has('temp'), false, 'Has should return false after expiration');
});

test('expired entries are removed from size count', async () => {
  const cache = createSemanticCache({ ttl: 100 });
  cache.set('key1', 'value1');
  cache.set('key2', 'value2');

  assert.strictEqual(cache.size(), 2, 'Should have 2 entries initially');

  await wait(150);

  // Trigger cleanup by accessing cache
  await cache.get('key1');

  assert.strictEqual(cache.size(), 0, 'Size should be 0 after expiration');
});

test('maxSize triggers eviction', async () => {
  const cache = createSemanticCache({ maxSize: 3 });

  cache.set('key1', 'value1');
  cache.set('key2', 'value2');
  cache.set('key3', 'value3');

  assert.strictEqual(cache.size(), 3, 'Should have 3 entries');

  // Add 4th entry, should evict oldest
  cache.set('key4', 'value4');

  assert.strictEqual(cache.size(), 3, 'Should still have 3 entries');
  assert.strictEqual(cache.has('key1'), false, 'Oldest entry should be evicted');
  assert.strictEqual(cache.has('key4'), true, 'Newest entry should exist');
});

test('maxSize evicts LRU entries', async () => {
  const cache = createSemanticCache({ maxSize: 3 });

  cache.set('key1', 'value1');
  cache.set('key2', 'value2');
  cache.set('key3', 'value3');

  // Access key1 to make it recently used
  await cache.get('key1');

  // Add new entry
  cache.set('key4', 'value4');

  // key2 should be evicted (least recently used)
  assert.strictEqual(cache.has('key1'), true, 'Recently accessed key1 should remain');
  assert.strictEqual(cache.has('key2'), false, 'LRU key2 should be evicted');
  assert.strictEqual(cache.has('key3'), true, 'key3 should remain');
  assert.strictEqual(cache.has('key4'), true, 'New key4 should exist');
});

test('setting existing key updates value without eviction', async () => {
  const cache = createSemanticCache({ maxSize: 2 });

  cache.set('key1', 'value1');
  cache.set('key2', 'value2');
  cache.set('key1', 'updated1'); // Update existing

  assert.strictEqual(cache.size(), 2, 'Size should remain 2');
  assert.strictEqual(await await cache.get('key1'), 'updated1', 'Value should be updated');
  assert.strictEqual(cache.has('key2'), true, 'key2 should not be evicted');
});

// ============================================================================
// Statistics Tests
// ============================================================================

test('stats tracks hits and misses', async () => {
  const cache = createSemanticCache();
  cache.set('key1', 'value1');

  // Initial stats
  let stats = cache.stats();
  assert.strictEqual(stats.hits, 0, 'Initial hits should be 0');
  assert.strictEqual(stats.misses, 0, 'Initial misses should be 0');

  // Hit
  await cache.get('key1');
  stats = cache.stats();
  assert.strictEqual(stats.hits, 1, 'Hits should be 1 after get');

  // Miss
  await cache.get('nonexistent');
  stats = cache.stats();
  assert.strictEqual(stats.misses, 1, 'Misses should be 1 after miss');

  // Another hit
  await cache.get('key1');
  stats = cache.stats();
  assert.strictEqual(stats.hits, 2, 'Hits should be 2 after second get');
});

test('hitRate calculates correctly', async () => {
  const cache = createSemanticCache();
  cache.set('key1', 'value1');

  await cache.get('key1'); // hit
  await cache.get('key1'); // hit
  await cache.get('missing'); // miss

  const stats = cache.stats();
  const expectedRate = 2 / 3; // 2 hits out of 3 total

  assert.ok(
    Math.abs(stats.hitRate - expectedRate) < 0.01,
    `Hit rate should be ~${expectedRate}, got ${stats.hitRate}`
  );
});

test('hitRate is 0 with no requests', async () => {
  const cache = createSemanticCache();
  const stats = cache.stats();
  assert.strictEqual(stats.hitRate, 0, 'Hit rate should be 0 with no requests');
});

test('hitRate is 1 with all hits', async () => {
  const cache = createSemanticCache();
  cache.set('key1', 'value1');

  await cache.get('key1');
  await cache.get('key1');
  await cache.get('key1');

  const stats = cache.stats();
  assert.strictEqual(stats.hitRate, 1, 'Hit rate should be 1 with all hits');
});

test('stats tracks cache size', async () => {
  const cache = createSemanticCache();

  let stats = cache.stats();
  assert.strictEqual(stats.size, 0, 'Initial size should be 0');

  cache.set('key1', 'value1');
  cache.set('key2', 'value2');

  stats = cache.stats();
  assert.strictEqual(stats.size, 2, 'Size should be 2 after adding entries');

  cache.delete('key1');

  stats = cache.stats();
  assert.strictEqual(stats.size, 1, 'Size should be 1 after delete');
});

test('resetStats clears statistics', async () => {
  const cache = createSemanticCache();
  cache.set('key1', 'value1');

  await cache.get('key1'); // hit
  await cache.get('missing'); // miss

  let stats = cache.stats();
  assert.strictEqual(stats.hits, 1, 'Should have 1 hit before reset');
  assert.strictEqual(stats.misses, 1, 'Should have 1 miss before reset');

  cache.resetStats();

  stats = cache.stats();
  assert.strictEqual(stats.hits, 0, 'Hits should be 0 after reset');
  assert.strictEqual(stats.misses, 0, 'Misses should be 0 after reset');
  assert.strictEqual(stats.size, 1, 'Size should remain unchanged after reset');
});

// ============================================================================
// Edge Cases and Integration Tests
// ============================================================================

test('handles empty string keys', async () => {
  const cache = createSemanticCache();
  cache.set('', 'empty key value');
  assert.strictEqual(await await cache.get(''), 'empty key value', 'Should handle empty string keys');
});

test('handles special characters in keys', async () => {
  const cache = createSemanticCache();
  const specialKey = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  cache.set(specialKey, 'special value');
  assert.strictEqual(await await cache.get(specialKey), 'special value', 'Should handle special characters');
});

test('handles unicode in keys', async () => {
  const cache = createSemanticCache();
  cache.set('你好世界', '中文值');
  cache.set('🚀 emoji key', 'emoji value');

  assert.strictEqual(await await cache.get('你好世界'), '中文值', 'Should handle Chinese characters');
  assert.strictEqual(await await cache.get('🚀 emoji key'), 'emoji value', 'Should handle emoji');
});

test('handles different value types', async () => {
  const cache = createSemanticCache();

  cache.set('string', 'text');
  cache.set('number', 42);
  cache.set('boolean', true);
  cache.set('object', { key: 'value' });
  cache.set('array', [1, 2, 3]);
  cache.set('null', null);

  assert.strictEqual(await await cache.get('string'), 'text');
  assert.strictEqual(await await cache.get('number'), 42);
  assert.strictEqual(await await cache.get('boolean'), true);
  assert.deepStrictEqual(await await cache.get('object'), { key: 'value' });
  assert.deepStrictEqual(await await cache.get('array'), [1, 2, 3]);
  assert.strictEqual(await await cache.get('null'), null);
});

test('concurrent operations maintain consistency', async () => {
  const cache = createSemanticCache();

  // Simulate concurrent sets and gets
  for (let i = 0; i < 100; i++) {
    cache.set(`key${i}`, `value${i}`);
  }

  for (let i = 0; i < 100; i++) {
    assert.strictEqual(await await cache.get(`key${i}`), `value${i}`, `Key${i} should have correct value`);
  }

  assert.strictEqual(cache.size(), 100, 'Should have 100 entries');
});

test('createSemanticCache factory creates working cache', async () => {
  const cache1 = createSemanticCache();
  const cache2 = createSemanticCache({ threshold: 0.8, maxSize: 100, ttl: 5000 });

  cache1.set('key', 'value1');
  cache2.set('key', 'value2');

  assert.strictEqual(cache1.get('key'), 'value1', 'Cache1 should have its own data');
  assert.strictEqual(cache2.get('key'), 'value2', 'Cache2 should have its own data');
});

test('class constructor creates working cache', async () => {
  const cache = new SemanticCache({ threshold: 0.75 });
  cache.set('test', 'value');

  assert.strictEqual(await await cache.get('test'), 'value', 'Class-based cache should work');
});

// ============================================================================
// Run Tests
// ============================================================================

async function runTests() {
  console.log(`Running ${tests.length} tests...\n`);

  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    try {
      await t.fn();
      console.log(`✓ ${t.name}`);
      passed++;
    } catch (e: any) {
      console.log(`✗ ${t.name}`);
      console.log(`  ${e.message}`);
      if (e.stack) {
        const stackLines = e.stack.split('\n').slice(1, 3);
        stackLines.forEach((line: string) => console.log(`  ${line.trim()}`));
      }
      failed++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`Total: ${tests.length} tests`);
  console.log(`Success rate: ${((passed / tests.length) * 100).toFixed(1)}%`);
  console.log(`${'='.repeat(60)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
