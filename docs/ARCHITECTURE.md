# Architecture Overview

This document explains the internal architecture of `@pubnub/shaka-player` and how it enables real-time playback synchronization.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Watch Party System                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────┐          ┌─────────────────────────┐          │
│  │      Master Client      │          │     Follower Clients    │          │
│  │                         │          │                         │          │
│  │  ┌─────────────────┐    │          │    ┌─────────────────┐  │          │
│  │  │  Shaka Player   │    │          │    │  Shaka Player   │  │          │
│  │  │  ┌───────────┐  │    │          │    │  ┌───────────┐  │  │          │
│  │  │  │   Video   │  │    │          │    │  │   Video   │  │  │          │
│  │  │  └───────────┘  │    │          │    │  └───────────┘  │  │          │
│  │  └────────┬────────┘    │          │    └────────▲────────┘  │          │
│  │           │             │          │             │           │          │
│  │  ┌────────▼────────┐    │          │    ┌────────┴────────┐  │          │
│  │  │  SyncManager    │    │          │    │  SyncManager    │  │          │
│  │  │  (master mode)  │    │          │    │ (follower mode) │  │          │
│  │  └────────┬────────┘    │          │    └────────▲────────┘  │          │
│  │           │             │          │             │           │          │
│  └───────────┼─────────────┘          └─────────────┼───────────┘          │
│              │                                      │                       │
│              │         ┌───────────────────┐        │                       │
│              └────────▶│   PubNub Cloud    │────────┘                       │
│                        │                   │                                │
│                        │  • Pub/Sub        │                                │
│                        │  • Presence       │                                │
│                        │  • < 100ms RTT    │                                │
│                        └───────────────────┘                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### SyncManager

The core class that bridges Shaka Player with PubNub.

```
┌─────────────────────────────────────────────────────────────────┐
│                         SyncManager                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐    ┌──────────────────┐                  │
│  │  Video Listeners │    │  PubNub Client   │                  │
│  │                  │    │                  │                  │
│  │  • play          │    │  • subscribe()   │                  │
│  │  • pause         │    │  • publish()     │                  │
│  │  • seeked        │    │  • presence      │                  │
│  │  • ratechange    │    │                  │                  │
│  └────────┬─────────┘    └────────┬─────────┘                  │
│           │                       │                             │
│           ▼                       ▼                             │
│  ┌─────────────────────────────────────────────┐               │
│  │              Event Router                    │               │
│  │                                              │               │
│  │  Master Mode:                                │               │
│  │    video event → broadcast to room           │               │
│  │                                              │               │
│  │  Follower Mode:                              │               │
│  │    room message → apply to video             │               │
│  └─────────────────────────────────────────────┘               │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Sync Timer   │  │ Drift Check  │  │ Latency Comp │          │
│  │ (5s pulses)  │  │ (threshold)  │  │ (timestamp)  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Master → Followers (Playback Control)

```
┌────────────────┐     ┌──────────────┐     ┌────────────────┐
│  Master User   │     │    PubNub    │     │ Follower User  │
│  clicks PLAY   │     │    Cloud     │     │                │
└───────┬────────┘     └──────────────┘     └────────────────┘
        │
        ▼
┌───────────────────┐
│ Video dispatches  │
│ 'play' event      │
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│ SyncManager       │
│ intercepts event  │
│ (master mode)     │
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│ Create message:   │
│ {                 │
│   type: SYNC_CMD, │
│   command: 'play',│
│   payload: {      │
│     currentTime,  │───────────────┐
│     timestamp,    │               │
│     senderId      │               ▼
│   }               │      ┌────────────────┐
│ }                 │      │ Publish to     │
└───────────────────┘      │ PubNub channel │
                           └───────┬────────┘
                                   │
                                   ▼
                    ┌──────────────────────────┐
                    │  PubNub routes message   │
                    │  to all subscribers      │
                    │  (< 100ms)               │
                    └──────────────┬───────────┘
                                   │
                                   ▼
                    ┌──────────────────────────┐
                    │  SyncManager receives    │
                    │  (follower mode)         │
                    └──────────────┬───────────┘
                                   │
                                   ▼
                    ┌──────────────────────────┐
                    │  Calculate latency:      │
                    │  latency = now - msg.ts  │
                    │                          │
                    │  Adjust time:            │
                    │  newTime = currentTime   │
                    │           + latency      │
                    └──────────────┬───────────┘
                                   │
                                   ▼
                    ┌──────────────────────────┐
                    │  Apply to video:         │
                    │  video.currentTime = t   │
                    │  video.play()            │
                    └──────────────────────────┘
