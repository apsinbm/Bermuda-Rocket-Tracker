/**
 * Enhanced Error Handling Service
 * Provides robust error handling for network failures, API rate limits, and other issues
 */

// Type for error inputs that can be passed to error handling functions
export type ErrorInput = Error | string | unknown;

export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
  API_ERROR = 'API_ERROR',
  TIMEOUT = 'TIMEOUT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface ErrorDetails {
  type: ErrorType;
  message: string;
  statusCode?: number;
  retryAfter?: number; // seconds
  retryable: boolean;
  timestamp: number;
  context?: Record<string, unknown>;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
  jitter: boolean;
}

export interface ErrorHandlingMetrics {
  totalErrors: number;
  errorsByType: Record<ErrorType, number>;
  retryAttempts: number;
  successfulRetries: number;
  lastError?: ErrorDetails;
  averageRetryDelay: number;
}

export class ErrorHandlingService {
  private metrics: ErrorHandlingMetrics = {
    totalErrors: 0,
    errorsByType: {
      [ErrorType.NETWORK_ERROR]: 0,
      [ErrorType.RATE_LIMIT]: 0,
      [ErrorType.API_ERROR]: 0,
      [ErrorType.TIMEOUT]: 0,
      [ErrorType.VALIDATION_ERROR]: 0,
      [ErrorType.UNKNOWN_ERROR]: 0
    },
    retryAttempts: 0,
    successfulRetries: 0,
    averageRetryDelay: 0
  };

  private retryDelays: number[] = [];

  /**
   * Classify error based on various indicators
   */
  classifyError(error: ErrorInput, response?: Response): ErrorDetails {
    const timestamp = Date.now();
    let errorDetails: ErrorDetails;

    if (response) {
      // HTTP response errors
      switch (response.status) {
        case 429:
          const retryAfter = this.parseRetryAfter(response.headers.get('retry-after'));
          errorDetails = {
            type: ErrorType.RATE_LIMIT,
            message: `Rate limit exceeded. ${retryAfter ? `Retry after ${retryAfter} seconds.` : 'Please try again later.'}`,
            statusCode: response.status,
            retryAfter,
            retryable: true,
            timestamp
          };
          break;

        case 500:
        case 502:
        case 503:
        case 504:
          errorDetails = {
            type: ErrorType.API_ERROR,
            message: `Server error (${response.status}): ${response.statusText}`,
            statusCode: response.status,
            retryable: true,
            timestamp
          };
          break;

        case 400:
        case 422:
          errorDetails = {
            type: ErrorType.VALIDATION_ERROR,
            message: `Invalid request (${response.status}): ${response.statusText}`,
            statusCode: response.status,
            retryable: false,
            timestamp
          };
          break;

        case 401:
        case 403:
          errorDetails = {
            type: ErrorType.API_ERROR,
            message: `Authentication error (${response.status}): ${response.statusText}`,
            statusCode: response.status,
            retryable: false,
            timestamp
          };
          break;

        case 404:
          errorDetails = {
            type: ErrorType.API_ERROR,
            message: `Resource not found (${response.status}): ${response.statusText}`,
            statusCode: response.status,
            retryable: false,
            timestamp
          };
          break;

        default:
          errorDetails = {
            type: ErrorType.API_ERROR,
            message: `HTTP error (${response.status}): ${response.statusText}`,
            statusCode: response.status,
            retryable: response.status >= 500,
            timestamp
          };
      }
    } else if (error instanceof TypeError && error.message.includes('fetch')) {
      // Network connectivity issues
      errorDetails = {
        type: ErrorType.NETWORK_ERROR,
        message: 'Network connection failed. Check your internet connection.',
        retryable: true,
        timestamp,
        context: { originalError: (error as Error).message }
      };
    } else if (error && ((error as Error).name === 'AbortError' || ((error as Error).message && (error as Error).message.includes('timeout')))) {
      // Timeout errors
      errorDetails = {
        type: ErrorType.TIMEOUT,
        message: 'Request timed out. The server took too long to respond.',
        retryable: true,
        timestamp,
        context: { originalError: (error as Error).message }
      };
    } else if (error && (error as Error).message) {
      // Generic errors - assume they might be temporary unless proven otherwise
      const isLikelyTemporary = (error as Error).message.toLowerCase().includes('temporary') ||
                               (error as Error).message.toLowerCase().includes('connection') ||
                               (error as Error).message.toLowerCase().includes('timeout') ||
                               (error as Error).message.toLowerCase().includes('network');
      
      errorDetails = {
        type: ErrorType.UNKNOWN_ERROR,
        message: (error as Error).message,
        retryable: isLikelyTemporary,
        timestamp,
        context: { 
          name: (error as Error).name,
          stack: (error as Error).stack,
          originalError: error.toString()
        }
      };
    } else {
      // Null/undefined errors
      errorDetails = {
        type: ErrorType.UNKNOWN_ERROR,
        message: 'An unexpected error occurred',
        retryable: false,
        timestamp,
        context: { originalError: String(error) }
      };
    }

    this.recordError(errorDetails);
    return errorDetails;
  }

