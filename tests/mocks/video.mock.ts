/**
 * Mock HTMLMediaElement and Shaka Player for testing
 */

import { vi } from 'vitest';
import type { ShakaPlayer } from '../../src/types';

export interface MockVideoElement {
  currentTime: number;
  paused: boolean;
  playbackRate: number;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  _eventListeners: Map<string, Set<() => void>>;
  dispatchEvent: (eventType: string) => void;
}

/**
 * Creates a mock HTMLVideoElement
 */
export function createMockVideoElement(): MockVideoElement {
  const eventListeners = new Map<string, Set<() => void>>();

  const mockVideo: MockVideoElement = {
    currentTime: 0,
    paused: true,
    playbackRate: 1.0,
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    addEventListener: vi.fn((event: string, handler: () => void) => {
      if (!eventListeners.has(event)) {
        eventListeners.set(event, new Set());
      }
      eventListeners.get(event)!.add(handler);
    }),
    removeEventListener: vi.fn((event: string, handler: () => void) => {
      eventListeners.get(event)?.delete(handler);
    }),
    _eventListeners: eventListeners,
    dispatchEvent: (eventType: string) => {
      const handlers = eventListeners.get(eventType);
      if (handlers) {
        handlers.forEach((handler) => handler());
      }
    },
  };

  return mockVideo;
}

/**
 * Creates a mock Shaka Player instance
 */
export function createMockShakaPlayer(videoElement?: MockVideoElement): {
  player: ShakaPlayer;
  video: MockVideoElement;
} {
  const video = videoElement || createMockVideoElement();

  const player: ShakaPlayer = {
    getMediaElement: vi.fn().mockReturnValue(video as unknown as HTMLMediaElement),
  };

  return { player, video };
}
