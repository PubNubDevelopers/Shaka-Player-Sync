# API Reference

Complete API documentation for `@pubnub/shaka-player`.

---

## Table of Contents

- [SyncManager](#syncmanager)
  - [Constructor](#constructor)
  - [Methods](#methods)
  - [Events](#events)
- [Types](#types)
  - [SyncManagerConfig](#syncmanagerconfig)
  - [SyncRole](#syncrole)
  - [SyncPayload](#syncpayload)
  - [SyncMessage](#syncmessage)
  - [Event Data Types](#event-data-types)
- [Error Handling](#error-handling)

---

## SyncManager

The main class for managing real-time playback synchronization.

### Constructor

```typescript
new SyncManager(player: ShakaPlayer, config: SyncManagerConfig)
```

Creates a new SyncManager instance attached to a Shaka Player.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `player` | `ShakaPlayer` | A Shaka Player instance with a video element attached |
| `config` | `SyncManagerConfig` | Configuration object with PubNub credentials |

#### Example

```typescript
import shaka from 'shaka-player';
import PubNub from 'pubnub';
import { SyncManager } from '@pubnub/shaka-player';

const video = document.getElementById('video') as HTMLVideoElement;
const player = new shaka.Player();
await player.attach(video);
await player.load('https://example.com/manifest.mpd');

const syncManager = new SyncManager(player, {
  publishKey: 'pub-c-...',
  subscribeKey: 'sub-c-...',
  userId: 'user-123',
  maxDriftThreshold: 0.5,
  syncIntervalMs: 5000,
  PubNub: PubNub,
});
```

#### Throws

- `Error` if PubNub SDK is not available and not provided via config
- `Error` if `publishKey` or `subscribeKey` is missing when `connect()` is called
- `Error` if no video element is attached to the player when `connect()` is called

---

### Methods

#### `connect(roomId: string): void`

Connects to a sync room and begins listening for sync commands.

| Parameter | Type | Description |
|-----------|------|-------------|
| `roomId` | `string` | Unique identifier for the sync room |

**Example:**

```typescript
syncManager.connect('friday-movie-night');
```

**Notes:**
- The room ID is prefixed with `shaka-sync-` internally
- Automatically subscribes to PubNub with presence enabled
- Emits `connected` event on success

---

#### `disconnect(): void`

Disconnects from the current sync room and cleans up resources.

**Example:**

```typescript
syncManager.disconnect();
```

**Notes:**
- Stops all sync timers
- Unsubscribes from PubNub channel
- Resets role to `follower`
- Emits `disconnected` event

---

#### `becomeMaster(): void`

Makes this client the master controller. The master's playback actions are broadcast to all followers.

**Example:**

```typescript
syncManager.becomeMaster();
```

**Behavior:**
1. Sets role to `master`
2. Broadcasts `MASTER_CLAIM` message to room
3. Broadcasts current playback state
4. Starts periodic sync pulse timer

**Notes:**
- Only one master per room (last claim wins)
- When a new master claims control, the previous master automatically becomes a follower
- The `masterchanged` event is emitted to all clients

---

#### `becomeFollower(): void`

Makes this client a follower. Followers receive and apply sync commands from the master.

**Example:**

```typescript
syncManager.becomeFollower();
```

**Behavior:**
- Sets role to `follower`
- Stops sync pulse timer
- Local playback events no longer broadcast

---

#### `getRole(): SyncRole`

Returns the current role of this client.

**Returns:** `'master'` or `'follower'`

**Example:**

```typescript
const role = syncManager.getRole();
console.log(`I am a ${role}`); // "I am a follower"
```

---

#### `isConnected(): boolean`

Returns whether the client is currently connected to a sync room.

**Returns:** `boolean`

**Example:**

```typescript
if (syncManager.isConnected()) {
  console.log('Connected to:', syncManager.getRoomId());
}
```

---

#### `getRoomId(): string`

Returns the current room ID (without the internal prefix).

**Returns:** `string` — The room ID, or empty string if not connected

**Example:**

```typescript
const roomId = syncManager.getRoomId();
console.log(`Room: ${roomId}`); // "Room: friday-movie-night"
```

---

#### `getUserId(): string`

Returns this client's unique user ID.

**Returns:** `string` — The user ID (auto-generated if not provided in config)

**Example:**

```typescript
const userId = syncManager.getUserId();
console.log(`My ID: ${userId}`); // "My ID: shaka-user-abc123def"
```

---

#### `getPlayer(): ShakaPlayer`

Returns the Shaka Player instance associated with this SyncManager.

**Returns:** `ShakaPlayer`

**Example:**

```typescript
const player = syncManager.getPlayer();
const tracks = player.getVariantTracks();
```

---

#### `addEventListener<K extends keyof SyncManagerEvents>(event: K, listener: SyncEventListener<K>): void`

Adds an event listener for sync events.

| Parameter | Type | Description |
|-----------|------|-------------|
| `event` | `keyof SyncManagerEvents` | Event name |
| `listener` | `SyncEventListener<K>` | Callback function |

**Example:**

```typescript
syncManager.addEventListener('masterchanged', (event) => {
  console.log('New master:', event.newMasterId);
});
```

---

#### `removeEventListener<K extends keyof SyncManagerEvents>(event: K, listener: SyncEventListener<K>): void`

Removes a previously added event listener.

| Parameter | Type | Description |
|-----------|------|-------------|
| `event` | `keyof SyncManagerEvents` | Event name |
| `listener` | `SyncEventListener<K>` | The same callback function passed to `addEventListener` |

**Example:**

```typescript
const onMasterChanged = (event) => {
  console.log('New master:', event.newMasterId);
};

syncManager.addEventListener('masterchanged', onMasterChanged);

// Later...
syncManager.removeEventListener('masterchanged', onMasterChanged);
```

---

#### `destroy(): Promise<void>`

Destroys the SyncManager and releases all resources.

**Returns:** `Promise<void>`

**Example:**

```typescript
await syncManager.destroy();
```

**Notes:**
- Calls `disconnect()` internally
- Clears all event listeners
- Should be called when the component/page is unmounted

---

### Events

#### `masterchanged`

Emitted when the master role changes (a new client claimed control).

**Event Data:**

```typescript
interface MasterChangedEventData {
  newMasterId: string;   // User ID of the new master
  previousRole: SyncRole; // Your role before the change
}
```

**Example:**

```typescript
syncManager.addEventListener('masterchanged', (event) => {
  if (event.previousRole === 'master') {
    console.log('You are no longer the master');
    // Update UI to show follower state
  }
  console.log(`${event.newMasterId} is now controlling playback`);
});
```

---

#### `userjoined`

Emitted when a user joins the sync room.

**Event Data:**

```typescript
interface UserJoinedEventData {
  userId: string;      // User ID of the user who joined
  occupancy?: number;  // Total users in the room
}
```

**Example:**

```typescript
syncManager.addEventListener('userjoined', (event) => {
  console.log(`${event.userId} joined! Total viewers: ${event.occupancy}`);
});
```

---

#### `userleft`

Emitted when a user leaves the sync room (or times out).

**Event Data:**

```typescript
interface UserLeftEventData {
  userId: string;      // User ID of the user who left
  occupancy?: number;  // Total users remaining
}
```

**Example:**

```typescript
syncManager.addEventListener('userleft', (event) => {
  console.log(`${event.userId} left. Remaining viewers: ${event.occupancy}`);
});
```

---

#### `connected`

Emitted when successfully connected to a sync room.

**Event Data:**

```typescript
{ roomId: string }
```

**Example:**

```typescript
syncManager.addEventListener('connected', (event) => {
  console.log(`Connected to room: ${event.roomId}`);
});
```

---

#### `disconnected`

Emitted when disconnected from a sync room.

**Event Data:**

```typescript
{ roomId: string }
```

**Example:**

```typescript
syncManager.addEventListener('disconnected', (event) => {
  console.log(`Disconnected from room: ${event.roomId}`);
});
```

---

## Types

### SyncManagerConfig

Configuration options for initializing SyncManager.

```typescript
interface SyncManagerConfig {
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
   * Required when using npm/bundlers. If not provided, the SyncManager
   * will look for a global `PubNub` variable (from CDN script tag).
   */
  PubNub?: typeof PubNub;
}
```

---

### SyncRole

The role of a client in the sync session.

```typescript
type SyncRole = 'master' | 'follower';
```

| Role | Description |
|------|-------------|
| `master` | Controls playback for all connected clients |
| `follower` | Receives and applies sync commands from the master |

---

### SyncPayload

Payload object sent with sync commands.

```typescript
interface SyncPayload {
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
```

---

### SyncMessage

Message object sent via PubNub.

```typescript
interface SyncMessage {
  /** Message type */
  type: 'SYNC_COMMAND' | 'MASTER_CLAIM';

  /** Command type (for SYNC_COMMAND messages) */
  command?: 'play' | 'pause' | 'seek' | 'sync' | 'ratechange';

  /** Command payload */
  payload: SyncPayload;
}
```

---

### Event Data Types

```typescript
interface MasterChangedEventData {
  newMasterId: string;
  previousRole: SyncRole;
}

interface UserJoinedEventData {
  userId: string;
  occupancy?: number;
}

interface UserLeftEventData {
  userId: string;
  occupancy?: number;
}

interface SyncManagerEvents {
  masterchanged: MasterChangedEventData;
  userjoined: UserJoinedEventData;
  userleft: UserLeftEventData;
  connected: { roomId: string };
  disconnected: { roomId: string };
}

type SyncEventListener<K extends keyof SyncManagerEvents> = (
  event: SyncManagerEvents[K]
) => void;
```

---

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `PubNub SDK not found` | PubNub not loaded | Pass `PubNub` class via config or include via `<script>` tag |
| `publishKey and subscribeKey are required` | Missing credentials | Provide valid PubNub keys from [admin.pubnub.com](https://admin.pubnub.com) |
| `No video element attached to player` | Player not initialized | Call `player.attach(videoElement)` before creating SyncManager |

### Example Error Handling

```typescript
try {
  const syncManager = new SyncManager(player, config);
  syncManager.connect('my-room');
} catch (error) {
  if (error.message.includes('PubNub SDK not found')) {
    console.error('Please install PubNub: npm install pubnub');
  } else if (error.message.includes('publishKey')) {
    console.error('Get your keys at https://admin.pubnub.com');
  } else {
    console.error('Sync error:', error);
  }
}
```

---

## Internal Behavior

### Channel Naming

Room IDs are prefixed internally:

```
roomId: "movie-night" → channel: "shaka-sync-movie-night"
```

### User ID Generation

If no `userId` is provided, one is auto-generated:

```typescript
`shaka-user-${Math.random().toString(36).substring(2, 11)}`
// Example: "shaka-user-k8j2m4n9p"
```

### Sync Command Flow

```
┌──────────┐         ┌─────────┐         ┌──────────┐
│  Master  │         │ PubNub  │         │ Follower │
└────┬─────┘         └────┬────┘         └────┬─────┘
     │                    │                   │
     │  user clicks play  │                   │
     │ ──────────────────▶│                   │
     │                    │                   │
     │  SYNC_COMMAND:play │                   │
     │ ──────────────────▶│──────────────────▶│
     │                    │                   │
     │                    │    apply command  │
     │                    │         +         │
     │                    │ latency compensate│
     │                    │                   │
     └────────────────────┴───────────────────┘
```

### Drift Correction Algorithm

```typescript
// On receiving sync pulse:
const latencyMs = Date.now() - payload.timestamp;
const latencySec = latencyMs / 1000;
const expectedTime = payload.currentTime + latencySec;
const drift = Math.abs(localTime - expectedTime);

if (drift > maxDriftThreshold) {
  video.currentTime = expectedTime; // Correct drift
}
```
