/**
 * Environment Detection Utilities
 * Safely detect browser vs. server environments to prevent compatibility issues
 */

/**
 * Check if we're running in a browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && 
         typeof document !== 'undefined' && 
         typeof HTMLCanvasElement !== 'undefined';
}

/**
 * Check if we're running in a Node.js environment
 */
export function isNode(): boolean {
  return typeof process !== 'undefined' && 
         !!process.versions && 
         !!process.versions.node;
}

/**
 * Check if Canvas API is available
 */
export function hasCanvasSupport(): boolean {
  if (!isBrowser()) return false;
  
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext && canvas.getContext('2d'));
  } catch (error) {
    return false;
  }
}

/**
 * Check if Image API is available for loading external images
 */
export function hasImageSupport(): boolean {
  return isBrowser() && typeof Image !== 'undefined';
}

/**
 * Safely get user agent string
 */
export function getUserAgent(): string {
  if (isBrowser() && navigator?.userAgent) {
    return navigator.userAgent;
  }
  return 'Mozilla/5.0 (compatible; BermudaRocketTracker/1.0)';
}

/**
 * Environment-aware error handler
 */
export function createEnvironmentError(feature: string, environment: string): Error {
  return new Error(
    `${feature} is not available in ${environment} environment. ` +
    `This feature requires a browser environment with DOM support.`
  );
}