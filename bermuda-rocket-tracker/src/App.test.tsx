import React from 'react';
import { render, screen } from '@testing-library/react';

// Simple component test without the full App
describe('App Component', () => {
  test('App file exists and exports correctly', () => {
    const App = require('./App').default;
    expect(App).toBeDefined();
    expect(typeof App).toBe('function');
  });
});

// Test individual components separately to avoid complex mocking
describe('Launch Card Component', () => {
  test('LaunchCard component exists', () => {
    const LaunchCard = require('./components/LaunchCard').default;
    expect(LaunchCard).toBeDefined();
    expect(typeof LaunchCard).toBe('function');
  });
});

// Test utility functions
describe('Utility Functions', () => {
  test('time utils exist', () => {
    const timeUtils = require('./utils/timeUtils');
    expect(timeUtils).toBeDefined();
  });

  test('coordinate utils exist', () => {
    const coordinateUtils = require('./utils/coordinateUtils');
    expect(coordinateUtils).toBeDefined();
  });
});
