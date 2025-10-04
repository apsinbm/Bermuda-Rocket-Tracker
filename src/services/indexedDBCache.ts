/**
 * IndexedDB Cache Service
 * Advanced caching layer for Flight Club telemetry data and visibility calculations
 * Implements intelligent cache management, TTL, and data compression
 */

import { Launch, LaunchWithFlightClub, VisibilityData, LaunchMatch } from '../types';

const INDEXED_DB_SUPPORTED = typeof indexedDB !== 'undefined';

const warnIndexedDBUnavailable = (() => {
  let warned = false;
  return () => {
    if (!INDEXED_DB_SUPPORTED && !warned) {
      // eslint-disable-next-line no-console
      console.warn('[IndexedDBCache] IndexedDB is not available in this environment. Falling back to in-memory caching.');
      warned = true;
    }
  };
})();

// Cache configuration
const DB_NAME = 'BermudaRocketTrackerCache';
const DB_VERSION = 2;
const STORES = {
  FLIGHT_CLUB_DATA: 'flightClubData',
  VISIBILITY_CACHE: 'visibilityCache', 
  LAUNCH_MATCHES: 'launchMatches',
  TELEMETRY_DATA: 'telemetryData',
  CACHE_METADATA: 'cacheMetadata'
} as const;

// Cache TTL settings (in milliseconds)
const CACHE_DURATIONS = {
  FLIGHT_CLUB_MATCH: 24 * 60 * 60 * 1000,      // 24 hours - matches are stable
  TELEMETRY_DATA: 7 * 24 * 60 * 60 * 1000,     // 7 days - telemetry rarely changes
  VISIBILITY_CALCULATION: 6 * 60 * 60 * 1000,   // 6 hours - recalculate for accuracy
  LAUNCH_DATA: 2 * 60 * 60 * 1000,              // 2 hours - launch data can change
  METADATA: 30 * 24 * 60 * 60 * 1000            // 30 days - metadata cleanup
} as const;

// Cached data interfaces
interface CachedFlightClubData {
  key?: string;
  launchId: string;
  missionId: string;
  telemetryData: any; // ProcessedSimulationData from Flight Club API
  cached: number;
  expires: number;
  dataSize: number;
}

interface CachedVisibilityData {
  key?: string;
  launchId: string;
  visibilityData: VisibilityData;
  inputHash: string; // Hash of launch data to detect changes
  cached: number;
  expires: number;
  dataSource: 'flightclub' | 'calculated' | 'estimated';
}

interface CachedLaunchMatch {
  key?: string;
  launchId: string;
  match: LaunchMatch | null;
  cached: number;
  expires: number;
  confidence: string;
}

interface CacheMetadata {
  key: string;
  store: string;
  size: number;
  created: number;
  accessed: number;
  hits: number;
}

interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  stores: Record<string, {
    entries: number;
    size: number;
    oldestEntry: number;
    newestEntry: number;
  }>;
}

class IndexedDBCacheService {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;
  private stats = {
    hits: 0,
    misses: 0,
    writes: 0,
    evictions: 0
  };

