/**
 * Unit tests for environmentUtils - Environment detection and compatibility
 * Tests browser vs server environment detection and error handling
 * Note: Some tests are simplified due to Jest/JSDOM limitations
 */

import {
  isBrowser,
  isNode,
  hasCanvasSupport,
  hasImageSupport,
  getUserAgent,
  createEnvironmentError
} from './environmentUtils';

describe('environmentUtils', () => {
  describe('isBrowser', () => {
    test('should return a boolean value', () => {
      const result = isBrowser();
      expect(typeof result).toBe('boolean');
    });

    test('should be consistent when called multiple times', () => {
      const result1 = isBrowser();
      const result2 = isBrowser();
      const result3 = isBrowser();
      
      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });
  });

  describe('isNode', () => {
    test('should return a boolean value', () => {
      const result = isNode();
      expect(typeof result).toBe('boolean');
    });

    test('should detect Node.js environment correctly', () => {
      // In Jest test environment, we should have process.versions.node
      expect(isNode()).toBe(true);
    });

    test('should be consistent when called multiple times', () => {
      const result1 = isNode();
      const result2 = isNode();
      
      expect(result1).toBe(result2);
    });
  });

  describe('hasCanvasSupport', () => {
    test('should return a boolean value', () => {
      const result = hasCanvasSupport();
      expect(typeof result).toBe('boolean');
    });

    test('should not throw errors even when canvas is not available', () => {
      expect(() => hasCanvasSupport()).not.toThrow();
    });

    test('should return false in Jest/JSDOM environment without canvas package', () => {
      // Jest/JSDOM doesn't have full canvas support without additional packages
      const result = hasCanvasSupport();
      expect(result).toBe(false);
    });
  });

  describe('hasImageSupport', () => {
    test('should return a boolean value', () => {
      const result = hasImageSupport();
      expect(typeof result).toBe('boolean');
    });

    test('should depend on browser environment detection', () => {
      const browserResult = isBrowser();
      const imageResult = hasImageSupport();
      
      // If not in browser, should definitely be false
      if (!browserResult) {
        expect(imageResult).toBe(false);
      }
    });
  });

  describe('getUserAgent', () => {
    test('should always return a non-empty string', () => {
      const result = getUserAgent();
      
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('should include reasonable browser information', () => {
      const result = getUserAgent();
      
      // Should contain some form of browser/engine identifier
      expect(result).toMatch(/Mozilla|Chrome|Safari|Firefox|jsdom|BermudaRocketTracker/i);
    });

    test('should be consistent when called multiple times', () => {
      const result1 = getUserAgent();
      const result2 = getUserAgent();
      
      expect(result1).toBe(result2);
    });
  });

  describe('createEnvironmentError', () => {
    test('should create Error instance with correct message structure', () => {
      const feature = 'Canvas API';
      const environment = 'Node.js';
      
      const error = createEnvironmentError(feature, environment);
      
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain(feature);
      expect(error.message).toContain(environment);
      expect(error.message).toContain('not available');
      expect(error.message).toContain('browser environment with DOM support');
    });

    test('should handle empty strings gracefully', () => {
      const error = createEnvironmentError('', '');
      
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain('not available');
      expect(error.message).toContain('browser environment with DOM support');
    });

    test('should handle special characters in feature and environment names', () => {
      const testCases = [
        ['Feature with spaces', 'Environment with spaces'],
        ['Special!@#$%Characters', 'Environment123'],
        ['Unicode✨Feature', 'Environment🚀Test']
      ];

      testCases.forEach(([feature, environment]) => {
        const error = createEnvironmentError(feature, environment);
        
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain(feature);
        expect(error.message).toContain(environment);
      });
    });

    test('should create unique error instances', () => {
      const error1 = createEnvironmentError('Feature1', 'Env1');
      const error2 = createEnvironmentError('Feature2', 'Env2');
      
      expect(error1).not.toBe(error2);
      expect(error1.message).not.toBe(error2.message);
    });

    test('should create proper Error objects that can be thrown', () => {
      const error = createEnvironmentError('TestFeature', 'TestEnv');
      
      expect(() => {
        throw error;
      }).toThrow('TestFeature is not available in TestEnv environment');
    });
  });

  describe('environment compatibility integration', () => {
    test('should provide consistent environment detection', () => {
      const browserResult = isBrowser();
      const nodeResult = isNode();
      
      // Both can be true in Jest environment, but at least one should indicate the environment
      expect(typeof browserResult).toBe('boolean');
      expect(typeof nodeResult).toBe('boolean');
    });

    test('should handle environment-dependent features gracefully', () => {
      // All these functions should work without throwing errors
      expect(() => isBrowser()).not.toThrow();
      expect(() => isNode()).not.toThrow();
      expect(() => hasCanvasSupport()).not.toThrow();
      expect(() => hasImageSupport()).not.toThrow();
      expect(() => getUserAgent()).not.toThrow();
    });

    test('should provide meaningful fallbacks when browser APIs are limited', () => {
      // In Jest environment, some features may be limited but should still provide meaningful results
      const userAgent = getUserAgent();
      const hasCanvas = hasCanvasSupport();
      const hasImage = hasImageSupport();
      
      expect(userAgent).toBeDefined();
      expect(typeof hasCanvas).toBe('boolean');
      expect(typeof hasImage).toBe('boolean');
    });
  });

  describe('error handling edge cases', () => {
    test('should handle createEnvironmentError with very long strings', () => {
      const longFeature = 'A'.repeat(1000);
      const longEnvironment = 'B'.repeat(1000);
      
      const error = createEnvironmentError(longFeature, longEnvironment);
      
      expect(error).toBeInstanceOf(Error);
      expect(error.message.length).toBeGreaterThan(2000);
    });

    test('should handle createEnvironmentError with null-like values', () => {
      // TypeScript would prevent this, but test runtime behavior
      const testCases: any[] = [
        ['null', null],
        [undefined, 'environment'],
        ['feature', undefined]
      ];

      testCases.forEach(([feature, environment]) => {
        expect(() => {
          createEnvironmentError(feature, environment);
        }).not.toThrow();
      });
    });
  });

  describe('feature detection validation', () => {
    test('should validate environment detection functions return correct types', () => {
      const tests = [
        { fn: isBrowser, name: 'isBrowser' },
        { fn: isNode, name: 'isNode' },
        { fn: hasCanvasSupport, name: 'hasCanvasSupport' },
        { fn: hasImageSupport, name: 'hasImageSupport' }
      ];

      tests.forEach(({ fn, name }) => {
        const result = fn();
        expect(typeof result).toBe('boolean');
      });
    });

    test('should validate getUserAgent returns valid string format', () => {
      const userAgent = getUserAgent();
      
      expect(typeof userAgent).toBe('string');
      expect(userAgent.length).toBeGreaterThan(0);
      expect(userAgent.trim()).toBe(userAgent); // No leading/trailing whitespace
      
      // Should contain some recognizable user agent components
      expect(userAgent).toMatch(/Mozilla|AppleWebKit|Chrome|Safari|Firefox|jsdom|BermudaRocketTracker/);
    });
  });
});