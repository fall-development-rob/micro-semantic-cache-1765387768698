/**
 * Storage backend interface for pluggable cache storage implementations
 * @template T - The type of values stored in the cache
 */
export interface StorageBackend<T> {
  /**
   * Retrieve a value from storage by key
   * @param key - The storage key
   * @returns The stored value or undefined if not found
   */
  get(key: string): T | undefined;

  /**
   * Store a value in storage with the given key
   * @param key - The storage key
   * @param value - The value to store
   */
  set(key: string, value: T): void;

  /**
   * Check if a key exists in storage
   * @param key - The storage key to check
   * @returns True if the key exists, false otherwise
   */
  has(key: string): boolean;

  /**
   * Delete a value from storage by key
   * @param key - The storage key to delete
   * @returns True if the key existed and was deleted, false otherwise
   */
  delete(key: string): boolean;

  /**
   * Clear all entries from storage
   */
  clear(): void;

  /**
   * Get the number of entries in storage
   * @returns The count of stored entries
   */
  size(): number;

  /**
   * Get an iterator of all storage keys
   * @returns Iterator of keys
   */
  keys(): IterableIterator<string>;

  /**
   * Get an iterator of all storage values
   * @returns Iterator of values
   */
  values(): IterableIterator<T>;

  /**
   * Get an iterator of all storage entries
   * @returns Iterator of [key, value] tuples
   */
  entries(): IterableIterator<[string, T]>;
}

/**
 * In-memory storage backend implementation using JavaScript Map
 * @template T - The type of values stored in the cache
 */
export class InMemoryBackend<T> implements StorageBackend<T> {
  private store: Map<string, T>;

  constructor() {
    this.store = new Map<string, T>();
  }

  get(key: string): T | undefined {
    return this.store.get(key);
  }

  set(key: string, value: T): void {
    this.store.set(key, value);
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }

  keys(): IterableIterator<string> {
    return this.store.keys();
  }

  values(): IterableIterator<T> {
    return this.store.values();
  }

  entries(): IterableIterator<[string, T]> {
    return this.store.entries();
  }
}

/**
 * Factory function to create a new in-memory storage backend
 * @template T - The type of values to be stored
 * @returns A new InMemoryBackend instance
 */
export function createInMemoryBackend<T>(): StorageBackend<T> {
  return new InMemoryBackend<T>();
}