  /**
   * Initialize the IndexedDB database
   */
  private async initDB(): Promise<IDBDatabase> {
    if (!INDEXED_DB_SUPPORTED) {
      warnIndexedDBUnavailable();
      throw new Error('IndexedDB is not supported in this environment');
    }

    if (this.db) {
      return this.db;
    }

    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[IndexedDBCache] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[IndexedDBCache] Database opened successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        console.log('[IndexedDBCache] Upgrading database schema');

        // Create object stores
        Object.entries(STORES).forEach(([key, storeName]) => {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, { keyPath: 'key' });
            
            // Add indexes based on store type
            if (storeName === STORES.FLIGHT_CLUB_DATA) {
              store.createIndex('launchId', 'launchId', { unique: false });
              store.createIndex('expires', 'expires', { unique: false });
            } else if (storeName === STORES.VISIBILITY_CACHE) {
              store.createIndex('launchId', 'launchId', { unique: false });
              store.createIndex('dataSource', 'dataSource', { unique: false });
              store.createIndex('expires', 'expires', { unique: false });
            } else if (storeName === STORES.LAUNCH_MATCHES) {
              store.createIndex('launchId', 'launchId', { unique: true });
              store.createIndex('confidence', 'confidence', { unique: false });
            } else if (storeName === STORES.CACHE_METADATA) {
              store.createIndex('store', 'store', { unique: false });
              store.createIndex('created', 'created', { unique: false });
              store.createIndex('accessed', 'accessed', { unique: false });
            }

            console.log(`[IndexedDBCache] Created store: ${storeName}`);
          }
        });
      };
    });

    return this.dbPromise;
  }

  /**
   * Generic method to get data from a store
   */
  private async get<T>(storeName: string, key: string): Promise<T | null> {
    if (!INDEXED_DB_SUPPORTED) {
      warnIndexedDBUnavailable();
      return null;
    }

    try {
      const db = await this.initDB();
      const transaction = db.transaction([storeName, STORES.CACHE_METADATA], 'readwrite');
      const store = transaction.objectStore(storeName);
      const metadataStore = transaction.objectStore(STORES.CACHE_METADATA);

      const request = store.get(key);
      const result = await new Promise<T | null>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });

      if (result) {
        // Update access metadata
        const metadata: CacheMetadata = {
          key,
          store: storeName,
          size: JSON.stringify(result).length,
          created: (result as any).cached || Date.now(),
          accessed: Date.now(),
          hits: ((await this.getMetadata(key))?.hits || 0) + 1
        };
        
        await this.putMetadata(metadataStore, metadata);
        this.stats.hits++;
        
        console.log(`[IndexedDBCache] Cache hit: ${storeName}/${key}`);
        return result;
      } else {
        this.stats.misses++;
        console.log(`[IndexedDBCache] Cache miss: ${storeName}/${key}`);
        return null;
      }
    } catch (error) {
      console.error(`[IndexedDBCache] Error getting ${storeName}/${key}:`, error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Generic method to put data into a store
   */
  private async put<T extends { key?: string }>(
    storeName: string, 
    key: string, 
    data: T, 
    ttlMs?: number
  ): Promise<void> {
    if (!INDEXED_DB_SUPPORTED) {
      warnIndexedDBUnavailable();
      return;
    }

    try {
      const db = await this.initDB();
      const transaction = db.transaction([storeName, STORES.CACHE_METADATA], 'readwrite');
      const store = transaction.objectStore(storeName);
      const metadataStore = transaction.objectStore(STORES.CACHE_METADATA);

      const now = Date.now();
      const dataWithKey = {
        ...data,
        key,
        cached: now,
        expires: ttlMs ? now + ttlMs : now + CACHE_DURATIONS.METADATA
      };

      const request = store.put(dataWithKey);
      await new Promise<void>((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      // Update metadata
      const metadata: CacheMetadata = {
        key,
        store: storeName,
        size: JSON.stringify(dataWithKey).length,
        created: now,
        accessed: now,
        hits: 1
      };

      await this.putMetadata(metadataStore, metadata);
      this.stats.writes++;
      
      console.log(`[IndexedDBCache] Cached: ${storeName}/${key} (${metadata.size} bytes)`);
    } catch (error) {
      console.error(`[IndexedDBCache] Error putting ${storeName}/${key}:`, error);
    }
  }

  /**
   * Helper to manage metadata
   */
  private async getMetadata(key: string): Promise<CacheMetadata | null> {
    if (!INDEXED_DB_SUPPORTED) {
      warnIndexedDBUnavailable();
      return null;
    }

    try {
      const db = await this.initDB();
      const transaction = db.transaction([STORES.CACHE_METADATA], 'readonly');
      const store = transaction.objectStore(STORES.CACHE_METADATA);
      
      const request = store.get(key);
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`[IndexedDBCache] Error getting metadata for ${key}:`, error);
      return null;
    }
  }

  private async putMetadata(store: IDBObjectStore, metadata: CacheMetadata): Promise<void> {
    const request = store.put({ ...metadata, key: metadata.key });
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Cache Flight Club telemetry data
   */
  async cacheFlightClubData(launchId: string, missionId: string, telemetryData: any): Promise<void> {
    if (!INDEXED_DB_SUPPORTED) {
      warnIndexedDBUnavailable();
      return;
    }

    const key = `${launchId}-${missionId}`;
    const cachedData: CachedFlightClubData = {
      launchId,
      missionId,
      telemetryData,
      cached: Date.now(),
      expires: Date.now() + CACHE_DURATIONS.TELEMETRY_DATA,
      dataSize: JSON.stringify(telemetryData).length
    };

    await this.put(STORES.FLIGHT_CLUB_DATA, key, cachedData, CACHE_DURATIONS.TELEMETRY_DATA);
  }

  /**
   * Get cached Flight Club telemetry data
   */
  async getFlightClubData(launchId: string, missionId: string): Promise<any | null> {
    if (!INDEXED_DB_SUPPORTED) {
      warnIndexedDBUnavailable();
      return null;
    }

    const key = `${launchId}-${missionId}`;
    const cached = await this.get<CachedFlightClubData>(STORES.FLIGHT_CLUB_DATA, key);
    
    if (cached && Date.now() < cached.expires) {
      console.log(`[IndexedDBCache] Using cached Flight Club data for ${launchId}`);
      return cached.telemetryData;
    } else if (cached) {
      console.log(`[IndexedDBCache] Flight Club data expired for ${launchId}, will refresh`);
      await this.delete(STORES.FLIGHT_CLUB_DATA, key);
    }
    
    return null;
  }

  /**
   * Cache visibility calculation results
   */
  async cacheVisibilityData(
    launchId: string, 
    visibilityData: VisibilityData, 
    inputHash: string
  ): Promise<void> {
    if (!INDEXED_DB_SUPPORTED) {
      warnIndexedDBUnavailable();
      return;
    }

    const key = `visibility-${launchId}`;
    const cachedData: CachedVisibilityData = {
      launchId,
      visibilityData,
      inputHash,
      cached: Date.now(),
      expires: Date.now() + CACHE_DURATIONS.VISIBILITY_CALCULATION,
      dataSource: visibilityData.dataSource || 'calculated'
    };

    await this.put(STORES.VISIBILITY_CACHE, key, cachedData, CACHE_DURATIONS.VISIBILITY_CALCULATION);
  }

  /**
   * Get cached visibility data
   */
  async getVisibilityData(launchId: string, inputHash: string): Promise<VisibilityData | null> {
    if (!INDEXED_DB_SUPPORTED) {
      warnIndexedDBUnavailable();
      return null;
    }

    const key = `visibility-${launchId}`;
    const cached = await this.get<CachedVisibilityData>(STORES.VISIBILITY_CACHE, key);
    
    if (cached && Date.now() < cached.expires && cached.inputHash === inputHash) {
      console.log(`[IndexedDBCache] Using cached visibility data for ${launchId} (${cached.dataSource})`);
      return cached.visibilityData;
    } else if (cached) {
      console.log(`[IndexedDBCache] Visibility data expired or changed for ${launchId}, will recalculate`);
      await this.delete(STORES.VISIBILITY_CACHE, key);
    }
    
    return null;
  }

  /**
   * Cache launch match results
   */
  async cacheLaunchMatch(launchId: string, match: LaunchMatch | null): Promise<void> {
    if (!INDEXED_DB_SUPPORTED) {
      warnIndexedDBUnavailable();
      return;
    }

    const key = `match-${launchId}`;
    const cachedData: CachedLaunchMatch = {
      launchId,
      match,
      cached: Date.now(),
      expires: Date.now() + CACHE_DURATIONS.FLIGHT_CLUB_MATCH,
      confidence: match?.confidence || 'none'
    };

    await this.put(STORES.LAUNCH_MATCHES, key, cachedData, CACHE_DURATIONS.FLIGHT_CLUB_MATCH);
  }

  /**
   * Get cached launch match
   */
  async getLaunchMatch(launchId: string): Promise<LaunchMatch | null> {
    if (!INDEXED_DB_SUPPORTED) {
      warnIndexedDBUnavailable();
      return null;
    }

    const key = `match-${launchId}`;
    const cached = await this.get<CachedLaunchMatch>(STORES.LAUNCH_MATCHES, key);
    
    if (cached && Date.now() < cached.expires) {
      console.log(`[IndexedDBCache] Using cached launch match for ${launchId} (${cached.confidence})`);
      return cached.match;
    } else if (cached) {
      console.log(`[IndexedDBCache] Launch match expired for ${launchId}, will refresh`);
      await this.delete(STORES.LAUNCH_MATCHES, key);
    }
    
    return null;
  }

  /**
   * Delete an item from cache
   */
  private async delete(storeName: string, key: string): Promise<void> {
    if (!INDEXED_DB_SUPPORTED) {
      return;
    }

    try {
      const db = await this.initDB();
      const transaction = db.transaction([storeName, STORES.CACHE_METADATA], 'readwrite');
      const store = transaction.objectStore(storeName);
      const metadataStore = transaction.objectStore(STORES.CACHE_METADATA);

      store.delete(key);
      metadataStore.delete(key);
      
      console.log(`[IndexedDBCache] Deleted: ${storeName}/${key}`);
    } catch (error) {
      console.error(`[IndexedDBCache] Error deleting ${storeName}/${key}:`, error);
    }
  }

  /**
   * Clean up expired entries
   */
  async cleanup(): Promise<number> {
    if (!INDEXED_DB_SUPPORTED) {
      return 0;
    }

    try {
      const db = await this.initDB();
      const now = Date.now();
      let deletedCount = 0;

      for (const storeName of Object.values(STORES)) {
        if (storeName === STORES.CACHE_METADATA) continue;

        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const expiresIndex = store.index('expires');
        
        const request = expiresIndex.openCursor(IDBKeyRange.upperBound(now));
        
        await new Promise<void>((resolve, reject) => {
          request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result;
            if (cursor) {
              cursor.delete();
              deletedCount++;
              this.stats.evictions++;
              cursor.continue();
            } else {
              resolve();
            }
          };
          request.onerror = () => reject(request.error);
        });
      }

      if (deletedCount > 0) {
        console.log(`[IndexedDBCache] Cleaned up ${deletedCount} expired entries`);
      }

      return deletedCount;
    } catch (error) {
      console.error('[IndexedDBCache] Error during cleanup:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    if (!INDEXED_DB_SUPPORTED) {
      return {
        totalEntries: 0,
        totalSize: 0,
        hitRate: 0,
        stores: {}
      };
    }

    try {
      const db = await this.initDB();
      const stats: CacheStats = {
        totalEntries: 0,
        totalSize: 0,
        hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
        stores: {}
      };

      for (const storeName of Object.values(STORES)) {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        
        const count = await new Promise<number>((resolve, reject) => {
          const request = store.count();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });

        stats.stores[storeName] = {
          entries: count,
          size: 0, // Would need to iterate to calculate actual size
          oldestEntry: 0,
          newestEntry: 0
        };

        stats.totalEntries += count;
      }

      return stats;
    } catch (error) {
      console.error('[IndexedDBCache] Error getting stats:', error);
      return {
        totalEntries: 0,
        totalSize: 0,
        hitRate: 0,
        stores: {}
      };
    }
  }

  /**
   * Clear all cache data
   */
  async clear(): Promise<void> {
    if (!INDEXED_DB_SUPPORTED) {
      this.stats = { hits: 0, misses: 0, writes: 0, evictions: 0 };
      return;
    }

    try {
      const db = await this.initDB();
      
      for (const storeName of Object.values(STORES)) {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        await new Promise<void>((resolve, reject) => {
          const request = store.clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }

      this.stats = { hits: 0, misses: 0, writes: 0, evictions: 0 };
      console.log('[IndexedDBCache] All cache data cleared');
    } catch (error) {
      console.error('[IndexedDBCache] Error clearing cache:', error);
    }
  }

  /**
   * Create a hash for cache validation
   */
  createHash(data: any): string {
    const payload = JSON.stringify(data);
    if (typeof btoa === 'function') {
      return btoa(payload).slice(0, 16);
    }

    const bufferFactory = (globalThis as any)?.Buffer;
    if (bufferFactory) {
      return bufferFactory.from(payload).toString('base64').slice(0, 16);
    }

    // Fallback: no hashing available, use plain string slice
    return payload.slice(0, 16);
  }
}

// Export singleton instance
export const indexedDBCache = new IndexedDBCacheService();

// Export types for use in other services
export type { CacheStats, CachedFlightClubData, CachedVisibilityData, CachedLaunchMatch };
