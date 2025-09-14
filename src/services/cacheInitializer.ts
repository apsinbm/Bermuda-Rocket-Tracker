/**
 * Cache Initialization Service
 * Handles cache startup, cleanup, and performance monitoring
 */

import { indexedDBCache } from './indexedDBCache';

class CacheInitializerService {
  private initialized = false;
  private cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize cache system on app startup
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      console.log('[CacheInit] Initializing cache system...');
      
      // Get initial stats
      const stats = await indexedDBCache.getStats();
      console.log(`[CacheInit] Cache initialized with ${stats.totalEntries} entries, ${stats.hitRate * 100}% hit rate`);
      
      // Clean up any expired entries on startup
      const deletedCount = await indexedDBCache.cleanup();
      if (deletedCount > 0) {
        console.log(`[CacheInit] Cleaned up ${deletedCount} expired cache entries on startup`);
      }
      
      // Set up periodic cleanup (every hour)
      this.cleanupInterval = setInterval(async () => {
        try {
          const cleaned = await indexedDBCache.cleanup();
          if (cleaned > 0) {
            console.log(`[CacheInit] Periodic cleanup removed ${cleaned} expired entries`);
          }
        } catch (error) {
          console.warn('[CacheInit] Periodic cleanup failed:', error);
        }
      }, 60 * 60 * 1000); // 1 hour
      
      this.initialized = true;
      console.log('[CacheInit] Cache system ready');
      
    } catch (error) {
      console.error('[CacheInit] Failed to initialize cache system:', error);
      // Don't throw - app should work without cache
    }
  }

  /**
   * Shutdown cache system (cleanup intervals)
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.initialized = false;
    console.log('[CacheInit] Cache system shut down');
  }

  /**
   * Get cache health status
   */
  async getHealth(): Promise<{
    initialized: boolean;
    totalEntries: number;
    hitRate: number;
    status: 'healthy' | 'warning' | 'error';
    message: string;
  }> {
    try {
      if (!this.initialized) {
        return {
          initialized: false,
          totalEntries: 0,
          hitRate: 0,
          status: 'warning',
          message: 'Cache not initialized'
        };
      }

      const stats = await indexedDBCache.getStats();
      
      let status: 'healthy' | 'warning' | 'error' = 'healthy';
      let message = 'Cache operating normally';
      
      // Check for potential issues
      if (stats.totalEntries > 10000) {
        status = 'warning';
        message = 'Large number of cached entries - consider cleanup';
      } else if (stats.hitRate < 0.3) {
        status = 'warning'; 
        message = 'Low cache hit rate - cache may not be effective';
      }
      
      return {
        initialized: this.initialized,
        totalEntries: stats.totalEntries,
        hitRate: stats.hitRate,
        status,
        message
      };
    } catch (error) {
      return {
        initialized: this.initialized,
        totalEntries: 0,
        hitRate: 0,
        status: 'error',
        message: `Cache health check failed: ${error}`
      };
    }
  }

  /**
   * Preload critical cache data (can be called on app startup)
   */
  async preloadCriticalData(): Promise<void> {
    try {
      console.log('[CacheInit] Preloading critical cache data...');
      
      // This is a placeholder for any critical data that should be preloaded
      // For now, we just verify the cache is working
      await indexedDBCache.getStats();
      
      console.log('[CacheInit] Critical data preload complete');
    } catch (error) {
      console.warn('[CacheInit] Failed to preload critical data:', error);
    }
  }

  /**
   * Force cache refresh (clear all data)
   */
  async forceRefresh(): Promise<void> {
    try {
      console.log('[CacheInit] Forcing cache refresh...');
      await indexedDBCache.clear();
      console.log('[CacheInit] Cache refresh complete');
    } catch (error) {
      console.error('[CacheInit] Cache refresh failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const cacheInitializer = new CacheInitializerService();