  /**
   * Execute a function with retry logic and error handling
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    context?: Record<string, unknown>
  ): Promise<T> {
    const retryConfig: RetryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true,
      ...config
    };

    let lastError: ErrorDetails;
    let attempt = 0;

    while (attempt <= retryConfig.maxRetries) {
      try {
        const result = await operation();
        
        // Record successful retry if this wasn't the first attempt
        if (attempt > 0) {
          this.metrics.successfulRetries++;
        }
        
        return result;
      } catch (error) {
        attempt++;
        lastError = this.classifyError(error);
        lastError.context = { ...lastError.context, ...context, attempt };

        // Don't retry if error is not retryable or we've exhausted retries
        if (!lastError.retryable || attempt > retryConfig.maxRetries) {
          throw new EnhancedError(lastError);
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateRetryDelay(attempt, retryConfig, lastError);
        this.recordRetryAttempt(delay);

        if (process.env.NODE_ENV === 'development') {
          console.warn(`Retry attempt ${attempt}/${retryConfig.maxRetries} after ${delay}ms for error:`, lastError.message);
        }

        await this.sleep(delay);
      }
    }

    throw new EnhancedError(lastError!);
  }

  /**
   * Enhanced fetch with automatic error handling and retries
   */
  async enhancedFetch(
    url: string,
    options: RequestInit & { timeout?: number } = {},
    retryConfig?: Partial<RetryConfig>
  ): Promise<Response> {
    const { timeout = 10000, ...fetchOptions } = options;

    return this.withRetry(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorDetails = this.classifyError(null, response);
          throw new EnhancedError(errorDetails);
        }

        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    }, retryConfig, { url, method: fetchOptions.method || 'GET' });
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateRetryDelay(attempt: number, config: RetryConfig, errorDetails: ErrorDetails): number {
    // If rate limited, respect the retry-after header
    if (errorDetails.type === ErrorType.RATE_LIMIT && errorDetails.retryAfter) {
      return Math.min(errorDetails.retryAfter * 1000, config.maxDelay);
    }

    // Exponential backoff
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);

    // Apply jitter to avoid thundering herd
    if (config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    // Cap at maximum delay
    return Math.min(delay, config.maxDelay);
  }

  /**
   * Parse retry-after header value
   */
  private parseRetryAfter(retryAfterHeader: string | null): number | undefined {
    if (!retryAfterHeader) return undefined;

    // Try parsing as seconds (integer)
    const seconds = parseInt(retryAfterHeader, 10);
    if (!isNaN(seconds) && seconds > 0) {
      return seconds;
    }

    // Try parsing as HTTP date
    const date = new Date(retryAfterHeader);
    if (!isNaN(date.getTime())) {
      const secondsUntil = Math.max(0, Math.floor((date.getTime() - Date.now()) / 1000));
      return secondsUntil;
    }

    return undefined;
  }

  /**
   * Record error occurrence for metrics
   */
  private recordError(errorDetails: ErrorDetails): void {
    this.metrics.totalErrors++;
    this.metrics.errorsByType[errorDetails.type]++;
    this.metrics.lastError = errorDetails;
  }

  /**
   * Record retry attempt for metrics
   */
  private recordRetryAttempt(delay: number): void {
    this.metrics.retryAttempts++;
    this.retryDelays.push(delay);

    // Keep only last 100 delays for rolling average
    if (this.retryDelays.length > 100) {
      this.retryDelays.shift();
    }

    this.metrics.averageRetryDelay = 
      this.retryDelays.reduce((sum, d) => sum + d, 0) / this.retryDelays.length;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get error handling metrics
   */
  getMetrics(): ErrorHandlingMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics(): void {
    this.metrics = {
      totalErrors: 0,
      errorsByType: {
        [ErrorType.NETWORK_ERROR]: 0,
        [ErrorType.RATE_LIMIT]: 0,
        [ErrorType.API_ERROR]: 0,
        [ErrorType.TIMEOUT]: 0,
        [ErrorType.VALIDATION_ERROR]: 0,
        [ErrorType.UNKNOWN_ERROR]: 0
      },
      retryAttempts: 0,
      successfulRetries: 0,
      averageRetryDelay: 0
    };
    this.retryDelays = [];
  }

  /**
   * Check if error is temporary and worth retrying
   */
  isTemporaryError(errorDetails: ErrorDetails): boolean {
    return errorDetails.retryable && [
      ErrorType.NETWORK_ERROR,
      ErrorType.RATE_LIMIT,
      ErrorType.TIMEOUT,
      ErrorType.API_ERROR
    ].includes(errorDetails.type);
  }

  /**
   * Get user-friendly error message
   */
  getUserFriendlyMessage(errorDetails: ErrorDetails): string {
    switch (errorDetails.type) {
      case ErrorType.NETWORK_ERROR:
        return 'Unable to connect to the launch data service. Please check your internet connection and try again.';
      
      case ErrorType.RATE_LIMIT:
        return errorDetails.retryAfter 
          ? `Too many requests. Please wait ${errorDetails.retryAfter} seconds before trying again.`
          : 'Too many requests. Please wait a moment before trying again.';
      
      case ErrorType.TIMEOUT:
        return 'The request took too long to complete. Please try again.';
      
      case ErrorType.API_ERROR:
        if (errorDetails.statusCode === 503) {
          return 'The launch data service is temporarily unavailable. Please try again later.';
        }
        return 'There was a problem with the launch data service. Please try again.';
      
      case ErrorType.VALIDATION_ERROR:
        return 'Invalid request. Please refresh the page and try again.';
      
      default:
        return 'An unexpected error occurred. Please refresh the page and try again.';
    }
  }
}

/**
 * Enhanced Error class with additional context
 */
export class EnhancedError extends Error {
  public readonly details: ErrorDetails;

  constructor(details: ErrorDetails) {
    super(details.message);
    this.name = 'EnhancedError';
    this.details = details;
  }

  get isRetryable(): boolean {
    return this.details.retryable;
  }

  get type(): ErrorType {
    return this.details.type;
  }

  get statusCode(): number | undefined {
    return this.details.statusCode;
  }

  get userFriendlyMessage(): string {
    const errorHandler = new ErrorHandlingService();
    return errorHandler.getUserFriendlyMessage(this.details);
  }
}

// Export singleton instance
export const errorHandlingService = new ErrorHandlingService();