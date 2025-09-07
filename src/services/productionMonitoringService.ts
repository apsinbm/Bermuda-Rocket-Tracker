/**
 * Production monitoring service
 * Tracks performance metrics, errors, and user analytics for deployed application
 */

import { config } from '../config/environment';

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  url: string;
}

interface ErrorReport {
  message: string;
  stack?: string;
  timestamp: number;
  url: string;
  userAgent: string;
  userId?: string;
}

interface ApiMetric {
  endpoint: string;
  method: string;
  status: number;
  duration: number;
  timestamp: number;
}

type StoredMetric = PerformanceMetric | ErrorReport | ApiMetric;

class ProductionMonitoringService {
  private performanceObserver: PerformanceObserver | null = null;
  private errorReports: ErrorReport[] = [];
  private apiMetrics: ApiMetric[] = [];

  constructor() {
    if (config.enablePerformanceMonitoring) {
      this.initializeMonitoring();
    }
  }

  private initializeMonitoring(): void {
    // Performance monitoring
    this.initializePerformanceObserver();
    
    // Error tracking
    this.initializeErrorTracking();
    
    // API monitoring
    this.initializeApiMonitoring();
    
    // Periodic reporting
    this.startPeriodicReporting();
  }

  private initializePerformanceObserver(): void {
    if ('PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          this.recordPerformanceMetric({
            name: entry.name,
            value: entry.duration || 0,
            timestamp: Date.now(),
            url: window.location.href,
          });
        });
      });

      this.performanceObserver.observe({
        type: 'navigation',
        buffered: true,
      });

      this.performanceObserver.observe({
        type: 'largest-contentful-paint',
        buffered: true,
      });

      this.performanceObserver.observe({
        type: 'first-input',
        buffered: true,
      });
    }
  }

  private initializeErrorTracking(): void {
    window.addEventListener('error', (event) => {
      this.recordError({
        message: event.message,
        stack: event.error?.stack,
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.recordError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      });
    });
  }

  private initializeApiMonitoring(): void {
    // Intercept fetch calls to monitor API performance
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = Date.now();
      const url = args[0] as string;
      const options = args[1] || {};
      
      try {
        const response = await originalFetch(...args);
        const duration = Date.now() - startTime;
        
        this.recordApiMetric({
          endpoint: url,
          method: options.method || 'GET',
          status: response.status,
          duration,
          timestamp: Date.now(),
        });
        
        return response;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        this.recordApiMetric({
          endpoint: url,
          method: options.method || 'GET',
          status: 0,
          duration,
          timestamp: Date.now(),
        });
        
        throw error;
      }
    };
  }

  private recordPerformanceMetric(metric: PerformanceMetric): void {
    // In production, send to analytics service
    
    // Store for periodic reporting
    localStorage.setItem(
      'brt_performance_metrics',
      JSON.stringify([
        ...this.getStoredMetrics('brt_performance_metrics'),
        metric,
      ].slice(-100)) // Keep last 100 metrics
    );
  }

  private recordError(error: ErrorReport): void {
    this.errorReports.push(error);
    
    if (config.logLevel === 'debug') {
      console.error('[Monitoring] Error:', error);
    }
    
    // Store for periodic reporting
    localStorage.setItem(
      'brt_error_reports',
      JSON.stringify([
        ...this.getStoredMetrics('brt_error_reports'),
        error,
      ].slice(-50)) // Keep last 50 errors
    );
  }

  private recordApiMetric(metric: ApiMetric): void {
    this.apiMetrics.push(metric);
    
    
    // Store for periodic reporting
    localStorage.setItem(
      'brt_api_metrics',
      JSON.stringify([
        ...this.getStoredMetrics('brt_api_metrics'),
        metric,
      ].slice(-100)) // Keep last 100 API calls
    );
  }

  private getStoredMetrics(key: string): StoredMetric[] {
    try {
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
      return [];
    }
  }

  private startPeriodicReporting(): void {
    // Report metrics every 5 minutes in production
    setInterval(() => {
      this.sendMetricsReport();
    }, 5 * 60 * 1000);
  }

  private sendMetricsReport(): void {
    const metrics = {
      performance: this.getStoredMetrics('brt_performance_metrics'),
      errors: this.getStoredMetrics('brt_error_reports'),
      api: this.getStoredMetrics('brt_api_metrics'),
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    // In a real production environment, you would send this to your analytics service
    // For now, we'll just log it

    // Clear old metrics after reporting
    localStorage.removeItem('brt_performance_metrics');
    localStorage.removeItem('brt_error_reports');
    localStorage.removeItem('brt_api_metrics');
    
    this.errorReports = [];
    this.apiMetrics = [];
  }

  public getHealthReport(): {
    performance: PerformanceMetric[];
    errors: ErrorReport[];
    api: ApiMetric[];
    uptime: number;
  } {
    return {
      performance: this.getStoredMetrics('brt_performance_metrics') as PerformanceMetric[],
      errors: this.getStoredMetrics('brt_error_reports') as ErrorReport[],
      api: this.getStoredMetrics('brt_api_metrics') as ApiMetric[],
      uptime: performance.now(),
    };
  }

  public cleanup(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
  }
}

// Export singleton instance
export const productionMonitoringService = new ProductionMonitoringService();