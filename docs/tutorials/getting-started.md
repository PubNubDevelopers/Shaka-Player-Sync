# Getting Started with @pubnub/shaka-player

This tutorial will walk you through setting up real-time playback synchronization for your Shaka Player application.

---

## Prerequisites

Before you begin, make sure you have:

- **Node.js 18+** (for npm installation) or a modern browser
- A **PubNub account** — [Sign up for free](https://admin.pubnub.com)
- Basic familiarity with **Shaka Player**

---

## Step 1: Get Your PubNub Keys

1. Go to [admin.pubnub.com](https://admin.pubnub.com) and sign in (or create an account)
2. Click **Create New App** and give it a name (e.g., "My Watch Party")
3. Click on your new app, then click on the keyset
4. Copy your **Publish Key** and **Subscribe Key**

> 💡 **Tip:** Keep these keys safe. The publish key allows sending messages, while the subscribe key allows receiving them.

---

## Step 2: Install Dependencies

### Option A: npm (Recommended for modern projects)

```bash
npm install @pubnub/shaka-player shaka-player pubnub
```

### Option B: CDN (For quick prototypes or vanilla JS)

```html
<!-- PubNub SDK -->
<script src="https://cdn.pubnub.com/sdk/javascript/pubnub.8.0.0.min.js"></script>

<!-- Shaka Player -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.7.11/shaka-player.compiled.min.js"></script>

<!-- SyncManager -->
<script src="https://unpkg.com/@pubnub/shaka-player/dist/index.global.js"></script>
```

---

## Step 3: Set Up Your HTML

Create a basic HTML page with a video element:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Synchronized Video Player</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      max-width: 800px;
      margin: 2rem auto;
      padding: 0 1rem;
    }
    video {
      width: 100%;
      background: #000;
    }
    .controls {
      margin-top: 1rem;
      display: flex;
      gap: 0.5rem;
    }
    button {
      padding: 0.5rem 1rem;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <h1>Synchronized Video Player</h1>

  <video id="video" controls></video>

  <div class="controls">
    <button id="btn-connect">Connect</button>
    <button id="btn-master">Become Master</button>
    <button id="btn-follower">Become Follower</button>
  </div>

  <p id="status">Status: Not connected</p>

  <!-- Scripts will be added here -->
</body>
</html>
```

---

## Step 4: Initialize Shaka Player

Add the following JavaScript to initialize Shaka Player:

### Using npm/ES Modules

```typescript
import shaka from 'shaka-player';
import PubNub from 'pubnub';
import { SyncManager } from '@pubnub/shaka-player';

// Install polyfills
shaka.polyfill.installAll();

// Check for browser support
if (!shaka.Player.isBrowserSupported()) {
  console.error('Browser not supported!');
  throw new Error('Browser not supported');
}

// Get video element
const video = document.getElementById('video') as HTMLVideoElement;

// Create and attach player
const player = new shaka.Player();
await player.attach(video);

// Load a video (DASH or HLS)
await player.load('https://storage.googleapis.com/shaka-demo-assets/bbb-dark-truths/dash.mpd');

console.log('Player ready!');
```

### Using CDN/Script Tags

```html
<script>
  let player = null;
  let syncManager = null;

  async function initPlayer() {
    // Install polyfills
    shaka.polyfill.installAll();

    if (!shaka.Player.isBrowserSupported()) {
      alert('Browser not supported!');
      return;
    }

    const video = document.getElementById('video');
    player = new shaka.Player();
    await player.attach(video);
    await player.load('https://storage.googleapis.com/shaka-demo-assets/bbb-dark-truths/dash.mpd');

    console.log('Player ready!');
  }

  document.addEventListener('DOMContentLoaded', initPlayer);
</script>
```

---

## Step 5: Add SyncManager

Now add the synchronization layer:

### Using npm/ES Modules

```typescript
// Configuration
const config = {
  publishKey: 'YOUR_PUBLISH_KEY',   // Replace with your key
  subscribeKey: 'YOUR_SUBSCRIBE_KEY', // Replace with your key
  PubNub: PubNub,
};

// Create SyncManager
const syncManager = new SyncManager(player, config);

// UI Elements
const btnConnect = document.getElementById('btn-connect')!;
const btnMaster = document.getElementById('btn-master')!;
const btnFollower = document.getElementById('btn-follower')!;
const status = document.getElementById('status')!;

// Connect to a room
btnConnect.addEventListener('click', () => {
  syncManager.connect('my-first-sync-room');
  status.textContent = `Status: Connected as ${syncManager.getRole()}`;
});

// Become master
btnMaster.addEventListener('click', () => {
  syncManager.becomeMaster();
  status.textContent = 'Status: You are the MASTER';
});

// Become follower
btnFollower.addEventListener('click', () => {
  syncManager.becomeFollower();
  status.textContent = 'Status: You are a FOLLOWER';
});
```

### Using CDN/Script Tags

```html
<script>
  const config = {
    publishKey: 'YOUR_PUBLISH_KEY',   // Replace with your key
    subscribeKey: 'YOUR_SUBSCRIBE_KEY', // Replace with your key
    PubNub: PubNub, // Global from CDN
  };

  function setupSync() {
    const { SyncManager } = PubNubShakaSync;
    syncManager = new SyncManager(player, config);

    document.getElementById('btn-connect').onclick = () => {
      syncManager.connect('my-first-sync-room');
      document.getElementById('status').textContent =
        `Status: Connected as ${syncManager.getRole()}`;
    };

    document.getElementById('btn-master').onclick = () => {
      syncManager.becomeMaster();
      document.getElementById('status').textContent = 'Status: You are the MASTER';
    };

    document.getElementById('btn-follower').onclick = () => {
      syncManager.becomeFollower();
      document.getElementById('status').textContent = 'Status: You are a FOLLOWER';
    };
  }

  async function initPlayer() {
    shaka.polyfill.installAll();
    if (!shaka.Player.isBrowserSupported()) {
      alert('Browser not supported!');
      return;
    }

    const video = document.getElementById('video');
    player = new shaka.Player();
    await player.attach(video);
    await player.load('https://storage.googleapis.com/shaka-demo-assets/bbb-dark-truths/dash.mpd');

    setupSync(); // Initialize sync after player is ready
  }

  document.addEventListener('DOMContentLoaded', initPlayer);
</script>
```

---

## Step 6: Test Synchronization

1. **Open your page in two browser windows** (or tabs)
2. Click **Connect** in both windows
3. In one window, click **Become Master**
4. Play the video in the master window
5. Watch the follower window sync automatically! 🎉

---

## Step 7: Add Event Listeners (Optional)

Enhance your app by listening for sync events:

```typescript
// When master changes
syncManager.addEventListener('masterchanged', (event) => {
  console.log('New master:', event.newMasterId);
  if (event.previousRole === 'master') {
    alert('Someone else took control!');
  }
});

// When users join/leave
syncManager.addEventListener('userjoined', (event) => {
  console.log(`${event.userId} joined. Total: ${event.occupancy}`);
});

syncManager.addEventListener('userleft', (event) => {
  console.log(`${event.userId} left. Total: ${event.occupancy}`);
});

// Connection status
syncManager.addEventListener('connected', (event) => {
  console.log('Connected to:', event.roomId);
});

syncManager.addEventListener('disconnected', (event) => {
  console.log('Disconnected from:', event.roomId);
});
```

---

## Complete Example

Here's a complete, working example you can copy and run:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Synchronized Video Player</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 900px;
      margin: 2rem auto;
      padding: 0 1rem;
      background: #1a1a2e;
      color: #eee;
    }
    h1 { color: #e94560; }
    video {
      width: 100%;
      border-radius: 8px;
      background: #000;
    }
    .controls {
      margin-top: 1rem;
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    button {
      padding: 0.6rem 1.2rem;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 1rem;
      transition: transform 0.1s;
    }
    button:hover { transform: translateY(-2px); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-connect { background: #e94560; color: white; }
    .btn-master { background: #f59e0b; color: #1a1a2e; }
    .btn-follower { background: #3b82f6; color: white; }
    .btn-disconnect { background: #6b7280; color: white; }
    #status {
      margin-top: 1rem;
      padding: 1rem;
      background: #16213e;
      border-radius: 6px;
      font-family: monospace;
    }
    .form-group {
      margin-bottom: 1rem;
    }
    label {
      display: block;
      margin-bottom: 0.3rem;
      color: #aaa;
    }
    input {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid #333;
      border-radius: 4px;
      background: #16213e;
      color: #eee;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <h1>🎬 Synchronized Video Player</h1>

  <video id="video" controls></video>

  <div class="form-group">
    <label for="room-id">Room ID:</label>
    <input type="text" id="room-id" value="getting-started-room" />
  </div>

  <div class="controls">
    <button id="btn-connect" class="btn-connect">Connect</button>
    <button id="btn-disconnect" class="btn-disconnect" disabled>Disconnect</button>
    <button id="btn-master" class="btn-master" disabled>👑 Become Master</button>
    <button id="btn-follower" class="btn-follower" disabled>👥 Become Follower</button>
  </div>

  <div id="status">Status: Initializing player...</div>

  <!-- PubNub SDK -->
  <script src="https://cdn.pubnub.com/sdk/javascript/pubnub.8.0.0.min.js"></script>

  <!-- Shaka Player -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.7.11/shaka-player.compiled.min.js"></script>

  <!-- SyncManager -->
  <script src="https://unpkg.com/@pubnub/shaka-player/dist/index.global.js"></script>

  <script>
    let player = null;
    let syncManager = null;

    // ⚠️ Replace with your PubNub keys!
    const config = {
      publishKey: 'demo',
      subscribeKey: 'demo',
      PubNub: PubNub,
    };

    const btnConnect = document.getElementById('btn-connect');
    const btnDisconnect = document.getElementById('btn-disconnect');
    const btnMaster = document.getElementById('btn-master');
    const btnFollower = document.getElementById('btn-follower');
    const roomInput = document.getElementById('room-id');
    const statusEl = document.getElementById('status');

    function updateStatus(msg) {
      statusEl.textContent = `Status: ${msg}`;
      console.log(msg);
    }

    async function initPlayer() {
      shaka.polyfill.installAll();

      if (!shaka.Player.isBrowserSupported()) {
        updateStatus('❌ Browser not supported!');
        return;
      }

      const video = document.getElementById('video');
      player = new shaka.Player();
      await player.attach(video);

      try {
        await player.load('https://storage.googleapis.com/shaka-demo-assets/bbb-dark-truths/dash.mpd');
        updateStatus('✅ Player ready. Enter a room ID and click Connect.');
      } catch (e) {
        updateStatus(`❌ Failed to load video: ${e.message}`);
      }
    }

    function connect() {
      const roomId = roomInput.value.trim();
      if (!roomId) {
        updateStatus('❌ Please enter a room ID');
        return;
      }

      const { SyncManager } = PubNubShakaSync;
      syncManager = new SyncManager(player, config);

      // Event listeners
      syncManager.addEventListener('masterchanged', (e) => {
        if (e.previousRole === 'master') {
          updateStatus(`⚠️ ${e.newMasterId} took control. You are now a follower.`);
          btnMaster.disabled = false;
          btnFollower.disabled = true;
        } else {
          updateStatus(`👑 ${e.newMasterId} is now the master`);
        }
      });

      syncManager.addEventListener('userjoined', (e) => {
        updateStatus(`👋 ${e.userId} joined (${e.occupancy} viewers)`);
      });

      syncManager.addEventListener('userleft', (e) => {
        updateStatus(`👋 ${e.userId} left (${e.occupancy} viewers)`);
      });

      syncManager.connect(roomId);

      updateStatus(`✅ Connected to "${roomId}" as follower. Your ID: ${syncManager.getUserId()}`);

      btnConnect.disabled = true;
      btnDisconnect.disabled = false;
      btnMaster.disabled = false;
      btnFollower.disabled = true;
      roomInput.disabled = true;
    }

    function disconnect() {
      if (syncManager) {
        syncManager.disconnect();
        syncManager = null;
      }

      updateStatus('Disconnected. Enter a room ID to reconnect.');

      btnConnect.disabled = false;
      btnDisconnect.disabled = true;
      btnMaster.disabled = true;
      btnFollower.disabled = true;
      roomInput.disabled = false;
    }

    function becomeMaster() {
      if (syncManager) {
        syncManager.becomeMaster();
        updateStatus('👑 You are now the MASTER. Play/pause/seek to control everyone!');
        btnMaster.disabled = true;
        btnFollower.disabled = false;
      }
    }

    function becomeFollower() {
      if (syncManager) {
        syncManager.becomeFollower();
        updateStatus('👥 You are now a FOLLOWER. Playback syncs with the master.');
        btnMaster.disabled = false;
        btnFollower.disabled = true;
      }
    }

    // Event bindings
    btnConnect.addEventListener('click', connect);
    btnDisconnect.addEventListener('click', disconnect);
    btnMaster.addEventListener('click', becomeMaster);
    btnFollower.addEventListener('click', becomeFollower);

    // Initialize
    document.addEventListener('DOMContentLoaded', initPlayer);
  </script>
</body>
</html>
```

---

## Troubleshooting

### "PubNub SDK not found"

Make sure you either:
- Pass the `PubNub` class in config when using npm: `{ PubNub: PubNub, ... }`
- Include the PubNub script tag before your code when using CDN

### "Browser not supported"

Shaka Player requires a modern browser with Media Source Extensions (MSE). Check [browser support](https://github.com/shaka-project/shaka-player#browser-support).

### Video doesn't sync

1. Make sure both clients are connected to the **same room ID**
2. Verify one client has clicked **Become Master**
3. Check browser console for errors

---

## Next Steps

- 📖 Read the [API Reference](../API.md) for all available methods
- 🎉 Build a [Watch Party App](./watch-party.md) with chat and user list
- 🔐 Learn about [PubNub Access Manager](https://www.pubnub.com/docs/general/security/access-control) for securing rooms

---

**Questions?** Visit [PubNub Support](https://support.pubnub.com) or open an issue on GitHub.
