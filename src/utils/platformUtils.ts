/**
 * Platform and Browser Detection Utilities
 * Provides comprehensive cross-platform compatibility detection
 */

export interface PlatformInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isSafari: boolean;
  isChrome: boolean;
  isFirefox: boolean;
  isEdge: boolean;
  isWebView: boolean;
  isPWA: boolean;
  supportsTouch: boolean;
  supportsHover: boolean;
  hasNotchOrDynamicIsland: boolean;
  isHighDPI: boolean;
  isLandscape: boolean;
  prefersReducedMotion: boolean;
  prefersDarkMode: boolean;
  isOnline: boolean;
  supportsWebGL: boolean;
  supportsWebGL2: boolean;
}

export function detectPlatform(): PlatformInfo {
  // Safe defaults for server-side rendering
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isIOS: false,
      isAndroid: false,
      isSafari: false,
      isChrome: false,
      isFirefox: false,
      isEdge: false,
      isWebView: false,
      isPWA: false,
      supportsTouch: false,
      supportsHover: true,
      hasNotchOrDynamicIsland: false,
      isHighDPI: false,
      isLandscape: false,
      prefersReducedMotion: false,
      prefersDarkMode: false,
      isOnline: true,
      supportsWebGL: false,
      supportsWebGL2: false,
    };
  }

  const userAgent = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(userAgent);
  const isAndroid = /android/.test(userAgent);
  
  // Device type detection
  const isMobile = /mobile|android|iphone|ipod/.test(userAgent) || 
                   (isIOS && !userAgent.includes('ipad'));
  
  const isTablet = /tablet|ipad/.test(userAgent) || 
                   (isAndroid && !userAgent.includes('mobile'));
  
  const isDesktop = !isMobile && !isTablet;

  // Browser detection
  const isChrome = /chrome/.test(userAgent) && !/edge|opr/.test(userAgent);
  const isSafari = /safari/.test(userAgent) && !isChrome && !/edge|opr/.test(userAgent);
  const isFirefox = /firefox/.test(userAgent);
  const isEdge = /edge/.test(userAgent) || /edg\//.test(userAgent);
  
  // WebView detection
  const isWebView = (isAndroid && /wv/.test(userAgent)) || 
                    (isIOS && !isSafari && !isChrome && !isFirefox);

  // PWA detection
  const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                (window.navigator as any).standalone === true;

  // Touch and hover support
  const supportsTouch = 'ontouchstart' in window || 
                       navigator.maxTouchPoints > 0 ||
                       window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  
  const supportsHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // Notch/Dynamic Island detection (rough approximation)
  const hasNotchOrDynamicIsland = isIOS && (
    // iPhone X family and newer
    (window.screen.width === 375 && window.screen.height === 812) || // iPhone X/XS/11 Pro
    (window.screen.width === 414 && window.screen.height === 896) || // iPhone XR/XS Max/11/11 Pro Max
    (window.screen.width === 390 && window.screen.height === 844) || // iPhone 12/12 Pro
    (window.screen.width === 428 && window.screen.height === 926) || // iPhone 12 Pro Max
    (window.screen.width === 375 && window.screen.height === 667) || // iPhone SE (3rd gen)
    // Check for safe-area-inset support
    CSS.supports('padding', 'env(safe-area-inset-top)')
  );

  // High DPI detection
  const isHighDPI = window.devicePixelRatio > 1.5 ||
                   window.matchMedia('(min-resolution: 192dpi)').matches;

  // Orientation
  const isLandscape = window.innerWidth > window.innerHeight;

  // Media query preferences
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

  // Network status
  const isOnline = navigator.onLine;

  // WebGL support detection
  const supportsWebGL = (() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return gl !== null;
    } catch (e) {
      return false;
    }
  })();

  const supportsWebGL2 = (() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2');
      return gl !== null;
    } catch (e) {
      return false;
    }
  })();

  return {
    isMobile,
    isTablet,
    isDesktop,
    isIOS,
    isAndroid,
    isSafari,
    isChrome,
    isFirefox,
    isEdge,
    isWebView,
    isPWA,
    supportsTouch,
    supportsHover,
    hasNotchOrDynamicIsland,
    isHighDPI,
    isLandscape,
    prefersReducedMotion,
    prefersDarkMode,
    isOnline,
    supportsWebGL,
    supportsWebGL2,
  };
}

// Viewport utilities
export function getViewportSize() {
  if (typeof window === 'undefined') {
    return { width: 1024, height: 768 };
  }
  
  return {
    width: Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0),
    height: Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0),
  };
}

// Safe area utilities
export function getSafeAreaInsets() {
  if (typeof window === 'undefined' || !CSS.supports('padding', 'env(safe-area-inset-top)')) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  // These values are typically available in CSS but not directly in JS
  // This is a fallback approximation
  const platform = detectPlatform();
  
  if (platform.hasNotchOrDynamicIsland) {
    return {
      top: platform.isLandscape ? 0 : 44, // Status bar height on notched devices
      right: platform.isLandscape ? 44 : 0,
      bottom: platform.isLandscape ? 21 : 34, // Home indicator height
      left: platform.isLandscape ? 44 : 0,
    };
  }

  return { top: 0, right: 0, bottom: 0, left: 0 };
}

// Performance utilities
export function enableHardwareAcceleration(element: HTMLElement) {
  if (element) {
    element.style.transform = 'translateZ(0)';
    element.style.backfaceVisibility = 'hidden';
    element.style.perspective = '1000px';
  }
}

export function optimizeScrolling(element: HTMLElement) {
  if (element && detectPlatform().isIOS) {
    (element.style as any).WebkitOverflowScrolling = 'touch';
  }
}

// Network utilities
export function isSlowConnection(): boolean {
  if (typeof navigator === 'undefined' || !('connection' in navigator)) {
    return false;
  }

  const connection = (navigator as any).connection;
  return connection && (
    connection.effectiveType === 'slow-2g' ||
    connection.effectiveType === '2g' ||
    connection.saveData === true
  );
}

// Accessibility utilities
export function respectsReducedMotion(): boolean {
  return detectPlatform().prefersReducedMotion;
}

export function getPreferredColorScheme(): 'light' | 'dark' | 'no-preference' {
  if (typeof window === 'undefined') return 'no-preference';
  
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  
  return 'no-preference';
}