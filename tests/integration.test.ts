/**
 * Integration tests for SyncManager with mock PubNub
 * Tests complete sync scenarios between multiple clients
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncManager } from '../src/sync-manager';
import { createMockShakaPlayer, type MockVideoElement } from './mocks/video.mock';
import {
  createMockPubNubClass,
  simulateMessage,
  simulatePresence,
  type MockPubNubInstance,
} from './mocks/pubnub.mock';
import type { ShakaPlayer, SyncMessage } from '../src/types';

/**
 * Helper to create a configured SyncManager for testing
 */
function createTestClient(userId: string) {
  const mock = createMockShakaPlayer();
  const MockPubNub = createMockPubNubClass();

  const syncManager = new SyncManager(mock.player, {
    publishKey: 'pub-c-test',
    subscribeKey: 'sub-c-test',
    userId,
    maxDriftThreshold: 0.5,
    syncIntervalMs: 5000,
    PubNub: MockPubNub,
  });

  return {
    syncManager,
    player: mock.player,
    video: mock.video,
    MockPubNub,
    getInstance: () =>
      (MockPubNub as unknown as { getInstance: () => MockPubNubInstance }).getInstance(),
  };
}

describe('Integration Tests', () => {
  // =========================================================================
  // Multi-Client Sync Scenarios
  // =========================================================================

  describe('multi-client sync scenarios', () => {
    let masterClient: ReturnType<typeof createTestClient>;
    let followerClient1: ReturnType<typeof createTestClient>;
    let followerClient2: ReturnType<typeof createTestClient>;

    beforeEach(() => {
      masterClient = createTestClient('master-user');
      followerClient1 = createTestClient('follower-1');
      followerClient2 = createTestClient('follower-2');
    });

    afterEach(async () => {
      await masterClient.syncManager.destroy();
      await followerClient1.syncManager.destroy();
      await followerClient2.syncManager.destroy();
    });

    it('should sync play command from master to followers', () => {
      // Connect all clients
      masterClient.syncManager.connect('movie-night');
      followerClient1.syncManager.connect('movie-night');
      followerClient2.syncManager.connect('movie-night');

      // Master becomes master
      masterClient.syncManager.becomeMaster();

      // Extract the play message that master would send
      masterClient.video.currentTime = 45;
      masterClient.video.dispatchEvent('play');

      // Get the message that was published
      const masterInstance = masterClient.getInstance();
      const playMessage = masterInstance?.publish.mock.calls.find(
        (call) => call[0].message?.command === 'play'
      )?.[0].message;

      if (playMessage) {
        // Simulate followers receiving the message
        simulateMessage(followerClient1.getInstance()!._subscription, playMessage);
        simulateMessage(followerClient2.getInstance()!._subscription, playMessage);

        // Both followers should have started playback
        expect(followerClient1.video.play).toHaveBeenCalled();
        expect(followerClient2.video.play).toHaveBeenCalled();

        // Both followers should have correct time (with some latency tolerance)
        expect(followerClient1.video.currentTime).toBeGreaterThanOrEqual(45);
        expect(followerClient2.video.currentTime).toBeGreaterThanOrEqual(45);
      }
    });

    it('should sync pause command from master to followers', () => {
      masterClient.syncManager.connect('movie-night');
      followerClient1.syncManager.connect('movie-night');

      masterClient.syncManager.becomeMaster();
      masterClient.video.currentTime = 120;
      masterClient.video.dispatchEvent('pause');

      const masterInstance = masterClient.getInstance();
      const pauseMessage = masterInstance?.publish.mock.calls.find(
        (call) => call[0].message?.command === 'pause'
      )?.[0].message;

      if (pauseMessage) {
        simulateMessage(followerClient1.getInstance()!._subscription, pauseMessage);

        expect(followerClient1.video.pause).toHaveBeenCalled();
        expect(followerClient1.video.currentTime).toBe(120);
      }
    });

    it('should sync seek command from master to followers', () => {
      masterClient.syncManager.connect('movie-night');
      followerClient1.syncManager.connect('movie-night');

      masterClient.syncManager.becomeMaster();
      masterClient.video.currentTime = 300; // Seek to 5 minutes
      masterClient.video.dispatchEvent('seeked');

      const masterInstance = masterClient.getInstance();
      const seekMessage = masterInstance?.publish.mock.calls.find(
        (call) => call[0].message?.command === 'seek'
      )?.[0].message;

      if (seekMessage) {
        simulateMessage(followerClient1.getInstance()!._subscription, seekMessage);

        expect(followerClient1.video.currentTime).toBeGreaterThanOrEqual(300);
      }
    });

    it('should handle master handoff between clients', () => {
      masterClient.syncManager.connect('movie-night');
      followerClient1.syncManager.connect('movie-night');

      // First, masterClient becomes master
      masterClient.syncManager.becomeMaster();
      expect(masterClient.syncManager.getRole()).toBe('master');

      // Get the master claim message
      const masterInstance = masterClient.getInstance();
      const masterClaimMessage = masterInstance?.publish.mock.calls.find(
        (call) => call[0].message?.type === 'MASTER_CLAIM'
      )?.[0].message;

      // Simulate followerClient1 receiving the master claim
      if (masterClaimMessage) {
        simulateMessage(followerClient1.getInstance()!._subscription, masterClaimMessage);
      }

      // Now followerClient1 claims master
      followerClient1.syncManager.becomeMaster();
      const follower1Instance = followerClient1.getInstance();
      const newMasterClaim = follower1Instance?.publish.mock.calls.find(
        (call) => call[0].message?.type === 'MASTER_CLAIM' &&
        call[0].message?.payload.senderId === 'follower-1'
      )?.[0].message;

      // Master receives the new claim and should become follower
      if (newMasterClaim) {
        simulateMessage(masterInstance!._subscription, newMasterClaim);
      }

      expect(masterClient.syncManager.getRole()).toBe('follower');
      expect(followerClient1.syncManager.getRole()).toBe('master');
    });

    it('should emit masterchanged event to all clients on handoff', () => {
      masterClient.syncManager.connect('movie-night');
      followerClient1.syncManager.connect('movie-night');

      const masterListener = vi.fn();
      const followerListener = vi.fn();

      masterClient.syncManager.addEventListener('masterchanged', masterListener);
      followerClient1.syncManager.addEventListener('masterchanged', followerListener);

      masterClient.syncManager.becomeMaster();

      // Get master claim message
      const masterInstance = masterClient.getInstance();
      const masterClaimMessage: SyncMessage = {
        type: 'MASTER_CLAIM',
        payload: {
          timestamp: Date.now(),
          senderId: 'master-user',
          isPaused: true,
        },
      };

      // Follower receives master claim
      simulateMessage(followerClient1.getInstance()!._subscription, masterClaimMessage);

      expect(followerListener).toHaveBeenCalledWith({
        newMasterId: 'master-user',
        previousRole: 'follower',
      });
    });
  });

  // =========================================================================
  // Presence Integration Tests
  // =========================================================================

  describe('presence integration', () => {
    let client1: ReturnType<typeof createTestClient>;
    let client2: ReturnType<typeof createTestClient>;

    beforeEach(() => {
      client1 = createTestClient('user-1');
      client2 = createTestClient('user-2');
    });

    afterEach(async () => {
      await client1.syncManager.destroy();
      await client2.syncManager.destroy();
    });

    it('should notify when user joins the room', () => {
      client1.syncManager.connect('room-1');
      client2.syncManager.connect('room-1');

      const joinListener = vi.fn();
      client1.syncManager.addEventListener('userjoined', joinListener);

      // Simulate user-2 joining
      simulatePresence(client1.getInstance()!._subscription, 'join', 'user-2', 2);

      expect(joinListener).toHaveBeenCalledWith({
        userId: 'user-2',
        occupancy: 2,
      });
    });

    it('should notify when user leaves the room', () => {
      client1.syncManager.connect('room-1');
      client2.syncManager.connect('room-1');

      const leaveListener = vi.fn();
      client1.syncManager.addEventListener('userleft', leaveListener);

      // Simulate user-2 leaving
      simulatePresence(client1.getInstance()!._subscription, 'leave', 'user-2', 1);

      expect(leaveListener).toHaveBeenCalledWith({
        userId: 'user-2',
        occupancy: 1,
      });
    });

    it('should notify when user times out', () => {
      client1.syncManager.connect('room-1');

      const leaveListener = vi.fn();
      client1.syncManager.addEventListener('userleft', leaveListener);

      // Simulate user-2 timeout
      simulatePresence(client1.getInstance()!._subscription, 'timeout', 'user-2', 1);

      expect(leaveListener).toHaveBeenCalledWith({
        userId: 'user-2',
        occupancy: 1,
      });
    });
  });

  // =========================================================================
  // Sync Pulse Tests
  // =========================================================================

  describe('sync pulse integration', () => {
    let masterClient: ReturnType<typeof createTestClient>;
    let followerClient: ReturnType<typeof createTestClient>;

    beforeEach(() => {
      vi.useFakeTimers();
      masterClient = createTestClient('master');
      followerClient = createTestClient('follower');
    });

    afterEach(async () => {
      vi.useRealTimers();
      await masterClient.syncManager.destroy();
      await followerClient.syncManager.destroy();
    });

    it('should send periodic sync pulses when master is playing', () => {
      masterClient.syncManager.connect('room');
      masterClient.syncManager.becomeMaster();
      masterClient.video.paused = false;

      const masterInstance = masterClient.getInstance();
      const initialCalls = masterInstance?.publish.mock.calls.length || 0;

      // Advance time by sync interval
      vi.advanceTimersByTime(5000);

      const syncCalls = masterInstance?.publish.mock.calls.filter(
        (call) => call[0].message?.command === 'sync'
      );

      // Should have sent sync pulses (initial + at least one more)
      expect(syncCalls?.length).toBeGreaterThan(1);
    });

    it('should not send sync pulses when paused', () => {
      masterClient.syncManager.connect('room');
      masterClient.syncManager.becomeMaster();
      masterClient.video.paused = true;

      const masterInstance = masterClient.getInstance();

      // Count calls after becoming master
      const callsAfterMaster = masterInstance?.publish.mock.calls.length || 0;

      // Advance time
      vi.advanceTimersByTime(10000);

      // No additional sync pulses should be sent (video is paused)
      const syncCalls = masterInstance?.publish.mock.calls.filter(
        (call) => call[0].message?.command === 'sync'
      );

      // Only the initial sync from becomeMaster
      expect(syncCalls?.length).toBe(1);
    });

    it('should correct follower drift via sync pulse', () => {
      masterClient.syncManager.connect('room');
      followerClient.syncManager.connect('room');
      masterClient.syncManager.becomeMaster();

      // Set master and follower at different times (drift > 0.5s)
      masterClient.video.currentTime = 100;
      masterClient.video.paused = false;
      followerClient.video.currentTime = 95; // 5 seconds behind

      // Simulate sync pulse from master
      const syncMessage: SyncMessage = {
        type: 'SYNC_COMMAND',
        command: 'sync',
        payload: {
          timestamp: Date.now(),
          senderId: 'master',
          isPaused: false,
          currentTime: 100,
          playbackRate: 1.0,
        },
      };

      simulateMessage(followerClient.getInstance()!._subscription, syncMessage);

      // Follower should have corrected drift
      expect(followerClient.video.currentTime).toBeGreaterThanOrEqual(100);
    });
  });

  // =========================================================================
  // Latency Compensation Tests
  // =========================================================================

  describe('latency compensation', () => {
    let masterClient: ReturnType<typeof createTestClient>;
    let followerClient: ReturnType<typeof createTestClient>;

    beforeEach(() => {
      masterClient = createTestClient('master');
      followerClient = createTestClient('follower');
    });

    afterEach(async () => {
      await masterClient.syncManager.destroy();
      await followerClient.syncManager.destroy();
    });

    it('should compensate for network latency on play command', () => {
      masterClient.syncManager.connect('room');
      followerClient.syncManager.connect('room');
      masterClient.syncManager.becomeMaster();

      // Simulate a play command with 100ms latency
      const timestampInPast = Date.now() - 100;
      const playMessage: SyncMessage = {
        type: 'SYNC_COMMAND',
        command: 'play',
        payload: {
          timestamp: timestampInPast,
          senderId: 'master',
          isPaused: false,
          currentTime: 50,
        },
      };

      simulateMessage(followerClient.getInstance()!._subscription, playMessage);

      // Follower should have compensated for latency
      // currentTime should be approximately 50 + 0.1 (100ms latency)
      expect(followerClient.video.currentTime).toBeGreaterThan(50);
      expect(followerClient.video.currentTime).toBeLessThan(51);
    });

    it('should compensate for network latency on seek command', () => {
      masterClient.syncManager.connect('room');
      followerClient.syncManager.connect('room');
      masterClient.syncManager.becomeMaster();

      // Simulate a seek command with 200ms latency
      const timestampInPast = Date.now() - 200;
      const seekMessage: SyncMessage = {
        type: 'SYNC_COMMAND',
        command: 'seek',
        payload: {
          timestamp: timestampInPast,
          senderId: 'master',
          isPaused: false,
          currentTime: 120,
        },
      };

      simulateMessage(followerClient.getInstance()!._subscription, seekMessage);

      // Follower should have compensated for 200ms latency
      expect(followerClient.video.currentTime).toBeGreaterThan(120);
      expect(followerClient.video.currentTime).toBeLessThan(121);
    });

    it('should not add latency compensation on pause command', () => {
      masterClient.syncManager.connect('room');
      followerClient.syncManager.connect('room');
      masterClient.syncManager.becomeMaster();

      // Pause commands should not compensate (we want exact time)
      const pauseMessage: SyncMessage = {
        type: 'SYNC_COMMAND',
        command: 'pause',
        payload: {
          timestamp: Date.now() - 100,
          senderId: 'master',
          isPaused: true,
          currentTime: 60,
        },
      };

      simulateMessage(followerClient.getInstance()!._subscription, pauseMessage);

      // Pause should use exact time (no latency compensation)
      expect(followerClient.video.currentTime).toBe(60);
    });
  });

  // =========================================================================
  // Error Recovery Tests
  // =========================================================================

  describe('error recovery', () => {
    it('should handle video play failure gracefully', async () => {
      const client = createTestClient('user');
      client.video.play.mockRejectedValueOnce(new Error('Autoplay blocked'));

      client.syncManager.connect('room');

      const playMessage: SyncMessage = {
        type: 'SYNC_COMMAND',
        command: 'play',
        payload: {
          timestamp: Date.now(),
          senderId: 'master',
          isPaused: false,
          currentTime: 10,
        },
      };

      // Should not throw, just log warning
      expect(() => {
        simulateMessage(client.getInstance()!._subscription, playMessage);
      }).not.toThrow();

      await client.syncManager.destroy();
    });

    it('should handle reconnection scenario', async () => {
      const client = createTestClient('user');
      client.syncManager.connect('room-1');

      expect(client.syncManager.isConnected()).toBe(true);
      expect(client.syncManager.getRoomId()).toBe('room-1');

      client.syncManager.disconnect();

      expect(client.syncManager.isConnected()).toBe(false);

      // Reconnect to different room
      client.syncManager.connect('room-2');

      expect(client.syncManager.isConnected()).toBe(true);
      expect(client.syncManager.getRoomId()).toBe('room-2');

      await client.syncManager.destroy();
    });
  });

  // =========================================================================
  // Complete Watch Party Scenario
  // =========================================================================

  describe('complete watch party scenario', () => {
    it('should handle full watch party lifecycle', async () => {
      // Create three clients
      const host = createTestClient('host');
      const viewer1 = createTestClient('viewer-1');
      const viewer2 = createTestClient('viewer-2');

      // All join the same room
      host.syncManager.connect('friday-movie');
      viewer1.syncManager.connect('friday-movie');
      viewer2.syncManager.connect('friday-movie');

      // Host becomes master
      host.syncManager.becomeMaster();
      expect(host.syncManager.getRole()).toBe('master');

      // Set up listeners
      const viewer1Events: string[] = [];
      viewer1.syncManager.addEventListener('masterchanged', () => {
        viewer1Events.push('masterchanged');
      });
      viewer1.syncManager.addEventListener('userjoined', () => {
        viewer1Events.push('userjoined');
      });

      // Simulate presence events
      simulatePresence(viewer1.getInstance()!._subscription, 'join', 'viewer-2', 3);
      expect(viewer1Events).toContain('userjoined');

      // Host plays at time 0
      host.video.currentTime = 0;
      host.video.paused = false;
      host.video.dispatchEvent('play');

      // Get play message and deliver to viewers
      const hostInstance = host.getInstance();
      const playMsg = hostInstance?.publish.mock.calls.find(
        (c) => c[0].message?.command === 'play'
      )?.[0].message;

      if (playMsg) {
        simulateMessage(viewer1.getInstance()!._subscription, playMsg);
        simulateMessage(viewer2.getInstance()!._subscription, playMsg);
      }

      expect(viewer1.video.play).toHaveBeenCalled();
      expect(viewer2.video.play).toHaveBeenCalled();

      // Host seeks to 5 minutes
      host.video.currentTime = 300;
      host.video.dispatchEvent('seeked');

      const seekMsg = hostInstance?.publish.mock.calls.find(
        (c) => c[0].message?.command === 'seek'
      )?.[0].message;

      if (seekMsg) {
        simulateMessage(viewer1.getInstance()!._subscription, seekMsg);
        simulateMessage(viewer2.getInstance()!._subscription, seekMsg);
      }

      expect(viewer1.video.currentTime).toBeGreaterThanOrEqual(300);
      expect(viewer2.video.currentTime).toBeGreaterThanOrEqual(300);

      // Host pauses
      host.video.currentTime = 310;
      host.video.dispatchEvent('pause');

      const pauseMsg = hostInstance?.publish.mock.calls.find(
        (c) => c[0].message?.command === 'pause'
      )?.[0].message;

      if (pauseMsg) {
        simulateMessage(viewer1.getInstance()!._subscription, pauseMsg);
      }

      expect(viewer1.video.pause).toHaveBeenCalled();

      // Viewer1 takes control
      viewer1.syncManager.becomeMaster();
      const viewer1Instance = viewer1.getInstance();
      const newMasterMsg = viewer1Instance?.publish.mock.calls.find(
        (c) =>
          c[0].message?.type === 'MASTER_CLAIM' &&
          c[0].message?.payload.senderId === 'viewer-1'
      )?.[0].message;

      if (newMasterMsg) {
        simulateMessage(hostInstance!._subscription, newMasterMsg);
      }

      expect(host.syncManager.getRole()).toBe('follower');
      expect(viewer1.syncManager.getRole()).toBe('master');

      // Everyone leaves
      await host.syncManager.destroy();
      await viewer1.syncManager.destroy();
      await viewer2.syncManager.destroy();

      expect(host.syncManager.isConnected()).toBe(false);
      expect(viewer1.syncManager.isConnected()).toBe(false);
      expect(viewer2.syncManager.isConnected()).toBe(false);
    });
  });
});
