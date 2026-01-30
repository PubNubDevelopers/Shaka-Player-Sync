/**
 * Test setup file for vitest
 */

import { vi } from 'vitest';

// Mock console methods to reduce noise during tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
