# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added - Access Manager (PAM v3) Support

#### New API Methods
- `setAuthToken(token)` — Set or refresh the Access Manager auth token at runtime
- `grantToken(options)` — Grant an Access Manager token (requires `secretKey`)
- `parseToken(token)` — Decode a token to inspect permissions and TTL
- `SyncManager.parseToken(token, PubNub)` — Static token parser (no connection needed)

#### New Configuration Options
- `authToken` — Pre-set an Access Manager v3 token
- `secretKey` — PubNub Secret Key for server-side/demo token grants
- `onTokenExpired` — Async callback for automatic token refresh on 403

#### New Events
- `accessdenied` — Emitted when a 403 Forbidden response is received from PubNub

#### Improvements
- `connect()` now conditionally includes `secretKey` and applies `authToken` via `setToken()`
- `broadcastCommand()` and `broadcastMasterClaim()` detect 403 errors and auto-retry after token refresh
- `onPubNubStatus()` detects `PNAccessDeniedCategory` and triggers token refresh
- Demo updated with full Access Manager UI (Admin/Follower modes, token granting, copy/paste workflow)
- PubNub SDK updated to v10.2.7 for Access Manager v3 `grantToken`/`setToken` support

---

## [1.1.1](https://github.com/PubNubDevelopers/Shaka-Player-Sync/compare/v1.1.0...v1.1.1) (2026-02-02)


### Bug Fixes

* prepare npm publish with correct tokens ([8a1c163](https://github.com/PubNubDevelopers/Shaka-Player-Sync/commit/8a1c16365102db84332d80d9dfefc581d187edaf))

## [1.1.0](https://github.com/PubNubDevelopers/Shaka-Player-Sync/compare/v1.0.1...v1.1.0) (2026-01-30)


### Features

* initial release of shaka-player sync library v1.0.1 ([ead7ab1](https://github.com/PubNubDevelopers/Shaka-Player-Sync/commit/ead7ab13c15bdc4ffbeb9888d5d51566d53eca37))


### Bug Fixes

* add eslint config for v9, disable pages workflow until enabled ([1753795](https://github.com/PubNubDevelopers/Shaka-Player-Sync/commit/1753795669c237fa42af1a7a24035e14628f22b0))
* update package-lock.json with eslint dependencies ([2a9fc84](https://github.com/PubNubDevelopers/Shaka-Player-Sync/commit/2a9fc84fae9c9a0969916fa3e8150ec0fd752f7b))

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
