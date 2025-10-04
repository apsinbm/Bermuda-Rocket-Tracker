/**
 * Environment-specific configuration
 * Handles different settings for development, staging, and production
 */

export interface EnvironmentConfig {
  apiTimeout: number;
  cacheDuration: number;
  enablePerformanceMonitoring: boolean;
  enableDebugPanel: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  apiRetryAttempts: number;
  apiRetryDelay: number;
}

const isDevMode = process.env.NODE_ENV === 'development';
const isProdMode = process.env.NODE_ENV === 'production';

export const config: EnvironmentConfig = {
  // API timeout in milliseconds
  apiTimeout: isProdMode ? 10000 : 15000,
  
  // Cache duration in milliseconds (1 hour production, 5 minutes dev)
  cacheDuration: isProdMode ? 3600000 : 300000,
  
  // Performance monitoring
  enablePerformanceMonitoring: isProdMode || process.env.REACT_APP_ENABLE_PERFORMANCE_MONITORING === 'true',
  
  // Debug panel (only in development)
  enableDebugPanel: isDevMode,
  
  // Logging level
  logLevel: isProdMode ? 'warn' : 'debug',
  
  // API retry configuration
  apiRetryAttempts: isProdMode ? 3 : 2,
  apiRetryDelay: 1000,
};

// API endpoints configuration
export const apiConfig = {
  spaceDevsApi: {
    baseUrl: 'https://ll.thespacedevs.com/2.2.0',
    timeout: config.apiTimeout,
    retryAttempts: config.apiRetryAttempts,
  },
  openMeteoApi: {
    baseUrl: 'https://api.open-meteo.com/v1',
    timeout: config.apiTimeout,
    // No API key required - Open-Meteo is completely free
  },
};

// Export helper functions
export const isLocal = () => window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
export const isProduction = () => process.env.NODE_ENV === 'production';
export const isDevelopment = () => process.env.NODE_ENV === 'development';