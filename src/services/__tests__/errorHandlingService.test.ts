/**
 * Error Handling Service Tests
 * Tests the error classification, retry logic, and error recovery functionality
 */

import { errorHandlingService, ErrorType, EnhancedError } from '../errorHandlingService';

// Mock fetch for testing
global.fetch = jest.fn();

describe('ErrorHandlingService', () => {
beforeEach(() => {
  jest.clearAllMocks();
  errorHandlingService.resetMetrics();
});

  describe('Error Classification', () => {
    test('should classify network errors correctly', () => {
      const networkError = new TypeError('Failed to fetch');
      const errorDetails = errorHandlingService.classifyError(networkError);

      expect(errorDetails.type).toBe(ErrorType.NETWORK_ERROR);
      expect(errorDetails.retryable).toBe(true);
      expect(errorDetails.message).toContain('Network connection failed');
    });

    test('should classify timeout errors correctly', () => {
      const timeoutError = new Error('Request timeout');
      const errorDetails = errorHandlingService.classifyError(timeoutError);

      expect(errorDetails.type).toBe(ErrorType.TIMEOUT);
      expect(errorDetails.retryable).toBe(true);
      expect(errorDetails.message).toContain('timed out');
    });

    test('should classify rate limit errors correctly', () => {
      const mockResponse = {
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Map([['retry-after', '60']])
      } as any;

      const errorDetails = errorHandlingService.classifyError(null, mockResponse);

      expect(errorDetails.type).toBe(ErrorType.RATE_LIMIT);
      expect(errorDetails.retryable).toBe(true);
      expect(errorDetails.retryAfter).toBe(60);
      expect(errorDetails.message).toContain('Rate limit exceeded');
    });

    test('should classify server errors correctly', () => {
      const mockResponse = {
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Map()
      } as any;

      const errorDetails = errorHandlingService.classifyError(null, mockResponse);

      expect(errorDetails.type).toBe(ErrorType.API_ERROR);
      expect(errorDetails.retryable).toBe(true);
      expect(errorDetails.statusCode).toBe(500);
    });

    test('should classify client errors as non-retryable', () => {
      const mockResponse = {
        status: 400,
        statusText: 'Bad Request',
        headers: new Map()
      } as any;

      const errorDetails = errorHandlingService.classifyError(null, mockResponse);

      expect(errorDetails.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(errorDetails.retryable).toBe(false);
      expect(errorDetails.statusCode).toBe(400);
    });

    test('should handle unknown errors', () => {
      const unknownError = new Error('Something weird happened');
      const errorDetails = errorHandlingService.classifyError(unknownError);

      expect(errorDetails.type).toBe(ErrorType.UNKNOWN_ERROR);
      expect(errorDetails.retryable).toBe(false);
      expect(errorDetails.message).toBe('Something weird happened');
    });
  });

  describe('Retry Logic', () => {
    test('should retry retryable errors', async () => {
      let attemptCount = 0;
      const mockOperation = jest.fn(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return Promise.resolve('success');
      });

      const result = await errorHandlingService.withRetry(mockOperation, {
        maxRetries: 3,
        baseDelay: 1, // Very short delay for testing
        jitter: false
      });

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    test('should not retry non-retryable errors', async () => {
      const mockOperation = jest.fn(() => {
        const mockResponse = { status: 400, statusText: 'Bad Request', headers: new Map() } as any;
        const errorDetails = errorHandlingService.classifyError(null, mockResponse);
        throw new EnhancedError(errorDetails);
      });

      await expect(
        errorHandlingService.withRetry(mockOperation, { maxRetries: 3 })
      ).rejects.toThrow(EnhancedError);

      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    test('should respect maximum retry count', async () => {
      const mockOperation = jest.fn(() => {
        throw new Error('Connection failure'); // This will be classified as retryable
      });

      await expect(
        errorHandlingService.withRetry(mockOperation, {
          maxRetries: 2,
          baseDelay: 1,
          jitter: false
        })
      ).rejects.toThrow(EnhancedError);

      expect(mockOperation).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    test('should implement exponential backoff calculation', () => {
      // Test the backoff calculation directly instead of the full retry flow
      const service = errorHandlingService as any;
      const config = {
        baseDelay: 1000,
        backoffMultiplier: 2,
        maxDelay: 30000,
        jitter: false
      };
      
      const errorDetails = { type: ErrorType.NETWORK_ERROR, retryable: true } as any;
      
      const delay1 = service.calculateRetryDelay(1, config, errorDetails);
      const delay2 = service.calculateRetryDelay(2, config, errorDetails);
      const delay3 = service.calculateRetryDelay(3, config, errorDetails);
      
      expect(delay1).toBe(1000); // First retry: baseDelay * 2^0
      expect(delay2).toBe(2000); // Second retry: baseDelay * 2^1
      expect(delay3).toBe(4000); // Third retry: baseDelay * 2^2
    });

    test('should respect rate limit retry-after header in delay calculation', () => {
      const service = errorHandlingService as any;
      const config = {
        baseDelay: 1000,
        backoffMultiplier: 2,
        maxDelay: 30000,
        jitter: false
      };
      
      const rateLimitError = {
        type: ErrorType.RATE_LIMIT,
        retryAfter: 5,
        retryable: true
      } as any;
      
      const delay = service.calculateRetryDelay(1, config, rateLimitError);
      expect(delay).toBe(5000); // Should use retry-after value (5 seconds)
    });
  });

  describe('Enhanced Fetch', () => {
    test('should handle successful requests', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ data: 'test' })
      };

      (fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const response = await errorHandlingService.enhancedFetch('https://api.example.com/test');

      expect(response).toBe(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          signal: expect.any(AbortSignal)
        })
      );
    });

    test('should handle HTTP error responses', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Map()
      };

      (fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      await expect(
        errorHandlingService.enhancedFetch('https://api.example.com/test', {}, { maxRetries: 0 })
      ).rejects.toThrow(EnhancedError);
    });

    test('should handle network errors with retry', async () => {
      let attemptCount = 0;
      (fetch as jest.Mock).mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new TypeError('Failed to fetch');
        }
        return Promise.resolve({ ok: true });
      });

      const response = await errorHandlingService.enhancedFetch(
        'https://api.example.com/test',
        {},
        { maxRetries: 3, baseDelay: 1, jitter: false }
      );

      expect(response.ok).toBe(true);
      expect(attemptCount).toBe(3);
    });

    test('should handle request timeout with AbortController', async () => {
      (fetch as jest.Mock).mockImplementation((url, options) => {
        // Simulate timeout by immediately triggering abort
        if (options.signal) {
          setTimeout(() => options.signal.dispatchEvent(new Event('abort')), 10);
        }
        return new Promise((resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            const error = new Error('Request timeout');
            error.name = 'AbortError';
            reject(error);
          });
        });
      });

      await expect(
        errorHandlingService.enhancedFetch(
          'https://api.example.com/test',
          { timeout: 50 },
          { maxRetries: 0 }
        )
      ).rejects.toThrow(EnhancedError);
    });
  });

  describe('Metrics Tracking', () => {
    test('should track error metrics correctly', () => {
      const networkError = new TypeError('Failed to fetch');
      const timeoutError = new Error('Request timeout');
      
      errorHandlingService.classifyError(networkError);
      errorHandlingService.classifyError(timeoutError);

      const metrics = errorHandlingService.getMetrics();

      expect(metrics.totalErrors).toBe(2);
      expect(metrics.errorsByType[ErrorType.NETWORK_ERROR]).toBe(1);
      expect(metrics.errorsByType[ErrorType.TIMEOUT]).toBe(1);
    });

    test('should track retry attempts', async () => {
      let attemptCount = 0;
      const mockOperation = jest.fn(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Connection failure'); // This will be classified as retryable
        }
        return Promise.resolve('success');
      });

      await errorHandlingService.withRetry(mockOperation, {
        maxRetries: 3,
        baseDelay: 1,
        jitter: false
      });

      const metrics = errorHandlingService.getMetrics();

      expect(metrics.retryAttempts).toBe(2);
      expect(metrics.successfulRetries).toBe(1);
    });

    test('should reset metrics correctly', () => {
      const error = new Error('Test error');
      errorHandlingService.classifyError(error);

      let metrics = errorHandlingService.getMetrics();
      expect(metrics.totalErrors).toBe(1);

      errorHandlingService.resetMetrics();

      metrics = errorHandlingService.getMetrics();
      expect(metrics.totalErrors).toBe(0);
    });
  });

  describe('User-Friendly Messages', () => {
    test('should provide user-friendly network error messages', () => {
      const networkError = new TypeError('Failed to fetch');
      const errorDetails = errorHandlingService.classifyError(networkError);
      const message = errorHandlingService.getUserFriendlyMessage(errorDetails);

      expect(message).toContain('internet connection');
      expect(message).not.toContain('TypeError');
    });

    test('should provide user-friendly rate limit messages', () => {
      const mockResponse = {
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Map([['retry-after', '30']])
      } as any;

      const errorDetails = errorHandlingService.classifyError(null, mockResponse);
      const message = errorHandlingService.getUserFriendlyMessage(errorDetails);

      expect(message).toContain('Too many requests');
      expect(message).toContain('30 seconds');
    });

    test('should provide user-friendly API error messages', () => {
      const mockResponse = {
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Map()
      } as any;

      const errorDetails = errorHandlingService.classifyError(null, mockResponse);
      const message = errorHandlingService.getUserFriendlyMessage(errorDetails);

      expect(message).toContain('temporarily unavailable');
      expect(message).not.toContain('503');
    });
  });

  describe('EnhancedError Class', () => {
    test('should create EnhancedError with correct properties', () => {
      const mockResponse = {
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Map()
      } as any;

      const errorDetails = errorHandlingService.classifyError(null, mockResponse);
      const enhancedError = new EnhancedError(errorDetails);

      expect(enhancedError.name).toBe('EnhancedError');
      expect(enhancedError.type).toBe(ErrorType.API_ERROR);
      expect(enhancedError.statusCode).toBe(500);
      expect(enhancedError.isRetryable).toBe(true);
      expect(enhancedError.userFriendlyMessage).toContain('problem with the launch data service');
    });

    test('should handle error chaining', () => {
      const originalError = new Error('Original error');
      const errorDetails = errorHandlingService.classifyError(originalError);
      const enhancedError = new EnhancedError(errorDetails);

      expect(enhancedError.message).toBe('Original error');
      expect(enhancedError.details.context?.originalError).toBe('Error: Original error');
    });
  });

  describe('Edge Cases', () => {
    test('should handle undefined/null errors gracefully', () => {
      const errorDetails = errorHandlingService.classifyError(null);
      
      expect(errorDetails.type).toBe(ErrorType.UNKNOWN_ERROR);
      expect(errorDetails.retryable).toBe(false);
    });

    test('should handle missing retry-after header', () => {
      const mockResponse = {
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Map()
      } as any;

      const errorDetails = errorHandlingService.classifyError(null, mockResponse);

      expect(errorDetails.type).toBe(ErrorType.RATE_LIMIT);
      expect(errorDetails.retryAfter).toBeUndefined();
    });

    test('should handle malformed retry-after header', () => {
      const mockResponse = {
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Map([['retry-after', 'invalid']])
      } as any;

      const errorDetails = errorHandlingService.classifyError(null, mockResponse);

      expect(errorDetails.retryAfter).toBeUndefined();
    });

    test('should handle HTTP date in retry-after header', () => {
      const futureDate = new Date(Date.now() + 60000); // 1 minute from now
      const mockResponse = {
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Map([['retry-after', futureDate.toUTCString()]])
      } as any;

      const errorDetails = errorHandlingService.classifyError(null, mockResponse);

      expect(errorDetails.retryAfter).toBeGreaterThan(50); // Should be around 60 seconds
      expect(errorDetails.retryAfter).toBeLessThan(70);
    });
  });
});