```

---

### Master Claim Flow

```
┌─────────┐                              ┌─────────┐
│Client A │                              │Client B │
│(master) │                              │(follower)│
└────┬────┘                              └────┬────┘
     │                                        │
     │  Client B clicks "Become Master"       │
     │                                        │
     │                              ┌─────────▼─────────┐
     │                              │ Broadcast         │
     │                              │ MASTER_CLAIM      │
     │                              │ { senderId: B }   │
     │                              └─────────┬─────────┘
     │                                        │
     │◀───────── PubNub ──────────────────────┤
     │                                        │
┌────▼─────────────────┐                      │
│ Receive MASTER_CLAIM │                      │
│ from Client B        │                      │
└────┬─────────────────┘                      │
     │                                        │
┌────▼─────────────────┐                      │
│ Current role: master │                      │
│ → Call becomeFollower│                      │
│ → Stop sync timer    │                      │
└────┬─────────────────┘                      │
     │                                        │
┌────▼─────────────────┐           ┌──────────▼─────────┐
│ Emit 'masterchanged' │           │ Emit 'masterchanged'│
│ {                    │           │ {                   │
│   newMasterId: B,    │           │   newMasterId: B,   │
│   previousRole:      │           │   previousRole:     │
│     'master'         │           │     'follower'      │
│ }                    │           │ }                   │
└──────────────────────┘           └─────────────────────┘
```

---

### Periodic Sync Pulse

```
┌────────────────────────────────────────────────────────────────┐
│                    Master Sync Timer                           │
│                                                                │
│    Every 5000ms (configurable via syncIntervalMs):             │
│                                                                │
│    ┌──────────────────────────────────────────────────────┐   │
│    │  if (role === 'master' && !video.paused) {           │   │
│    │      broadcast({                                      │   │
│    │          type: 'SYNC_COMMAND',                        │   │
│    │          command: 'sync',                             │   │
│    │          payload: {                                   │   │
│    │              currentTime: video.currentTime,          │   │
│    │              playbackRate: video.playbackRate,        │   │
│    │              isPaused: false,                         │   │
│    │              timestamp: Date.now(),                   │   │
│    │              senderId: userId                         │   │
│    │          }                                            │   │
│    │      });                                              │   │
│    │  }                                                    │   │
│    └──────────────────────────────────────────────────────┘   │
│                                                                │
│    Purpose: Keep long-running sessions aligned even if         │
│    no user actions occur for extended periods.                 │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

### Drift Correction Algorithm

```
┌────────────────────────────────────────────────────────────────┐
│               Follower Drift Correction                        │
│                                                                │
│    On receiving 'sync' command:                                │
│                                                                │
│    1. Calculate network latency                                │
│       ┌──────────────────────────────────────────────┐        │
│       │  latencyMs = Date.now() - payload.timestamp  │        │
│       │  latencySec = latencyMs / 1000               │        │
│       └──────────────────────────────────────────────┘        │
│                                                                │
│    2. Calculate expected position                              │
│       ┌──────────────────────────────────────────────┐        │
│       │  expectedTime = payload.currentTime          │        │
│       │                 + latencySec                 │        │
│       └──────────────────────────────────────────────┘        │
│                                                                │
│    3. Measure drift                                            │
│       ┌──────────────────────────────────────────────┐        │
│       │  drift = |video.currentTime - expectedTime|  │        │
│       └──────────────────────────────────────────────┘        │
│                                                                │
│    4. Correct only if needed                                   │
│       ┌──────────────────────────────────────────────┐        │
│       │  if (drift > maxDriftThreshold) {            │        │
│       │      video.currentTime = expectedTime;       │        │
│       │      log('Drift corrected:', drift);         │        │
│       │  }                                           │        │
│       │  // else: skip to avoid jitter               │        │
│       └──────────────────────────────────────────────┘        │
│                                                                │
│    Default maxDriftThreshold: 0.5 seconds                      │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Message Types

### SYNC_COMMAND

Sent by master for playback control.

```
┌─────────────────────────────────────────────────┐
│  Message Structure                              │
├─────────────────────────────────────────────────┤
│  {                                              │
│    type: 'SYNC_COMMAND',                        │
│    command: 'play' | 'pause' | 'seek' |         │
│             'sync' | 'ratechange',              │
│    payload: {                                   │
│      timestamp: number,    // Unix ms           │
│      senderId: string,     // User ID           │
│      isPaused: boolean,    // Pause state       │
│      currentTime?: number, // Playback position │
│      playbackRate?: number // Speed (1.0 = 1x)  │
│    }                                            │
│  }                                              │
└─────────────────────────────────────────────────┘
```

### MASTER_CLAIM

Sent when a client claims master role.

```
┌─────────────────────────────────────────────────┐
│  Message Structure                              │
├─────────────────────────────────────────────────┤
│  {                                              │
│    type: 'MASTER_CLAIM',                        │
│    payload: {                                   │
│      timestamp: number,    // Unix ms           │
│      senderId: string,     // New master's ID   │
│      isPaused: boolean     // Current state     │
│    }                                            │
│  }                                              │
└─────────────────────────────────────────────────┘
```

---

## Channel Naming Convention

```
Room ID:    "friday-movie-night"
            ↓
