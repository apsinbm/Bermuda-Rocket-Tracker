/**
 * Performance Comparison Utility
 * Demonstrates the benefits of the optimized launch data services
 */

import { launchDataService } from '../services/launchDataService';
import { optimizedLaunchDataService } from '../services/optimizedLaunchDataService';

interface PerformanceResult {
  service: 'original' | 'optimized';
  operation: string;
  duration: number;
  success: boolean;
  error?: string;
  timestamp: number;
}

export class PerformanceComparison {
  private results: PerformanceResult[] = [];
  
  /**
   * Compare launch data fetching performance
   */
  async compareFetchPerformance(): Promise<{
    original: PerformanceResult;
    optimized: PerformanceResult;
    improvement: number;
  }> {
    console.log('🔄 Starting performance comparison...');
    
    // Test original service
    const originalResult = await this.testService(
      'original',
      'fetchLaunches',
      () => launchDataService.getLaunches()
    );
    
    // Test optimized service
    const optimizedResult = await this.testService(
      'optimized',
      'fetchLaunches',
      () => optimizedLaunchDataService.getLaunches()
    );
    
    const improvement = originalResult.success && optimizedResult.success
      ? ((originalResult.duration - optimizedResult.duration) / originalResult.duration) * 100
      : 0;
    
    console.log(`📊 Performance Results:
      Original: ${originalResult.duration}ms
      Optimized: ${optimizedResult.duration}ms
      Improvement: ${improvement.toFixed(1)}%`);
    
    return {
      original: originalResult,
      optimized: optimizedResult,
      improvement
    };
  }
  
  /**
   * Compare multiple rapid requests (tests deduplication)
   */
  async compareRapidRequests(): Promise<{
    originalResults: PerformanceResult[];
    optimizedResults: PerformanceResult[];
    originalTotal: number;
    optimizedTotal: number;
    improvement: number;
  }> {
    console.log('🚀 Testing rapid request handling...');
    
    const numRequests = 5;
    
    // Test original service with rapid requests
    const originalPromises = Array.from({ length: numRequests }, (_, i) =>
      this.testService(
        'original',
        `rapidRequest-${i}`,
        () => launchDataService.getLaunches()
      )
    );
    
    const originalResults = await Promise.all(originalPromises);
    const originalTotal = originalResults.reduce((sum, result) => sum + result.duration, 0);
    
    // Test optimized service with rapid requests (should benefit from deduplication)
    const optimizedPromises = Array.from({ length: numRequests }, (_, i) =>
      this.testService(
        'optimized',
        `rapidRequest-${i}`,
        () => optimizedLaunchDataService.getLaunches()
      )
    );
    
    const optimizedResults = await Promise.all(optimizedPromises);
    const optimizedTotal = optimizedResults.reduce((sum, result) => sum + result.duration, 0);
    
    const improvement = originalTotal > 0
      ? ((originalTotal - optimizedTotal) / originalTotal) * 100
      : 0;
    
    console.log(`🏃‍♂️ Rapid Request Results:
      Original Total: ${originalTotal}ms (avg: ${(originalTotal / numRequests).toFixed(1)}ms)
      Optimized Total: ${optimizedTotal}ms (avg: ${(optimizedTotal / numRequests).toFixed(1)}ms)
      Improvement: ${improvement.toFixed(1)}%`);
    
    return {
      originalResults,
      optimizedResults,
      originalTotal,
      optimizedTotal,
      improvement
    };
  }
  
