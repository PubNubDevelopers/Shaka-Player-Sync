# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Initial release of `@pubnub/shaka-player`

---

## [1.0.0] - 2026-01-28

### Added

#### Core Features
- **SyncManager class** for managing real-time playback synchronization
- **Master/Follower model** - one client controls playback, others follow
- **Sync commands** - play, pause, seek, ratechange, and periodic sync pulses
- **Latency compensation** - accounts for network delay when applying commands
- **Drift correction** - automatically realigns clients that drift apart
- **Configurable thresholds** - customize drift threshold and sync interval

#### Events
- `masterchanged` - emitted when a new client claims master role
- `userjoined` - emitted when a user joins the sync room
- `userleft` - emitted when a user leaves or times out
- `connected` - emitted when connected to a room
- `disconnected` - emitted when disconnected from a room

#### API Methods
- `connect(roomId)` - join a sync room
- `disconnect()` - leave the current room
- `becomeMaster()` - take control of playback
- `becomeFollower()` - follow the master
- `getRole()` - get current role
- `isConnected()` - check connection status
- `getRoomId()` - get current room ID
- `getUserId()` - get this client's user ID
- `getPlayer()` - get the Shaka Player instance
- `addEventListener()` / `removeEventListener()` - event handling
- `destroy()` - clean up resources

#### Configuration Options
- `publishKey` - PubNub publish key (required)
- `subscribeKey` - PubNub subscribe key (required)
- `userId` - unique client identifier (optional, auto-generated)
- `maxDriftThreshold` - seconds before drift correction (default: 0.5)
- `syncIntervalMs` - sync pulse interval in ms (default: 5000)
- `PubNub` - PubNub constructor class (for bundlers)

#### Build Outputs
- CommonJS (`dist/index.js`)
- ES Modules (`dist/index.mjs`)
- IIFE for browsers (`dist/index.global.js`)
- TypeScript declarations (`dist/index.d.ts`)

#### Documentation
- Comprehensive README with quick start guide
- API reference documentation
- Getting Started tutorial
- Watch Party tutorial
- Architecture documentation
- Testing guide

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | 2026-01-28 | Initial release |

---

## Migration Guide

### From Shaka Player Fork

If you were using the `@pubnub/shaka-player` fork:

1. **Install new packages**:
   ```bash
   npm uninstall @pubnub/shaka-player
   npm install shaka-player pubnub @pubnub/shaka-player
   ```

2. **Update imports**:
   ```typescript
   // Before
   import shaka from '@pubnub/shaka-player';
   const syncManager = new shaka.sync.SyncManager(player, config);

   // After
   import shaka from 'shaka-player';
   import { SyncManager } from '@pubnub/shaka-player';
   const syncManager = new SyncManager(player, config);
   ```

3. **Pass PubNub class when using bundlers**:
   ```typescript
   import PubNub from 'pubnub';
   const syncManager = new SyncManager(player, {
     ...config,
     PubNub: PubNub,
   });
   ```

The API is otherwise identical.
