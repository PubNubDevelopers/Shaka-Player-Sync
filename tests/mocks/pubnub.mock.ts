/**
 * Mock PubNub SDK for testing
 */

import { vi } from 'vitest';

export interface MockSubscription {
  onMessage: ((event: unknown) => void) | null;
  onPresence: ((event: unknown) => void) | null;
  subscribe: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
}

export interface MockChannel {
  subscription: ReturnType<typeof vi.fn>;
}

export interface MockPubNubInstance {
  publish: ReturnType<typeof vi.fn>;
  addListener: ReturnType<typeof vi.fn>;
  removeAllListeners: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  channel: ReturnType<typeof vi.fn>;
  setToken: ReturnType<typeof vi.fn>;
  grantToken: ReturnType<typeof vi.fn>;
  parseToken: ReturnType<typeof vi.fn>;
  _subscription: MockSubscription;
  _listeners: { status?: (event: unknown) => void }[];
}

/**
 * Creates a mock subscription object
 */
export function createMockSubscription(): MockSubscription {
  return {
    onMessage: null,
    onPresence: null,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  };
}

/**
 * Creates a mock PubNub instance
 */
export function createMockPubNubInstance(): MockPubNubInstance {
  const subscription = createMockSubscription();
  const listeners: { status?: (event: unknown) => void }[] = [];

  const instance: MockPubNubInstance = {
    publish: vi.fn().mockResolvedValue({ timetoken: '12345' }),
    addListener: vi.fn((listener: { status?: (event: unknown) => void }) => {
      listeners.push(listener);
    }),
    removeAllListeners: vi.fn(() => {
      listeners.length = 0;
    }),
    destroy: vi.fn(),
    channel: vi.fn().mockReturnValue({
      subscription: vi.fn().mockReturnValue(subscription),
    }),
    setToken: vi.fn(),
    grantToken: vi.fn().mockResolvedValue('mock-token-string'),
    parseToken: vi.fn().mockReturnValue({
      version: 2,
      timestamp: Date.now(),
      ttl: 15,
      authorized_uuid: undefined,
      resources: { channels: {}, groups: {}, uuids: {} },
      patterns: { channels: {}, groups: {}, uuids: {} },
    }),
    _subscription: subscription,
    _listeners: listeners,
  };

  return instance;
}

/**
 * Creates a mock PubNub constructor class
 */
export function createMockPubNubClass() {
  let instance: MockPubNubInstance | null = null;

  const MockPubNub = vi.fn().mockImplementation(() => {
    instance = createMockPubNubInstance();
    return instance;
  });

  // Helper to get the created instance
  (MockPubNub as unknown as { getInstance: () => MockPubNubInstance | null }).getInstance = () => instance;

  return MockPubNub;
}

/**
 * Simulates receiving a PubNub message
 */
export function simulateMessage(subscription: MockSubscription, message: unknown) {
  if (subscription.onMessage) {
    subscription.onMessage({ message });
  }
}

/**
 * Simulates a PubNub status event (e.g., PNAccessDeniedCategory)
 */
export function simulateStatus(instance: MockPubNubInstance, category: string) {
  for (const listener of instance._listeners) {
    if (listener.status) {
      listener.status({ category });
    }
  }
}

/**
 * Simulates a presence event
 */
export function simulatePresence(
  subscription: MockSubscription,
  action: 'join' | 'leave' | 'timeout',
  uuid: string,
  occupancy = 1
) {
  if (subscription.onPresence) {
    subscription.onPresence({ action, uuid, occupancy });
  }
}