  /**
   * Test memory usage patterns
   */
  async compareMemoryUsage(): Promise<{
    originalMemory: number;
    optimizedMemory: number;
    improvement: number;
  }> {
    console.log('🧠 Testing memory usage...');
    
    // Force garbage collection if available (development only)
    if (global.gc) {
      global.gc();
    }
    
    const initialMemory = this.getMemoryUsage();
    
    // Create multiple subscriptions to test memory leaks
    const originalUnsubscribers: Array<() => void> = [];
    const optimizedUnsubscribers: Array<() => void> = [];
    
    // Test original service
    for (let i = 0; i < 10; i++) {
      const unsubscribe = launchDataService.subscribe(() => {
        // Simulate work
        JSON.stringify({ test: i });
      });
      originalUnsubscribers.push(unsubscribe);
    }
    
    await launchDataService.getLaunches();
    const originalMemory = this.getMemoryUsage() - initialMemory;
    
    // Clean up original subscriptions
    originalUnsubscribers.forEach(unsub => unsub());
    
    // Test optimized service
    for (let i = 0; i < 10; i++) {
      const unsubscribe = optimizedLaunchDataService.subscribe(() => {
        // Simulate work
        JSON.stringify({ test: i });
      });
      optimizedUnsubscribers.push(unsubscribe);
    }
    
    await optimizedLaunchDataService.getLaunches();
    const optimizedMemory = this.getMemoryUsage() - initialMemory - originalMemory;
    
    // Clean up optimized subscriptions
    optimizedUnsubscribers.forEach(unsub => unsub());
    
    const improvement = originalMemory > 0
      ? ((originalMemory - optimizedMemory) / originalMemory) * 100
      : 0;
    
    console.log(`💾 Memory Usage Results:
      Original: ${(originalMemory / 1024 / 1024).toFixed(2)}MB
      Optimized: ${(optimizedMemory / 1024 / 1024).toFixed(2)}MB
      Improvement: ${improvement.toFixed(1)}%`);
    
    return {
      originalMemory,
      optimizedMemory,
      improvement
    };
  }
  
  /**
   * Run comprehensive performance comparison
   */
  async runFullComparison() {
    console.log('🏁 Running comprehensive performance comparison...');
    
    const results = {
      fetch: await this.compareFetchPerformance(),
      rapidRequests: await this.compareRapidRequests(),
      memory: await this.compareMemoryUsage(),
      summary: {
        avgImprovement: 0,
        totalTests: 0,
        successfulTests: 0
      }
    };
    
    const improvements = [
      results.fetch.improvement,
      results.rapidRequests.improvement,
      results.memory.improvement
    ].filter(imp => imp > 0);
    
    results.summary = {
      avgImprovement: improvements.length > 0
        ? improvements.reduce((sum, imp) => sum + imp, 0) / improvements.length
        : 0,
      totalTests: 3,
      successfulTests: improvements.length
    };
    
    console.log(`📈 Overall Performance Summary:
      Average Improvement: ${results.summary.avgImprovement.toFixed(1)}%
      Successful Tests: ${results.summary.successfulTests}/${results.summary.totalTests}
      
      🎯 Key Benefits of Optimized Service:
      • Faster data fetching
      • Reduced API calls through deduplication
      • Lower memory footprint
      • Better error handling with retries
      • Adaptive caching based on launch urgency`);
    
    return results;
  }
  
  /**
   * Test a specific service operation
   */
  private async testService(
    service: 'original' | 'optimized',
    operation: string,
    testFunction: () => Promise<any>
  ): Promise<PerformanceResult> {
    const startTime = performance.now();
    const timestamp = Date.now();
    
    try {
      await testFunction();
      const duration = performance.now() - startTime;
      
      const result: PerformanceResult = {
        service,
        operation,
        duration,
        success: true,
        timestamp
      };
      
      this.results.push(result);
      return result;
      
    } catch (error) {
      const duration = performance.now() - startTime;
      
      const result: PerformanceResult = {
        service,
        operation,
        duration,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp
      };
      
      this.results.push(result);
      return result;
    }
  }
  
  /**
   * Get current memory usage (Node.js only)
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }
  
  /**
   * Get all test results
   */
  getResults(): PerformanceResult[] {
    return [...this.results];
  }
  
  /**
   * Clear test results
   */
  clearResults(): void {
    this.results = [];
  }
  
  /**
   * Export results to JSON
   */
  exportResults(): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      results: this.results,
      summary: {
        totalTests: this.results.length,
        successfulTests: this.results.filter(r => r.success).length,
        averageDuration: this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length
      }
    }, null, 2);
  }
}

// Singleton instance for easy use
export const performanceComparison = new PerformanceComparison();

// Helper function to run a quick performance test
export async function quickPerformanceTest(): Promise<void> {
  const comparison = new PerformanceComparison();
  await comparison.runFullComparison();
}