/**
 * Production Health and Monitoring Service
 * Provides comprehensive health checks and performance monitoring for production deployment
 */

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  timestamp: string;
  error?: string;
}

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheckResult[];
  performance: {
    bundleSize: string;
    loadTime: number;
    memoryUsage: number;
  };
}

export class ProductionHealthService {
  private static instance: ProductionHealthService;
  
  public static getInstance(): ProductionHealthService {
    if (!ProductionHealthService.instance) {
      ProductionHealthService.instance = new ProductionHealthService();
    }
    return ProductionHealthService.instance;
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<SystemHealth> {
    const checks: HealthCheckResult[] = [];
    const startTime = Date.now();

    // Check external API endpoints
    checks.push(await this.checkLaunchLibraryAPI());
    checks.push(await this.checkOpenWeatherAPI());
    checks.push(await this.checkLocalServices());

    const overall = this.determineOverallHealth(checks);
    
    return {
      overall,
      checks,
      performance: {
        bundleSize: await this.getBundleSize(),
        loadTime: Date.now() - startTime,
        memoryUsage: this.getMemoryUsage()
      }
    };
  }

  /**
   * Check Launch Library API health
   */
  private async checkLaunchLibraryAPI(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const response = await fetch('https://ll.thespacedevs.com/2.2.0/launch/upcoming/?format=json&limit=1', {
        method: 'GET',
        timeout: 10000
      } as any);

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return {
          service: 'Launch Library API',
          status: 'healthy',
          responseTime,
          timestamp: new Date().toISOString()
        };
      } else {
        return {
          service: 'Launch Library API',
          status: 'degraded',
          responseTime,
          timestamp: new Date().toISOString(),
          error: `HTTP ${response.status}`
        };
      }
    } catch (error) {
      return {
        service: 'Launch Library API',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check OpenWeather API health
   */
  private async checkOpenWeatherAPI(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const apiKey = process.env.REACT_APP_OPENWEATHER_API_KEY;
    
    if (!apiKey) {
      return {
        service: 'OpenWeather API',
        status: 'degraded',
        responseTime: 0,
        timestamp: new Date().toISOString(),
        error: 'API key not configured'
      };
    }

    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=Hamilton,BM&appid=${apiKey}`,
        { method: 'GET', timeout: 10000 } as any
      );

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return {
          service: 'OpenWeather API',
          status: 'healthy',
          responseTime,
          timestamp: new Date().toISOString()
        };
      } else {
        return {
          service: 'OpenWeather API',
          status: 'degraded',
          responseTime,
          timestamp: new Date().toISOString(),
          error: `HTTP ${response.status}`
        };
      }
    } catch (error) {
      return {
        service: 'OpenWeather API',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check local services and application state
   */
  private async checkLocalServices(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Test local storage access
      localStorage.setItem('health-check', 'test');
      localStorage.removeItem('health-check');

      // Test basic application functionality
      const appElement = document.getElementById('root');
      if (!appElement) {
        throw new Error('Root element not found');
      }

      return {
        service: 'Local Services',
        status: 'healthy',
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        service: 'Local Services',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Determine overall system health based on individual checks
   */
  private determineOverallHealth(checks: HealthCheckResult[]): 'healthy' | 'degraded' | 'unhealthy' {
    const unhealthyCount = checks.filter(check => check.status === 'unhealthy').length;
    const degradedCount = checks.filter(check => check.status === 'degraded').length;

    if (unhealthyCount > 0) {
      return 'unhealthy';
    } else if (degradedCount > 0) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  /**
   * Get estimated bundle size
   */
  private async getBundleSize(): Promise<string> {
    try {
      // This is a rough estimate - in production, you'd want to implement
      // more sophisticated bundle analysis
      const scripts = document.querySelectorAll('script[src]');
      return `~${scripts.length * 50}KB (estimated)`;
    } catch {
      return 'Unknown';
    }
  }

  /**
   * Get memory usage information
   */
  private getMemoryUsage(): number {
    try {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        return Math.round(memory.usedJSHeapSize / 1024 / 1024); // MB
      }
    } catch {
      // Memory API not available
    }
    return 0;
  }

  /**
   * Log health check results for monitoring
   */
  logHealthStatus(health: SystemHealth): void {
    if (process.env.NODE_ENV === 'production') {
      // Health check results available via getHealthReport()
      // Production monitoring would send this data to external service
    }
  }

  /**
   * Setup periodic health monitoring
   */
  startHealthMonitoring(intervalMinutes: number = 30): void {
    if (process.env.NODE_ENV === 'production') {
      setInterval(async () => {
        const health = await this.performHealthCheck();
        this.logHealthStatus(health);
        
        // In a production environment, you might want to send this data
        // to an external monitoring service like DataDog, New Relic, etc.
      }, intervalMinutes * 60 * 1000);
    }
  }
}

// Export singleton instance
export const healthService = ProductionHealthService.getInstance();