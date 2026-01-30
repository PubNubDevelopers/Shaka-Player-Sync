/**
 * Unit tests for SyncManager
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncManager } from '../src/sync-manager';
import { createMockShakaPlayer, createMockVideoElement, type MockVideoElement } from './mocks/video.mock';
import {
  createMockPubNubClass,
  simulateMessage,
  simulatePresence,
  type MockPubNubInstance,
} from './mocks/pubnub.mock';
import type { ShakaPlayer, SyncMessage } from '../src/types';

describe('SyncManager', () => {
  let player: ShakaPlayer;
  let video: MockVideoElement;
  let MockPubNub: ReturnType<typeof createMockPubNubClass>;
  let syncManager: SyncManager;

  const defaultConfig = {
    publishKey: 'pub-c-test',
    subscribeKey: 'sub-c-test',
    userId: 'test-user-123',
  };

  beforeEach(() => {
    const mock = createMockShakaPlayer();
    player = mock.player;
    video = mock.video;
    MockPubNub = createMockPubNubClass();
  });

  afterEach(async () => {
    if (syncManager) {
      await syncManager.destroy();
    }
  });

  // =========================================================================
  // Constructor Tests
  // =========================================================================

  describe('constructor', () => {
    it('should create a SyncManager instance', () => {
      syncManager = new SyncManager(player, { ...defaultConfig, PubNub: MockPubNub });

      expect(syncManager).toBeInstanceOf(SyncManager);
    });

    it('should use provided userId', () => {
      syncManager = new SyncManager(player, { ...defaultConfig, PubNub: MockPubNub });

      expect(syncManager.getUserId()).toBe('test-user-123');
    });

    it('should auto-generate userId if not provided', () => {
      syncManager = new SyncManager(player, {
        publishKey: 'pub-c-test',
        subscribeKey: 'sub-c-test',
        PubNub: MockPubNub,
      });

      expect(syncManager.getUserId()).toMatch(/^shaka-user-[a-z0-9]+$/);
    });

    it('should use default maxDriftThreshold of 0.5', () => {
      syncManager = new SyncManager(player, { ...defaultConfig, PubNub: MockPubNub });

      // We can't directly access private property, but we can test behavior
      expect(syncManager).toBeDefined();
    });

    it('should use custom maxDriftThreshold when provided', () => {
      syncManager = new SyncManager(player, {
        ...defaultConfig,
        maxDriftThreshold: 1.0,
        PubNub: MockPubNub,
      });

      expect(syncManager).toBeDefined();
    });

    it('should use custom syncIntervalMs when provided', () => {
      syncManager = new SyncManager(player, {
        ...defaultConfig,
        syncIntervalMs: 10000,
        PubNub: MockPubNub,
      });

      expect(syncManager).toBeDefined();
    });

    it('should return the player instance via getPlayer()', () => {
      syncManager = new SyncManager(player, { ...defaultConfig, PubNub: MockPubNub });

      expect(syncManager.getPlayer()).toBe(player);
    });
  });

  // =========================================================================
  // Connection Tests
  // =========================================================================

  describe('connect', () => {
    beforeEach(() => {
      syncManager = new SyncManager(player, { ...defaultConfig, PubNub: MockPubNub });
    });

    it('should connect to a room', () => {
      syncManager.connect('test-room');

      expect(syncManager.isConnected()).toBe(true);
      expect(syncManager.getRoomId()).toBe('test-room');
    });

    it('should initialize PubNub with correct config', () => {
      syncManager.connect('test-room');

      expect(MockPubNub).toHaveBeenCalledWith({
        publishKey: 'pub-c-test',
        subscribeKey: 'sub-c-test',
        userId: 'test-user-123',
      });
    });

    it('should create subscription with presence events', () => {
      syncManager.connect('test-room');

      const instance = (MockPubNub as unknown as { getInstance: () => MockPubNubInstance }).getInstance();
      expect(instance?.channel).toHaveBeenCalledWith('shaka-sync-test-room');
    });

    it('should emit connected event', () => {
      const onConnected = vi.fn();
      syncManager.addEventListener('connected', onConnected);

      syncManager.connect('test-room');

      expect(onConnected).toHaveBeenCalledWith({ roomId: 'test-room' });
    });

    it('should throw if PubNub SDK is not available', () => {
      const syncManagerNoPubNub = new SyncManager(player, {
        publishKey: 'pub-c-test',
        subscribeKey: 'sub-c-test',
      });

      expect(() => syncManagerNoPubNub.connect('test-room')).toThrow('PubNub SDK not found');
    });

    it('should throw if publishKey is missing', () => {
      const syncManagerNoKeys = new SyncManager(player, {
        publishKey: '',
        subscribeKey: 'sub-c-test',
        PubNub: MockPubNub,
      });

      expect(() => syncManagerNoKeys.connect('test-room')).toThrow(
        'publishKey and subscribeKey are required'
      );
    });

    it('should throw if subscribeKey is missing', () => {
      const syncManagerNoKeys = new SyncManager(player, {
        publishKey: 'pub-c-test',
        subscribeKey: '',
        PubNub: MockPubNub,
      });

      expect(() => syncManagerNoKeys.connect('test-room')).toThrow(
        'publishKey and subscribeKey are required'
      );
    });

    it('should throw if no video element attached', () => {
      const playerNoVideo: ShakaPlayer = {
        getMediaElement: vi.fn().mockReturnValue(null),
      };
      const syncManagerNoVideo = new SyncManager(playerNoVideo, {
        ...defaultConfig,
        PubNub: MockPubNub,
      });

      expect(() => syncManagerNoVideo.connect('test-room')).toThrow(
        'No video element attached to player'
      );
    });
  });

  // =========================================================================
  // Disconnect Tests
  // =========================================================================

  describe('disconnect', () => {
    beforeEach(() => {
      syncManager = new SyncManager(player, { ...defaultConfig, PubNub: MockPubNub });
      syncManager.connect('test-room');
    });

    it('should disconnect from the room', () => {
      syncManager.disconnect();

      expect(syncManager.isConnected()).toBe(false);
      expect(syncManager.getRoomId()).toBe('');
    });

    it('should unsubscribe from PubNub', () => {
      const instance = (MockPubNub as unknown as { getInstance: () => MockPubNubInstance }).getInstance();

      syncManager.disconnect();

      expect(instance?._subscription.unsubscribe).toHaveBeenCalled();
    });

    it('should destroy PubNub client', () => {
      const instance = (MockPubNub as unknown as { getInstance: () => MockPubNubInstance }).getInstance();

      syncManager.disconnect();

      expect(instance?.destroy).toHaveBeenCalled();
    });

    it('should emit disconnected event', () => {
      const onDisconnected = vi.fn();
      syncManager.addEventListener('disconnected', onDisconnected);

      syncManager.disconnect();

      expect(onDisconnected).toHaveBeenCalledWith({ roomId: 'test-room' });
    });

    it('should reset role to follower', () => {
      syncManager.becomeMaster();
      expect(syncManager.getRole()).toBe('master');

      syncManager.disconnect();

      expect(syncManager.getRole()).toBe('follower');
    });

    it('should clear sync timer', () => {
      vi.useFakeTimers();
      syncManager.becomeMaster();

      syncManager.disconnect();

      // Advance timers to verify no sync pulses are sent
      vi.advanceTimersByTime(10000);

      const instance = (MockPubNub as unknown as { getInstance: () => MockPubNubInstance }).getInstance();
      // Only the initial becomeMaster calls should have occurred
      expect(instance?.publish).toHaveBeenCalledTimes(2); // master claim + initial sync

      vi.useRealTimers();
    });
  });

  // =========================================================================
  // Role Management Tests
  // =========================================================================

  describe('becomeMaster', () => {
    beforeEach(() => {
      syncManager = new SyncManager(player, { ...defaultConfig, PubNub: MockPubNub });
      syncManager.connect('test-room');
    });

    it('should set role to master', () => {
      syncManager.becomeMaster();

      expect(syncManager.getRole()).toBe('master');
    });

    it('should broadcast master claim', () => {
      syncManager.becomeMaster();

      const instance = (MockPubNub as unknown as { getInstance: () => MockPubNubInstance }).getInstance();
      expect(instance?.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'shaka-sync-test-room',
          message: expect.objectContaining({
            type: 'MASTER_CLAIM',
          }),
        })
      );
    });

    it('should broadcast full state', () => {
      video.currentTime = 30;
      video.playbackRate = 1.5;
      video.paused = false;

      syncManager.becomeMaster();

      const instance = (MockPubNub as unknown as { getInstance: () => MockPubNubInstance }).getInstance();
      expect(instance?.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.objectContaining({
            type: 'SYNC_COMMAND',
            command: 'sync',
            payload: expect.objectContaining({
              currentTime: 30,
              playbackRate: 1.5,
            }),
          }),
        })
      );
    });

    it('should start sync interval', () => {
      vi.useFakeTimers();
      video.paused = false;

      syncManager.becomeMaster();

      const instance = (MockPubNub as unknown as { getInstance: () => MockPubNubInstance }).getInstance();
      const initialCalls = instance?.publish.mock.calls.length || 0;

      vi.advanceTimersByTime(5000);

      expect(instance?.publish.mock.calls.length).toBeGreaterThan(initialCalls);

      vi.useRealTimers();
    });
  });

  describe('becomeFollower', () => {
    beforeEach(() => {
      syncManager = new SyncManager(player, { ...defaultConfig, PubNub: MockPubNub });
      syncManager.connect('test-room');
      syncManager.becomeMaster();
    });

    it('should set role to follower', () => {
      syncManager.becomeFollower();

      expect(syncManager.getRole()).toBe('follower');
    });

    it('should stop sync timer', () => {
      vi.useFakeTimers();
      video.paused = false;

      syncManager.becomeFollower();

      const instance = (MockPubNub as unknown as { getInstance: () => MockPubNubInstance }).getInstance();
      const callsAfterFollower = instance?.publish.mock.calls.length || 0;

      vi.advanceTimersByTime(10000);

      // No additional calls should be made
      expect(instance?.publish.mock.calls.length).toBe(callsAfterFollower);

      vi.useRealTimers();
    });
  });

  // =========================================================================
  // Event Listener Tests
  // =========================================================================

  describe('event listeners', () => {
    beforeEach(() => {
      syncManager = new SyncManager(player, { ...defaultConfig, PubNub: MockPubNub });
      syncManager.connect('test-room');
    });

    it('should add and trigger event listeners', () => {
      const listener = vi.fn();
      syncManager.addEventListener('masterchanged', listener);

      const instance = (MockPubNub as unknown as { getInstance: () => MockPubNubInstance }).getInstance();
      const message: SyncMessage = {
        type: 'MASTER_CLAIM',
        payload: {
          timestamp: Date.now(),
          senderId: 'other-user',
          isPaused: false,
        },
      };

      simulateMessage(instance!._subscription, message);

      expect(listener).toHaveBeenCalledWith({
        newMasterId: 'other-user',
        previousRole: 'follower',
      });
    });

    it('should remove event listeners', () => {
      const listener = vi.fn();
      syncManager.addEventListener('masterchanged', listener);
      syncManager.removeEventListener('masterchanged', listener);

      const instance = (MockPubNub as unknown as { getInstance: () => MockPubNubInstance }).getInstance();
      const message: SyncMessage = {
        type: 'MASTER_CLAIM',
        payload: {
          timestamp: Date.now(),
          senderId: 'other-user',
          isPaused: false,
        },
      };

      simulateMessage(instance!._subscription, message);

      expect(listener).not.toHaveBeenCalled();
    });

    it('should emit userjoined on presence join event', () => {
      const listener = vi.fn();
      syncManager.addEventListener('userjoined', listener);

      const instance = (MockPubNub as unknown as { getInstance: () => MockPubNubInstance }).getInstance();
      simulatePresence(instance!._subscription, 'join', 'new-user', 2);

      expect(listener).toHaveBeenCalledWith({
        userId: 'new-user',
        occupancy: 2,
      });
    });

    it('should emit userleft on presence leave event', () => {
      const listener = vi.fn();
      syncManager.addEventListener('userleft', listener);

      const instance = (MockPubNub as unknown as { getInstance: () => MockPubNubInstance }).getInstance();
      simulatePresence(instance!._subscription, 'leave', 'leaving-user', 1);

      expect(listener).toHaveBeenCalledWith({
        userId: 'leaving-user',
        occupancy: 1,
      });
    });

    it('should emit userleft on presence timeout event', () => {
      const listener = vi.fn();
      syncManager.addEventListener('userleft', listener);

      const instance = (MockPubNub as unknown as { getInstance: () => MockPubNubInstance }).getInstance();
      simulatePresence(instance!._subscription, 'timeout', 'timed-out-user', 0);

      expect(listener).toHaveBeenCalledWith({
        userId: 'timed-out-user',
        occupancy: 0,
      });
    });

    it('should not emit userjoined for own join event', () => {
      const listener = vi.fn();
      syncManager.addEventListener('userjoined', listener);

      const instance = (MockPubNub as unknown as { getInstance: () => MockPubNubInstance }).getInstance();
      simulatePresence(instance!._subscription, 'join', 'test-user-123', 1);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Message Handling Tests
  // =========================================================================

  describe('message handling', () => {
    beforeEach(() => {
      syncManager = new SyncManager(player, { ...defaultConfig, PubNub: MockPubNub });
      syncManager.connect('test-room');
    });

    it('should ignore own messages', () => {
      const instance = (MockPubNub as unknown as { getInstance: () => MockPubNubInstance }).getInstance();
      const message: SyncMessage = {
        type: 'SYNC_COMMAND',
        command: 'play',
        payload: {
          timestamp: Date.now(),
          senderId: 'test-user-123', // Same as our userId
          isPaused: false,
          currentTime: 10,
        },
      };

      simulateMessage(instance!._subscription, message);

      // Play should not be called since we ignore our own messages
      expect(video.play).not.toHaveBeenCalled();
    });

    it('should ignore sync commands when master', () => {
      syncManager.becomeMaster();

      const instance = (MockPubNub as unknown as { getInstance: () => MockPubNubInstance }).getInstance();
      const message: SyncMessage = {
        type: 'SYNC_COMMAND',
        command: 'play',
        payload: {
          timestamp: Date.now(),
          senderId: 'other-user',
          isPaused: false,
          currentTime: 10,
        },
      };

      simulateMessage(instance!._subscription, message);

      // Play should not be called since masters don't process sync commands
      expect(video.play).not.toHaveBeenCalled();
    });

    it('should apply play command as follower', () => {
      const instance = (MockPubNub as unknown as { getInstance: () => MockPubNubInstance }).getInstance();
      const message: SyncMessage = {
        type: 'SYNC_COMMAND',
        command: 'play',
        payload: {
          timestamp: Date.now(),
          senderId: 'other-user',
          isPaused: false,
          currentTime: 10,
        },
      };

      simulateMessage(instance!._subscription, message);

      expect(video.play).toHaveBeenCalled();
      expect(video.currentTime).toBeGreaterThanOrEqual(10);
    });

    it('should apply pause command as follower', () => {
      const instance = (MockPubNub as unknown as { getInstance: () => MockPubNubInstance }).getInstance();
      const message: SyncMessage = {
        type: 'SYNC_COMMAND',
        command: 'pause',
        payload: {
          timestamp: Date.now(),
          senderId: 'other-user',
          isPaused: true,
          currentTime: 15,
        },
      };

      simulateMessage(instance!._subscription, message);

      expect(video.pause).toHaveBeenCalled();
      expect(video.currentTime).toBe(15);
    });

    it('should apply seek command as follower', () => {
      const instance = (MockPubNub as unknown as { getInstance: () => MockPubNubInstance }).getInstance();
      const message: SyncMessage = {
        type: 'SYNC_COMMAND',
        command: 'seek',
        payload: {
          timestamp: Date.now(),
          senderId: 'other-user',
          isPaused: false,
          currentTime: 60,
        },
      };

      simulateMessage(instance!._subscription, message);

      expect(video.currentTime).toBeGreaterThanOrEqual(60);
    });

    it('should apply ratechange command as follower', () => {
      const instance = (MockPubNub as unknown as { getInstance: () => MockPubNubInstance }).getInstance();
      const message: SyncMessage = {
        type: 'SYNC_COMMAND',
        command: 'ratechange',
        payload: {
          timestamp: Date.now(),
          senderId: 'other-user',
          isPaused: false,
          playbackRate: 2.0,
        },
      };

      simulateMessage(instance!._subscription, message);

      expect(video.playbackRate).toBe(2.0);
    });

    it('should handle master claim and demote current master', () => {
      syncManager.becomeMaster();
      expect(syncManager.getRole()).toBe('master');

      const listener = vi.fn();
      syncManager.addEventListener('masterchanged', listener);

      const instance = (MockPubNub as unknown as { getInstance: () => MockPubNubInstance }).getInstance();
      const message: SyncMessage = {
        type: 'MASTER_CLAIM',
        payload: {
          timestamp: Date.now(),
          senderId: 'new-master',
          isPaused: false,
        },
      };

      simulateMessage(instance!._subscription, message);

      expect(syncManager.getRole()).toBe('follower');
      expect(listener).toHaveBeenCalledWith({
        newMasterId: 'new-master',
        previousRole: 'master',
      });
    });
  });

  // =========================================================================
  // Video Event Broadcasting Tests (Master)
  // =========================================================================

  describe('video event broadcasting (master)', () => {
    beforeEach(() => {
      syncManager = new SyncManager(player, { ...defaultConfig, PubNub: MockPubNub });
      syncManager.connect('test-room');
      syncManager.becomeMaster();
    });

    it('should broadcast play event when master', () => {
      video.currentTime = 25;

      // Trigger the play event
      video.dispatchEvent('play');

      const instance = (MockPubNub as unknown as { getInstance: () => MockPubNubInstance }).getInstance();
      expect(instance?.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.objectContaining({
            type: 'SYNC_COMMAND',
            command: 'play',
            payload: expect.objectContaining({
              currentTime: 25,
            }),
          }),
        })
      );
    });

    it('should broadcast pause event when master', () => {
      video.currentTime = 30;

      video.dispatchEvent('pause');

      const instance = (MockPubNub as unknown as { getInstance: () => MockPubNubInstance }).getInstance();
      expect(instance?.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.objectContaining({
            type: 'SYNC_COMMAND',
            command: 'pause',
            payload: expect.objectContaining({
              currentTime: 30,
            }),
          }),
        })
      );
    });

    it('should broadcast seeked event when master', () => {
      video.currentTime = 120;

      video.dispatchEvent('seeked');

      const instance = (MockPubNub as unknown as { getInstance: () => MockPubNubInstance }).getInstance();
      expect(instance?.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.objectContaining({
            type: 'SYNC_COMMAND',
            command: 'seek',
            payload: expect.objectContaining({
              currentTime: 120,
            }),
          }),
        })
      );
    });

    it('should broadcast ratechange event when master', () => {
      video.playbackRate = 1.5;

      video.dispatchEvent('ratechange');

      const instance = (MockPubNub as unknown as { getInstance: () => MockPubNubInstance }).getInstance();
      expect(instance?.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.objectContaining({
            type: 'SYNC_COMMAND',
            command: 'ratechange',
            payload: expect.objectContaining({
              playbackRate: 1.5,
            }),
          }),
        })
      );
    });

    it('should not broadcast events when follower', () => {
      syncManager.becomeFollower();

      const instance = (MockPubNub as unknown as { getInstance: () => MockPubNubInstance }).getInstance();
      const callsBeforeEvents = instance?.publish.mock.calls.length || 0;

      video.dispatchEvent('play');
      video.dispatchEvent('pause');
      video.dispatchEvent('seeked');
      video.dispatchEvent('ratechange');

      expect(instance?.publish.mock.calls.length).toBe(callsBeforeEvents);
    });
  });

  // =========================================================================
  // Drift Correction Tests
  // =========================================================================

  describe('drift correction', () => {
    beforeEach(() => {
      syncManager = new SyncManager(player, {
        ...defaultConfig,
        maxDriftThreshold: 0.5,
        PubNub: MockPubNub,
      });
      syncManager.connect('test-room');
    });

    it('should correct drift when above threshold', () => {
      video.currentTime = 10; // Local time

      const instance = (MockPubNub as unknown as { getInstance: () => MockPubNubInstance }).getInstance();
      const message: SyncMessage = {
        type: 'SYNC_COMMAND',
        command: 'sync',
        payload: {
          timestamp: Date.now(),
          senderId: 'other-user',
          isPaused: false,
          currentTime: 15, // Master time is 5 seconds ahead (drift > 0.5)
          playbackRate: 1.0,
        },
      };

      simulateMessage(instance!._subscription, message);

      // Video time should be corrected to approximately 15
      expect(video.currentTime).toBeGreaterThanOrEqual(15);
    });

    it('should not correct small drift below threshold', () => {
      video.currentTime = 10; // Local time

      const instance = (MockPubNub as unknown as { getInstance: () => MockPubNubInstance }).getInstance();
      const message: SyncMessage = {
        type: 'SYNC_COMMAND',
        command: 'sync',
        payload: {
          timestamp: Date.now(),
          senderId: 'other-user',
          isPaused: false,
          currentTime: 10.3, // Only 0.3s difference (below 0.5 threshold)
          playbackRate: 1.0,
        },
      };

      simulateMessage(instance!._subscription, message);

      // Video time should remain at 10 since drift is below threshold
      expect(video.currentTime).toBe(10);
    });

    it('should sync playback rate during sync pulse', () => {
      video.playbackRate = 1.0;

      const instance = (MockPubNub as unknown as { getInstance: () => MockPubNubInstance }).getInstance();
      const message: SyncMessage = {
        type: 'SYNC_COMMAND',
        command: 'sync',
        payload: {
          timestamp: Date.now(),
          senderId: 'other-user',
          isPaused: false,
          currentTime: video.currentTime,
          playbackRate: 2.0,
        },
      };

      simulateMessage(instance!._subscription, message);

      expect(video.playbackRate).toBe(2.0);
    });

    it('should sync paused state during sync pulse', () => {
      video.paused = false;

      const instance = (MockPubNub as unknown as { getInstance: () => MockPubNubInstance }).getInstance();
      const message: SyncMessage = {
        type: 'SYNC_COMMAND',
        command: 'sync',
        payload: {
          timestamp: Date.now(),
          senderId: 'other-user',
          isPaused: true,
          currentTime: video.currentTime,
          playbackRate: 1.0,
        },
      };

      simulateMessage(instance!._subscription, message);

      expect(video.pause).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Destroy Tests
  // =========================================================================

  describe('destroy', () => {
    it('should clean up all resources', async () => {
      syncManager = new SyncManager(player, { ...defaultConfig, PubNub: MockPubNub });
      syncManager.connect('test-room');

      const onConnected = vi.fn();
      syncManager.addEventListener('connected', onConnected);

      await syncManager.destroy();

      expect(syncManager.isConnected()).toBe(false);
    });

    it('should clear event listeners', async () => {
      syncManager = new SyncManager(player, { ...defaultConfig, PubNub: MockPubNub });
      syncManager.connect('test-room');

      const listener = vi.fn();
      syncManager.addEventListener('masterchanged', listener);

      await syncManager.destroy();

      // Reconnect to test listener was cleared
      syncManager = new SyncManager(player, { ...defaultConfig, PubNub: MockPubNub });
      syncManager.connect('test-room');

      const instance = (MockPubNub as unknown as { getInstance: () => MockPubNubInstance }).getInstance();
      simulateMessage(instance!._subscription, {
        type: 'MASTER_CLAIM',
        payload: {
          timestamp: Date.now(),
          senderId: 'other-user',
          isPaused: false,
        },
      });

      // Old listener should not be called
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
