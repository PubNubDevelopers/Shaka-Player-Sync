/**
 * @pubnub/shaka-player
 *
 * Real-time playback synchronization for Shaka Player using PubNub.
 * Enables "Watch Party" experiences where multiple viewers stay in sync.
 *
 * @packageDocumentation
 */

/**
 * Library version. Updated automatically by release-please.
 */
// x-release-please-start-version
export const version = '1.0.1';
// x-release-please-end

export { SyncManager } from './sync-manager';
export type {
  SyncManagerConfig,
  SyncPayload,
  SyncMessage,
  SyncRole,
  SyncManagerEvents,
} from './types';
