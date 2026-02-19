/**
 * SyncManager - Real-time playback synchronization for Shaka Player
 *
 * Enables "Watch Party" experiences where multiple viewers stay in sync
 * using PubNub as the real-time messaging layer.
 */

import type PubNub from 'pubnub';
import type {
  SyncManagerConfig,
  SyncPayload,
  SyncMessage,
  SyncRole,
  SyncManagerEvents,
  SyncEventListener,
  ShakaPlayer,
  GrantTokenOptions,
} from './types';

/**
 * SyncManager enables real-time playback synchronization between multiple
 * clients using PubNub as the messaging layer. One client acts as the
 * "master" (controlling playback) while others are "followers" (receiving
 * sync commands).
 *
 * @example
 * ```typescript
 * import shaka from 'shaka-player';
 * import { SyncManager } from '@pubnub/shaka-player';
 *
 * const player = new shaka.Player();
 * await player.attach(videoElement);
 * await player.load(manifestUrl);
 *
 * const syncManager = new SyncManager(player, {
 *   publishKey: 'pub-c-xxx',
 *   subscribeKey: 'sub-c-xxx',
 * });
 *
 * syncManager.connect('watch-party-room');
 * syncManager.becomeMaster(); // Take control
 * ```
 */
export class SyncManager {
  /** Reference to the Shaka Player instance */
  private readonly shakaPlayer: ShakaPlayer;

  /** Reference to the HTML video element */
  private video: HTMLMediaElement | null;

  /** PubNub configuration */
  private config: SyncManagerConfig;

  /** PubNub client instance */
  private pubnub: PubNub | null = null;

  /** PubNub subscription for the current room */
  private subscription: ReturnType<ReturnType<PubNub['channel']>['subscription']> | null = null;

  /** Current channel/room name */
  private channelName = '';

  /** Unique identifier for this client */
  private userId: string;

  /** Current role: 'master' or 'follower' */
  private role: SyncRole = 'follower';

  /** Flag to prevent loops when processing remote commands */
  private isProcessingRemoteCommand = false;

  /** Connection status */
  private connected = false;

  /** Timer for periodic sync pulses */
  private syncTimer: ReturnType<typeof setInterval> | null = null;

  /** Maximum allowed drift before correction (seconds) */
  private maxDriftThreshold: number;

  /** Sync pulse interval (milliseconds) */
  private syncIntervalMs: number;

  /** Timer for re-enabling local events after remote command */
  private remoteCommandTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Event listeners */
  private eventListeners: Map<keyof SyncManagerEvents, Set<SyncEventListener<keyof SyncManagerEvents>>> = new Map();

  /** Bound event handlers for cleanup */
  private boundHandlers = {
    onPlay: () => this.onLocalPlay(),
    onPause: () => this.onLocalPause(),
    onSeeked: () => this.onLocalSeeked(),
    onRateChange: () => this.onLocalRateChange(),
  };

  /**
   * Creates a new SyncManager instance.
   *
   * @param player - The Shaka Player instance to synchronize
   * @param config - Configuration object with PubNub credentials
   */
  constructor(player: ShakaPlayer, config: SyncManagerConfig) {
    this.shakaPlayer = player;
    this.video = player.getMediaElement();
    this.config = config;
    this.userId = config.userId || this.generateUserId();
    this.maxDriftThreshold = config.maxDriftThreshold ?? 0.5;
    this.syncIntervalMs = config.syncIntervalMs ?? 5000;

    console.log('[SyncManager] Created with userId:', this.userId);
  }

  /**
   * Returns the Shaka Player instance.
   */
  getPlayer(): ShakaPlayer {
    return this.shakaPlayer;
  }

  // =========================================================================
  // PUBLIC API
  // =========================================================================

