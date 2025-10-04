// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Add custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(expected: any[]): R;
      toBeIn(expected: any[]): R;
    }
  }
}

expect.extend({
  toBeOneOf(received, expected) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected.join(', ')}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected.join(', ')}`,
        pass: false,
      };
    }
  },
  toBeIn(received, expected) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be in [${expected.join(', ')}]`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be in [${expected.join(', ')}]`,
        pass: false,
      };
    }
  },
});

if (typeof HTMLCanvasElement !== 'undefined') {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = (function getContextOverride(this: HTMLCanvasElement, type: string, ...args: unknown[]) {
    if (type === '2d') {
      return {
        fillRect: () => undefined,
        clearRect: () => undefined,
        getImageData: () => ({ data: [] }),
        putImageData: () => undefined,
        createImageData: () => ({}),
        setTransform: () => undefined,
        drawImage: () => undefined
      } as unknown as CanvasRenderingContext2D;
    }

    return originalGetContext ? (originalGetContext as any).call(this, type, ...args) : null;
  } as unknown as (typeof HTMLCanvasElement.prototype.getContext));
}
