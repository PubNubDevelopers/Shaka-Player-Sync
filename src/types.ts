/**
 * Type definitions for @pubnub/shaka-player
 */

import type PubNub from 'pubnub';

/**
 * Role of a client in the sync session.
 * - 'master': Controls playback for all connected clients
 * - 'follower': Receives and applies sync commands from the master
 */
export type SyncRole = 'master' | 'follower';

/**
 * Configuration options for SyncManager.
 */
export interface SyncManagerConfig {
  /**
   * Your PubNub publish key from the PubNub Admin Dashboard.
   * @see https://admin.pubnub.com
   */
  publishKey: string;

  /**
   * Your PubNub subscribe key from the PubNub Admin Dashboard.
   * @see https://admin.pubnub.com
   */
  subscribeKey: string;

  /**
   * Optional unique identifier for this client.
   * If not provided, a random ID will be generated.
   * Each client in a sync session MUST have a unique userId.
   */
  userId?: string;

  /**
   * Maximum allowed time drift (in seconds) before forcing correction.
   * Clients within this threshold won't be adjusted to avoid jitter.
   * @default 0.5
   */
  maxDriftThreshold?: number;

  /**
   * How often (in milliseconds) to send sync pulses when master is playing.
   * @default 5000
   */
  syncIntervalMs?: number;

  /**
   * Optional PubNub constructor class.
   * If not provided, the SyncManager will look for a global `PubNub` variable.
   * This allows you to pass the PubNub class directly when using npm/bundlers.
   *
   * @example
   * ```typescript
   * import PubNub from 'pubnub';
   * const syncManager = new SyncManager(player, {
   *   publishKey: '...',
   *   subscribeKey: '...',
   *   PubNub: PubNub
   * });
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PubNub?: new (config: any) => PubNub;

  /**
   * Optional Access Manager v3 auth token.
   * When provided, the PubNub client will use this token for all API requests.
   * Tokens are generated server-side using `grantToken()` with a Secret Key.
   *
   * @see https://www.pubnub.com/docs/general/security/access-control
   */
  authToken?: string;

  /**
   * Optional PubNub Secret Key.
   * **WARNING: Only use on the server or for demo/testing purposes.**
   * Never expose the Secret Key in production client-side code.
   * Required for calling `grantToken()` from the SyncManager.
   */
  secretKey?: string;

  /**
   * Optional async callback invoked when the current auth token expires
   * (i.e., a 403 Forbidden response is received). The callback should
   * return a fresh token string. The SyncManager will apply it automatically
   * via `setToken()` and retry the failed operation.
   *
   * @example
   * ```typescript
   * onTokenExpired: async () => {
   *   const res = await fetch('/api/token');
   *   const { token } = await res.json();
   *   return token;
   * }
   * ```
   */
  onTokenExpired?: () => Promise<string>;
}

/**
 * Payload object for sync commands.
 */
export interface SyncPayload {
  /** Timestamp when the command was sent (for latency calculation) */
  timestamp: number;

  /** User ID of the sender */
  senderId: string;

  /** Whether the video is currently paused */
  isPaused: boolean;

  /** Current playback time in seconds */
  currentTime?: number;

  /** Current playback rate (e.g., 1.0 for normal speed) */
  playbackRate?: number;
}

/**
 * Message object for sync commands sent via PubNub.
 */
export interface SyncMessage {
  /** Message type: 'SYNC_COMMAND' or 'MASTER_CLAIM' */
  type: 'SYNC_COMMAND' | 'MASTER_CLAIM';

  /** Command type for SYNC_COMMAND messages */
  command?: 'play' | 'pause' | 'seek' | 'sync' | 'ratechange';

  /** Command payload */
  payload: SyncPayload;
}

/**
 * Event data for the 'masterchanged' event.
 */
export interface MasterChangedEventData {
  /** User ID of the new master */
  newMasterId: string;

  /** The role this client had before the change */
  previousRole: SyncRole;
}

/**
 * Event data for the 'userjoined' event.
 */
export interface UserJoinedEventData {
  /** User ID of the user who joined */
  userId: string;

  /** Current occupancy count */
  occupancy?: number;
}

/**
 * Event data for the 'userleft' event.
 */
export interface UserLeftEventData {
  /** User ID of the user who left */
  userId: string;

  /** Current occupancy count */
  occupancy?: number;
}

/**
 * Event data for the 'accessdenied' event.
 * Emitted when a 403 Forbidden response is received from PubNub,
 * indicating that the current auth token is missing, expired, or
 * lacks the required permissions.
 */
export interface AccessDeniedEventData {
  /** Human-readable reason for the access denial */
  reason: string;
}

/**
 * Options for the `grantToken()` method on SyncManager.
 */
export interface GrantTokenOptions {
  /** Time-to-live in minutes (1 to 43200). */
  ttl: number;

  /** The UUID authorized to use this token. Defaults to the current userId. */
  authorized_uuid?: string;

  /** Channel permissions to grant. If omitted, the current room channel is used with read+write. */
  channels?: Record<string, { read?: boolean; write?: boolean; get?: boolean; manage?: boolean; update?: boolean; join?: boolean; delete?: boolean }>;
}

/**
 * Events emitted by SyncManager.
 */
export interface SyncManagerEvents {
  /** Emitted when the master role changes */
  masterchanged: MasterChangedEventData;

  /** Emitted when a user joins the sync room */
  userjoined: UserJoinedEventData;

  /** Emitted when a user leaves the sync room */
  userleft: UserLeftEventData;

  /** Emitted when connected to a sync room */
  connected: { roomId: string };

  /** Emitted when disconnected from a sync room */
  disconnected: { roomId: string };

  /** Emitted when a 403 Forbidden response is received (Access Manager) */
  accessdenied: AccessDeniedEventData;
}

/**
 * Type for event listener callbacks.
 */
export type SyncEventListener<K extends keyof SyncManagerEvents> = (
  event: SyncManagerEvents[K]
) => void;

/**
 * Shaka Player instance type (minimal interface for type safety).
 * We use a minimal interface to avoid tight coupling with shaka-player types.
 */
export interface ShakaPlayer {
  getMediaElement(): HTMLMediaElement | null;
}