  /**
   * Connects to a sync room and begins listening for sync commands.
   *
   * @param roomId - Unique identifier for the sync room
   */
  connect(roomId: string): void {
    const PubNubClass = this.config.PubNub || this.getGlobalPubNub();

    if (!PubNubClass) {
      throw new Error(
        '[SyncManager] PubNub SDK not found. Pass it via config.PubNub, ' +
        'include it via script tag, or install via npm.'
      );
    }

    if (!this.config.publishKey || !this.config.subscribeKey) {
      throw new Error('[SyncManager] publishKey and subscribeKey are required.');
    }

    if (!this.video) {
      throw new Error('[SyncManager] No video element attached to player.');
    }

    this.channelName = `shaka-sync-${roomId}`;
    console.log('[SyncManager] Connecting to room:', this.channelName);

    // Build PubNub config, conditionally including secretKey for Access Manager
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pubnubConfig: any = {
      publishKey: this.config.publishKey,
      subscribeKey: this.config.subscribeKey,
      userId: this.userId,
    };

    if (this.config.secretKey) {
      pubnubConfig.secretKey = this.config.secretKey;
      console.log('[SyncManager] Secret Key provided — Access Manager grant operations enabled');
    }

    // Initialize PubNub client
    this.pubnub = new PubNubClass(pubnubConfig);

    // Apply auth token if provided (Access Manager v3)
    if (this.config.authToken) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.pubnub as any).setToken(this.config.authToken);
      console.log('[SyncManager] Auth token applied');
    }

    // Set up status listener
    this.pubnub.addListener({
      status: (statusEvent) => this.onPubNubStatus(statusEvent),
    });

    // Create subscription
    const channel = this.pubnub.channel(this.channelName);
    this.subscription = channel.subscription({
      receivePresenceEvents: true,
    });

    // Set up message and presence handlers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.subscription.onMessage = (event: any) => this.onPubNubMessage(event);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.subscription.onPresence = (event: any) => this.onPubNubPresence(event);

    // Subscribe
    this.subscription.subscribe();

    // Attach video event listeners
    this.attachVideoListeners();

    this.connected = true;
    this.emit('connected', { roomId });
    console.log('[SyncManager] Connected to room:', roomId);
  }

  /**
   * Disconnects from the current sync room.
   */
  disconnect(): void {
    console.log('[SyncManager] Disconnecting from room:', this.channelName);
    const roomId = this.getRoomId();

    // Stop timers
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.remoteCommandTimeout) {
      clearTimeout(this.remoteCommandTimeout);
      this.remoteCommandTimeout = null;
    }

    // Remove video listeners
    this.detachVideoListeners();

    // Unsubscribe from PubNub
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }

    // Clean up PubNub client
    if (this.pubnub) {
      this.pubnub.removeAllListeners();
      this.pubnub.destroy();
      this.pubnub = null;
    }

    this.connected = false;
    this.role = 'follower';
    this.channelName = '';

    this.emit('disconnected', { roomId });
    console.log('[SyncManager] Disconnected');
  }

  /**
   * Makes this client the master controller.
   * The master's playback actions are broadcast to all followers.
   */
  becomeMaster(): void {
    console.log('[SyncManager] Becoming MASTER');
    this.role = 'master';

    // Broadcast master claim
    this.broadcastMasterClaim();

    // Broadcast current state
    this.broadcastFullState();

    // Start sync interval
    this.startSyncInterval();
  }

  /**
   * Makes this client a follower.
   * Followers receive and apply sync commands from the master.
   */
  becomeFollower(): void {
    console.log('[SyncManager] Becoming FOLLOWER');
    this.role = 'follower';

    // Stop sync timer
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Returns the current role of this client.
   */
  getRole(): SyncRole {
    return this.role;
  }

  /**
   * Returns whether we're currently connected to a sync room.
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Returns the current room ID.
   */
  getRoomId(): string {
    return this.channelName.replace('shaka-sync-', '');
  }

  /**
   * Returns this client's user ID.
   */
  getUserId(): string {
    return this.userId;
  }

  // =========================================================================
  // PUBLIC API: Access Manager
  // =========================================================================

  /**
   * Sets (or replaces) the Access Manager auth token at runtime.
   * Use this to refresh an expired token without reconnecting.
   *
   * @param token - A valid Access Manager v3 token string
   */
  setAuthToken(token: string): void {
    if (!this.pubnub) {
      // Store it for the next connect() call
      this.config.authToken = token;
      console.log('[SyncManager] Auth token stored (will be applied on connect)');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.pubnub as any).setToken(token);
    this.config.authToken = token;
    console.log('[SyncManager] Auth token updated at runtime');
  }

  /**
   * Grants an Access Manager v3 token for the current sync room.
   * **Requires `secretKey` in the config.** This should only be called
   * from a server or for demo/testing purposes.
   *
   * @param options - Grant options (ttl, optional authorized_uuid, optional channel permissions)
   * @returns The granted token string
   */
  async grantToken(options: GrantTokenOptions): Promise<string> {
    if (!this.pubnub) {
      throw new Error('[SyncManager] Not connected. Call connect() before grantToken().');
    }

    if (!this.config.secretKey) {
      throw new Error(
        '[SyncManager] secretKey is required to grant tokens. ' +
        'Provide it in the SyncManager config (server-side or demo only).'
      );
    }

    const channelName = this.channelName || `shaka-sync-${options.authorized_uuid || 'unknown'}`;
    // Default channels: grant read+write on the sync channel AND read on the
    // presence channel (-pnpres). Without the -pnpres grant, presence events
    // (join/leave/timeout) will be denied when Access Manager is enabled.
    const channels = options.channels || {
      [channelName]: { read: true, write: true },
      [`${channelName}-pnpres`]: { read: true },
    };

    try {
      // Build grant params — only include authorized_uuid if explicitly provided.
      // Per PubNub docs: if authorized_uuid is omitted, the token can be used
      // by any client with any userId (required for sharing tokens across users).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const grantParams: any = {
        ttl: options.ttl,
        resources: {
          channels,
        },
      };

      if (options.authorized_uuid) {
        grantParams.authorized_uuid = options.authorized_uuid;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (this.pubnub as any).grantToken(grantParams);

      // The result is the token string directly
      const token = typeof result === 'string' ? result : result?.data?.token || result?.token || result;
      console.log('[SyncManager] Token granted, TTL:', options.ttl, 'min');
      return token;
    } catch (error) {
      console.error('[SyncManager] Failed to grant token:', error);
      throw error;
    }
  }

  /**
   * Parses an Access Manager v3 token and returns the embedded permissions.
   * Useful for debugging and inspecting token contents.
   *
   * @param token - The token string to parse
   * @returns Parsed token object with ttl, authorized_uuid, resources, and patterns
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parseToken(token: string): any {
    if (!this.pubnub) {
      throw new Error('[SyncManager] Not connected. Call connect() before parseToken().');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.pubnub as any).parseToken(token);
  }

  /**
   * Static utility to parse an Access Manager token without needing a
   * connected SyncManager instance. Requires passing the PubNub class.
   *
   * @param token - The token string to parse
   * @param PubNubClass - The PubNub constructor class
   * @returns Parsed token object
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static parseToken(token: string, PubNubClass: new (config: any) => PubNub): any {
    const tempPubnub = new PubNubClass({
      subscribeKey: 'parse-only',
      userId: 'parse-only',
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (tempPubnub as any).parseToken(token);
  }

  /**
   * Adds an event listener.
   */
  addEventListener<K extends keyof SyncManagerEvents>(
    event: K,
    listener: SyncEventListener<K>
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener as SyncEventListener<keyof SyncManagerEvents>);
  }

  /**
   * Removes an event listener.
   */
  removeEventListener<K extends keyof SyncManagerEvents>(
    event: K,
    listener: SyncEventListener<K>
  ): void {
    this.eventListeners.get(event)?.delete(listener as SyncEventListener<keyof SyncManagerEvents>);
  }

  /**
   * Destroys the SyncManager and releases all resources.
   */
  async destroy(): Promise<void> {
    this.disconnect();
    this.video = null;
    this.eventListeners.clear();
  }

  // =========================================================================
  // PRIVATE: Video Event Handlers
  // =========================================================================

  private attachVideoListeners(): void {
    if (!this.video) return;

    this.video.addEventListener('play', this.boundHandlers.onPlay);
    this.video.addEventListener('pause', this.boundHandlers.onPause);
    this.video.addEventListener('seeked', this.boundHandlers.onSeeked);
    this.video.addEventListener('ratechange', this.boundHandlers.onRateChange);

    console.log('[SyncManager] Video listeners attached');
  }

  private detachVideoListeners(): void {
    if (!this.video) return;

    this.video.removeEventListener('play', this.boundHandlers.onPlay);
    this.video.removeEventListener('pause', this.boundHandlers.onPause);
    this.video.removeEventListener('seeked', this.boundHandlers.onSeeked);
    this.video.removeEventListener('ratechange', this.boundHandlers.onRateChange);

    console.log('[SyncManager] Video listeners detached');
  }

  private onLocalPlay(): void {
    if (this.isProcessingRemoteCommand || this.role !== 'master') return;

    console.log('[SyncManager] Local PLAY detected');
    this.broadcastCommand('play', { currentTime: this.video!.currentTime });
  }

  private onLocalPause(): void {
    if (this.isProcessingRemoteCommand || this.role !== 'master') return;

    console.log('[SyncManager] Local PAUSE detected');
    this.broadcastCommand('pause', { currentTime: this.video!.currentTime });
  }

  private onLocalSeeked(): void {
    if (this.isProcessingRemoteCommand || this.role !== 'master') return;

    console.log('[SyncManager] Local SEEK detected');
    this.broadcastCommand('seek', { currentTime: this.video!.currentTime });
  }

  private onLocalRateChange(): void {
    if (this.isProcessingRemoteCommand || this.role !== 'master') return;

    console.log('[SyncManager] Local RATE CHANGE detected');
    this.broadcastCommand('ratechange', { playbackRate: this.video!.playbackRate });
  }

  // =========================================================================
  // PRIVATE: PubNub Communication
  // =========================================================================

  private async broadcastCommand(
    command: SyncMessage['command'],
    payload: Partial<SyncPayload>
  ): Promise<void> {
    if (!this.pubnub || !this.connected) {
      console.warn('[SyncManager] Cannot broadcast: not connected');
      return;
    }

    const message: SyncMessage = {
      type: 'SYNC_COMMAND',
      command,
      payload: {
        ...payload,
        timestamp: Date.now(),
        senderId: this.userId,
        isPaused: this.video!.paused,
      } as SyncPayload,
    };

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const publishParams = { channel: this.channelName, message: message } as any;
      await this.pubnub.publish(publishParams);
      console.log('[SyncManager] Broadcast:', command, payload);
    } catch (error) {
      // Check for 403 Forbidden (Access Manager denial)
      if (this.isAccessDeniedError(error)) {
        console.warn('[SyncManager] Access denied on publish — attempting token refresh');
        const refreshed = await this.attemptTokenRefresh();
        if (refreshed) {
          // Retry the publish once after token refresh
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const retryParams = { channel: this.channelName, message: message } as any;
            await this.pubnub!.publish(retryParams);
            console.log('[SyncManager] Broadcast (after refresh):', command, payload);
            return;
          } catch (retryError) {
            console.error('[SyncManager] Broadcast failed after token refresh:', retryError);
          }
        }
        return;
      }
      console.error('[SyncManager] Failed to broadcast:', error);
    }
  }

  private broadcastFullState(): void {
    this.broadcastCommand('sync', {
      currentTime: this.video!.currentTime,
      playbackRate: this.video!.playbackRate,
      isPaused: this.video!.paused,
    });
  }

  private async broadcastMasterClaim(): Promise<void> {
    if (!this.pubnub || !this.connected) return;

    const message: SyncMessage = {
      type: 'MASTER_CLAIM',
      payload: {
        timestamp: Date.now(),
        senderId: this.userId,
        isPaused: this.video!.paused,
      },
    };

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const publishParams = { channel: this.channelName, message: message } as any;
      await this.pubnub.publish(publishParams);
      console.log('[SyncManager] Broadcast master claim');
    } catch (error) {
      // Check for 403 Forbidden (Access Manager denial)
      if (this.isAccessDeniedError(error)) {
        console.warn('[SyncManager] Access denied on master claim — attempting token refresh');
        const refreshed = await this.attemptTokenRefresh();
        if (refreshed) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const retryParams = { channel: this.channelName, message: message } as any;
            await this.pubnub!.publish(retryParams);
            console.log('[SyncManager] Broadcast master claim (after refresh)');
            return;
          } catch (retryError) {
            console.error('[SyncManager] Master claim failed after token refresh:', retryError);
          }
        }
        return;
      }
      console.error('[SyncManager] Failed to broadcast master claim:', error);
    }
  }

  private startSyncInterval(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      if (this.role === 'master' && this.video && !this.video.paused) {
        this.broadcastFullState();
      }
    }, this.syncIntervalMs);

    console.log('[SyncManager] Sync timer started:', this.syncIntervalMs, 'ms');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private onPubNubMessage(event: any): void {
    const message = event.message as SyncMessage;

    // Ignore our own messages
    if (message.payload?.senderId === this.userId) return;

    // Handle master claim
    if (message.type === 'MASTER_CLAIM') {
      this.handleMasterClaim(message.payload);
      return;
    }

    // Only followers process sync commands
    if (message.type !== 'SYNC_COMMAND' || this.role !== 'follower') return;

    console.log('[SyncManager] Received:', message.command);
    this.applyRemoteCommand(message.command!, message.payload);
  }

  private handleMasterClaim(payload: SyncPayload): void {
    const previousRole = this.role;

    if (this.role === 'master') {
      console.log('[SyncManager] Another user claimed master:', payload.senderId);
      this.becomeFollower();
    }

    this.emit('masterchanged', {
      newMasterId: payload.senderId,
      previousRole,
    });
  }

  private applyRemoteCommand(command: string, payload: SyncPayload): void {
    this.isProcessingRemoteCommand = true;

    // Calculate latency compensation
    const latencyMs = Date.now() - payload.timestamp;
    const latencySec = latencyMs / 1000;

    console.log('[SyncManager] Applying:', command, 'latency:', latencyMs, 'ms');

    switch (command) {
      case 'play':
        if (payload.currentTime !== undefined) {
          this.video!.currentTime = payload.currentTime + latencySec;
        }
        this.video!.play().catch((e) => {
          console.warn('[SyncManager] Play failed:', e);
        });
        break;

      case 'pause':
        this.video!.pause();
        if (payload.currentTime !== undefined) {
          this.video!.currentTime = payload.currentTime;
        }
        break;

      case 'seek':
        if (payload.currentTime !== undefined) {
          this.video!.currentTime = payload.currentTime + latencySec;
        }
        break;

      case 'ratechange':
        if (payload.playbackRate !== undefined) {
          this.video!.playbackRate = payload.playbackRate;
        }
        break;

      case 'sync':
        this.handleSyncPulse(payload, latencySec);
        break;
    }

    // Re-enable local events after short delay
    if (this.remoteCommandTimeout) {
      clearTimeout(this.remoteCommandTimeout);
    }
    this.remoteCommandTimeout = setTimeout(() => {
      this.isProcessingRemoteCommand = false;
    }, 100);
  }

  private handleSyncPulse(payload: SyncPayload, latencySec: number): void {
    if (payload.currentTime !== undefined) {
      const expectedTime = payload.currentTime + latencySec;
      const drift = Math.abs(this.video!.currentTime - expectedTime);

      if (drift > this.maxDriftThreshold) {
        console.log('[SyncManager] Drift correction:', drift.toFixed(3), 's');
        this.video!.currentTime = expectedTime;
      }
    }

    // Sync playback rate
    if (payload.playbackRate !== undefined && this.video!.playbackRate !== payload.playbackRate) {
      this.video!.playbackRate = payload.playbackRate;
    }

    // Sync play/pause state
    if (payload.isPaused && !this.video!.paused) {
      this.video!.pause();
    } else if (!payload.isPaused && this.video!.paused) {
      this.video!.play().catch((e) => {
        console.warn('[SyncManager] Play failed during sync:', e);
      });
    }
  }

  private onPubNubStatus(statusEvent: { category: string }): void {
    console.log('[SyncManager] PubNub status:', statusEvent.category);

    // Detect Access Manager denied status on subscribe
    if (statusEvent.category === 'PNAccessDeniedCategory') {
      console.warn('[SyncManager] Access denied on subscribe channel');
      this.attemptTokenRefresh().then((refreshed) => {
        if (!refreshed) {
          // No refresh callback or refresh failed — emit event
          this.emit('accessdenied', {
            reason: 'Subscribe access denied. Token may be missing, expired, or lacks read permission.',
          });
        }
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private onPubNubPresence(event: any): void {
    console.log('[SyncManager] Presence:', event.action, event.uuid);

    if (event.action === 'join' && event.uuid !== this.userId) {
      this.emit('userjoined', { userId: event.uuid, occupancy: event.occupancy });
    } else if (event.action === 'leave' || event.action === 'timeout') {
      this.emit('userleft', { userId: event.uuid, occupancy: event.occupancy });
    }
  }

  // =========================================================================
  // PRIVATE: Access Manager Helpers
  // =========================================================================

  /**
   * Checks whether an error is a 403 Access Denied error from PubNub.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private isAccessDeniedError(error: any): boolean {
    if (!error) return false;
    // PubNub SDK errors may contain statusCode or status
    const statusCode = error?.status?.statusCode || error?.statusCode || error?.status;
    if (statusCode === 403) return true;
    // Also check the error message
    const msg = String(error?.message || error || '').toLowerCase();
    return msg.includes('forbidden') || msg.includes('access denied') || msg.includes('403');
  }

  /**
   * Attempts to refresh the auth token using the configured `onTokenExpired` callback.
   * Returns true if the token was successfully refreshed and applied.
   */
  private async attemptTokenRefresh(): Promise<boolean> {
    if (!this.config.onTokenExpired) {
      this.emit('accessdenied', {
        reason: 'Access denied (403). No onTokenExpired callback configured to refresh the token.',
      });
      return false;
    }

    try {
      console.log('[SyncManager] Calling onTokenExpired callback to refresh token...');
      const newToken = await this.config.onTokenExpired();

      if (newToken && typeof newToken === 'string') {
        this.setAuthToken(newToken);
        console.log('[SyncManager] Token refreshed successfully');
        return true;
      }

      console.warn('[SyncManager] onTokenExpired callback returned an invalid token');
      this.emit('accessdenied', {
        reason: 'Token refresh callback returned an invalid token.',
      });
      return false;
    } catch (error) {
      console.error('[SyncManager] Token refresh callback failed:', error);
      this.emit('accessdenied', {
        reason: `Token refresh failed: ${error instanceof Error ? error.message : String(error)}`,
      });
      return false;
    }
  }

  // =========================================================================
  // PRIVATE: Utilities
  // =========================================================================

  private generateUserId(): string {
    return 'shaka-user-' + Math.random().toString(36).substring(2, 11);
  }

  private getGlobalPubNub(): typeof PubNub | undefined {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return typeof (globalThis as any).PubNub !== 'undefined'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (globalThis as any).PubNub
      : undefined;
  }

  private emit<K extends keyof SyncManagerEvents>(
    event: K,
    data: SyncManagerEvents[K]
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        (listener as SyncEventListener<K>)(data);
      });
    }
  }
}