Channel:    "shaka-sync-friday-movie-night"
            ↓
Presence:   "shaka-sync-friday-movie-night-pnpres"
```

---

## Event Flow Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                      Event Flow Matrix                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Event Source          Master Action         Follower Action    │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  video 'play'          Broadcast 'play'      (ignored)          │
│  video 'pause'         Broadcast 'pause'     (ignored)          │
│  video 'seeked'        Broadcast 'seek'      (ignored)          │
│  video 'ratechange'    Broadcast 'rate'      (ignored)          │
│                                                                 │
│  Sync timer tick       Broadcast 'sync'      (N/A)              │
│                                                                 │
│  PubNub 'play'         (ignore own)          Apply play + seek  │
│  PubNub 'pause'        (ignore own)          Apply pause        │
│  PubNub 'seek'         (ignore own)          Apply seek         │
│  PubNub 'sync'         (ignore own)          Drift check        │
│  PubNub 'ratechange'   (ignore own)          Apply rate         │
│  PubNub MASTER_CLAIM   Become follower       Emit event         │
│                                                                 │
│  PubNub presence       Emit join/leave       Emit join/leave    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## State Machine

```
                              ┌────────────────┐
                              │  Disconnected  │
                              └───────┬────────┘
                                      │
                                      │ connect(roomId)
                                      ▼
                              ┌────────────────┐
                              │   Connected    │
                              │   (Follower)   │◀─────────┐
                              └───────┬────────┘          │
                                      │                   │
                         becomeMaster()│                  │ MASTER_CLAIM
                                      │                   │ received
                                      ▼                   │
                              ┌────────────────┐          │
                              │   Connected    │──────────┘
                              │    (Master)    │
                              └───────┬────────┘
                                      │
                                      │ disconnect()
                                      ▼
                              ┌────────────────┐
                              │  Disconnected  │
                              └────────────────┘
```

---

## Performance Characteristics

| Metric | Typical Value | Notes |
|--------|---------------|-------|
| Message latency | < 100ms | PubNub global network |
| Sync pulse interval | 5000ms | Configurable |
| Drift threshold | 500ms | Configurable |
| Memory overhead | ~50KB | Excluding PubNub SDK |
| Bundle size (gzip) | ~4KB | ESM build |

---

## Security Considerations

1. **PubNub Access Manager** — Use tokens to restrict channel access
2. **User ID validation** — Consider server-side user ID generation
3. **Rate limiting** — PubNub provides built-in message rate limits
4. **Channel isolation** — Each room uses a unique channel name

---

## Future Architecture Considerations

```
┌─────────────────────────────────────────────────────────────────┐
│                    Potential Enhancements                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Multiple Masters (voting/consensus)                         │
│     └─► Use PubNub Functions for server-side coordination       │
│                                                                 │
│  2. Master Persistence                                          │
│     └─► Store master ID in PubNub App Context                   │
│                                                                 │
│  3. Playback History                                            │
│     └─► Use PubNub Message Persistence for late joiners         │
│                                                                 │
│  4. Quality-aware Sync                                          │
│     └─► Coordinate ABR decisions across clients                 │
│                                                                 │
│  5. Server-side Master                                          │
│     └─► Headless browser or media server as authoritative       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```
