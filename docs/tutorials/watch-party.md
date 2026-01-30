# Building a Watch Party Application

This tutorial walks you through building a complete Watch Party application where friends can watch videos together in perfect sync, regardless of their location.

---

## What We're Building

By the end of this tutorial, you'll have a full-featured Watch Party app with:

- ✅ **Synchronized playback** — Everyone sees the same moment
- ✅ **Room system** — Create and join watch parties
- ✅ **Master/Follower controls** — One person controls playback
- ✅ **Viewer count** — See how many people are watching
- ✅ **Activity log** — Real-time event feed
- ✅ **Responsive UI** — Works on desktop and mobile

---

## Prerequisites

- Node.js 18+ or a modern browser
- [PubNub account](https://admin.pubnub.com) (free tier works!)
- Basic HTML/CSS/JavaScript knowledge

---

## Project Setup

### Create Project Structure

```
watch-party/
├── index.html
├── styles.css
└── app.js
```

### Add Dependencies (CDN)

```html
<!-- In your HTML <head> -->
<script src="https://cdn.pubnub.com/sdk/javascript/pubnub.8.0.0.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.7.11/shaka-player.compiled.min.js"></script>
<script src="https://unpkg.com/@pubnub/shaka-player/dist/index.global.js"></script>
```

---

## Step 1: Design the UI

Create `index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Watch Party</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="app">
    <!-- Header -->
    <header class="header">
      <h1>🍿 Watch Party</h1>
      <p class="tagline">Watch together, anywhere</p>
    </header>

    <!-- Main Content -->
    <main class="main">
      <!-- Video Player -->
      <section class="video-section">
        <div class="video-container">
          <video id="video" controls></video>
        </div>
        <div class="video-meta">
          <span class="video-title">Big Buck Bunny</span>
          <span class="viewer-count" id="viewer-count">0 viewers</span>
        </div>
      </section>

      <!-- Sidebar -->
      <aside class="sidebar">
        <!-- Connection Panel -->
        <div class="panel" id="join-panel">
          <h2>Join a Party</h2>

          <div class="form-group">
            <label for="room-id">Room Code</label>
            <input type="text" id="room-id" placeholder="e.g., friday-movie-night" />
          </div>

          <div class="form-group">
            <label for="username">Your Name</label>
            <input type="text" id="username" placeholder="e.g., MovieFan42" />
          </div>

          <button class="btn btn-primary" id="btn-join">
            🎬 Join Party
          </button>

          <p class="hint">
            Share the room code with friends to watch together!
          </p>
        </div>

        <!-- Controls Panel (shown when connected) -->
        <div class="panel hidden" id="controls-panel">
          <h2>Party Controls</h2>

          <div class="status-bar">
            <span class="status-badge" id="connection-status">
              <span class="status-dot"></span>
              Connected
            </span>
            <span class="role-badge" id="role-badge">Follower</span>
          </div>

          <div class="room-info">
            <span class="label">Room:</span>
            <span class="value" id="current-room">-</span>
          </div>

          <div class="btn-group">
            <button class="btn btn-master" id="btn-master">
              👑 Take Control
            </button>
            <button class="btn btn-follower" id="btn-follower" disabled>
              👥 Follow
            </button>
          </div>

          <button class="btn btn-leave" id="btn-leave">
            Leave Party
          </button>
        </div>

        <!-- Activity Log -->
        <div class="panel">
          <h2>Activity</h2>
          <div class="activity-log" id="activity-log">
            <div class="log-entry">Welcome! Join a party to get started.</div>
          </div>
        </div>
      </aside>
    </main>
  </div>

  <!-- Scripts -->
  <script src="https://cdn.pubnub.com/sdk/javascript/pubnub.8.0.0.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.7.11/shaka-player.compiled.min.js"></script>
  <script src="https://unpkg.com/@pubnub/shaka-player/dist/index.global.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

---

## Step 2: Style the Application

Create `styles.css`:

```css
/* ============================================
   Variables & Reset
   ============================================ */
:root {
  --primary: #e94560;
  --primary-hover: #d63d55;
  --bg-dark: #0f0f1a;
  --bg-surface: #1a1a2e;
  --bg-elevated: #252545;
  --text: #f4f4f5;
  --text-muted: #9ca3af;
  --border: #374151;
  --success: #22c55e;
  --warning: #f59e0b;
  --radius: 12px;
  --font: 'Segoe UI', system-ui, sans-serif;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font);
  background: var(--bg-dark);
  color: var(--text);
  min-height: 100vh;
}

/* ============================================
   Layout
   ============================================ */
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  padding: 1.5rem 2rem;
  text-align: center;
  background: linear-gradient(180deg, rgba(233, 69, 96, 0.1), transparent);
}

.header h1 {
  font-size: 1.75rem;
  margin-bottom: 0.25rem;
}

.tagline {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.main {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 1.5rem;
  padding: 0 2rem 2rem;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

@media (max-width: 900px) {
  .main {
    grid-template-columns: 1fr;
    padding: 0 1rem 1rem;
  }
}

/* ============================================
   Video Section
   ============================================ */
.video-section {
  background: var(--bg-surface);
  border-radius: var(--radius);
  overflow: hidden;
  border: 1px solid var(--border);
}

.video-container {
  aspect-ratio: 16 / 9;
  background: #000;
}

video {
  width: 100%;
  height: 100%;
  display: block;
}

.video-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--border);
}

.video-title {
  font-weight: 600;
}

.viewer-count {
  color: var(--text-muted);
  font-size: 0.9rem;
}

/* ============================================
   Sidebar
   ============================================ */
.sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.panel {
  background: var(--bg-surface);
  border-radius: var(--radius);
  padding: 1.25rem;
  border: 1px solid var(--border);
}

.panel h2 {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 1rem;
}

.hidden {
  display: none !important;
}

/* ============================================
   Form Elements
   ============================================ */
.form-group {
  margin-bottom: 1rem;
}

label {
  display: block;
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-bottom: 0.4rem;
}

input {
  width: 100%;
  padding: 0.75rem 1rem;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-size: 1rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(233, 69, 96, 0.2);
}

input::placeholder {
  color: #6b7280;
}

/* ============================================
   Buttons
   ============================================ */
.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 0.95rem;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-hover);
  transform: translateY(-1px);
}

.btn-master {
  background: var(--warning);
  color: #1a1a2e;
}

.btn-master:hover:not(:disabled) {
  filter: brightness(1.1);
}

.btn-follower {
  background: var(--bg-elevated);
  color: var(--text);
  border: 1px solid var(--border);
}

.btn-follower:hover:not(:disabled) {
  background: #2d2d4d;
}

.btn-leave {
  background: transparent;
  color: var(--text-muted);
  border: 1px solid var(--border);
  margin-top: 0.5rem;
}

.btn-leave:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: #ef4444;
  color: #ef4444;
}

.btn-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

/* ============================================
   Status & Badges
   ============================================ */
.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.75rem;
  background: rgba(34, 197, 94, 0.15);
  color: var(--success);
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.role-badge {
  padding: 0.35rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  background: var(--bg-elevated);
  color: var(--text-muted);
}

.role-badge.master {
  background: rgba(245, 158, 11, 0.15);
  color: var(--warning);
}

.room-info {
  background: var(--bg-elevated);
  padding: 0.75rem 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.room-info .label {
  color: var(--text-muted);
  margin-right: 0.5rem;
}

.room-info .value {
  font-weight: 600;
  font-family: monospace;
}

/* ============================================
   Activity Log
   ============================================ */
.activity-log {
  background: var(--bg-elevated);
  border-radius: 8px;
  padding: 0.75rem;
  max-height: 200px;
  overflow-y: auto;
  font-size: 0.8rem;
  line-height: 1.7;
}

.activity-log::-webkit-scrollbar {
  width: 6px;
}

.activity-log::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}

.log-entry {
  color: var(--text-muted);
  padding: 0.25rem 0;
}

.log-entry.info { color: #60a5fa; }
.log-entry.success { color: var(--success); }
.log-entry.warning { color: var(--warning); }
.log-entry.error { color: var(--primary); }

.log-time {
  opacity: 0.6;
  margin-right: 0.5rem;
}

/* ============================================
   Misc
   ============================================ */
.hint {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-top: 1rem;
  text-align: center;
}
```

---

## Step 3: Implement the Application Logic

Create `app.js`:

```javascript
// ============================================
// Configuration
// ============================================

// ⚠️ Replace with your PubNub keys!
const PUBNUB_CONFIG = {
  publishKey: 'demo',
  subscribeKey: 'demo',
};

const SAMPLE_VIDEO = {
  title: 'Big Buck Bunny',
  url: 'https://storage.googleapis.com/shaka-demo-assets/bbb-dark-truths/dash.mpd',
};

// ============================================
// State
// ============================================

let player = null;
let syncManager = null;
let viewerCount = 0;

// ============================================
// DOM Elements
// ============================================

const elements = {
  video: document.getElementById('video'),
  videoTitle: document.querySelector('.video-title'),
  viewerCount: document.getElementById('viewer-count'),

  joinPanel: document.getElementById('join-panel'),
  controlsPanel: document.getElementById('controls-panel'),

  roomIdInput: document.getElementById('room-id'),
  usernameInput: document.getElementById('username'),

  btnJoin: document.getElementById('btn-join'),
  btnMaster: document.getElementById('btn-master'),
  btnFollower: document.getElementById('btn-follower'),
  btnLeave: document.getElementById('btn-leave'),

  connectionStatus: document.getElementById('connection-status'),
  roleBadge: document.getElementById('role-badge'),
  currentRoom: document.getElementById('current-room'),

  activityLog: document.getElementById('activity-log'),
};

// ============================================
// Logging
// ============================================

function log(message, type = 'info') {
  const time = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.innerHTML = `<span class="log-time">${time}</span>${message}`;

  elements.activityLog.appendChild(entry);
  elements.activityLog.scrollTop = elements.activityLog.scrollHeight;

  console.log(`[${type.toUpperCase()}] ${message}`);
}

// ============================================
// UI Updates
// ============================================

function updateViewerCount(count) {
  viewerCount = count;
  elements.viewerCount.textContent = `${count} viewer${count !== 1 ? 's' : ''}`;
}

function updateRole(role) {
  const isMaster = role === 'master';

  elements.roleBadge.textContent = isMaster ? '👑 Master' : '👥 Follower';
  elements.roleBadge.className = `role-badge ${isMaster ? 'master' : ''}`;

  elements.btnMaster.disabled = isMaster;
  elements.btnFollower.disabled = !isMaster;
}

function showConnectedUI(roomId) {
  elements.joinPanel.classList.add('hidden');
  elements.controlsPanel.classList.remove('hidden');
  elements.currentRoom.textContent = roomId;
}

function showDisconnectedUI() {
  elements.joinPanel.classList.remove('hidden');
  elements.controlsPanel.classList.add('hidden');
}

// ============================================
// Player Initialization
// ============================================

async function initPlayer() {
  log('Initializing video player...');

  shaka.polyfill.installAll();

  if (!shaka.Player.isBrowserSupported()) {
    log('Browser not supported!', 'error');
    return false;
  }

  player = new shaka.Player();
  await player.attach(elements.video);

  player.addEventListener('error', (event) => {
    log(`Player error: ${event.detail.message}`, 'error');
  });

  try {
    await player.load(SAMPLE_VIDEO.url);
    elements.videoTitle.textContent = SAMPLE_VIDEO.title;
    log('Video loaded. Ready to join a party!', 'success');
    return true;
  } catch (error) {
    log(`Failed to load video: ${error.message}`, 'error');
    return false;
  }
}

// ============================================
// Sync Manager
// ============================================

function joinParty() {
  const roomId = elements.roomIdInput.value.trim();
  const username = elements.usernameInput.value.trim();

  if (!roomId) {
    log('Please enter a room code', 'error');
    return;
  }

  try {
    const { SyncManager } = PubNubShakaSync;

    syncManager = new SyncManager(player, {
      publishKey: PUBNUB_CONFIG.publishKey,
      subscribeKey: PUBNUB_CONFIG.subscribeKey,
      userId: username || undefined, // Auto-generate if empty
      PubNub: PubNub,
    });

    // Set up event listeners
    setupSyncEvents();

    // Connect to room
    syncManager.connect(roomId);

    // Update UI
    showConnectedUI(roomId);
    updateRole('follower');
    updateViewerCount(1);

    log(`Joined party "${roomId}" as ${syncManager.getUserId()}`, 'success');

  } catch (error) {
    log(`Failed to join: ${error.message}`, 'error');
  }
}

function setupSyncEvents() {
  // Master changed
  syncManager.addEventListener('masterchanged', (event) => {
    if (event.previousRole === 'master') {
      updateRole('follower');
      log('Another user took control. You are now following.', 'warning');
    } else {
      log(`${event.newMasterId} is now controlling playback`, 'info');
    }
  });

  // User joined
  syncManager.addEventListener('userjoined', (event) => {
    updateViewerCount(event.occupancy || viewerCount + 1);
    log(`${event.userId} joined the party`, 'info');
  });

  // User left
  syncManager.addEventListener('userleft', (event) => {
    updateViewerCount(event.occupancy || Math.max(1, viewerCount - 1));
    log(`${event.userId} left the party`, 'info');
  });
}

function leaveParty() {
  if (syncManager) {
    const roomId = syncManager.getRoomId();
    syncManager.disconnect();
    syncManager = null;

    showDisconnectedUI();
    updateViewerCount(0);

    log(`Left party "${roomId}"`, 'warning');
  }
}

function becomeMaster() {
  if (syncManager) {
    syncManager.becomeMaster();
    updateRole('master');
    log('You are now the master! Play/pause/seek to control everyone.', 'success');
  }
}

function becomeFollower() {
  if (syncManager) {
    syncManager.becomeFollower();
    updateRole('follower');
    log('You are now following the master.', 'info');
  }
}

// ============================================
// Event Bindings
// ============================================

elements.btnJoin.addEventListener('click', joinParty);
elements.btnLeave.addEventListener('click', leaveParty);
elements.btnMaster.addEventListener('click', becomeMaster);
elements.btnFollower.addEventListener('click', becomeFollower);

// Allow pressing Enter to join
elements.roomIdInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') joinParty();
});

elements.usernameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') joinParty();
});

// ============================================
// Initialize
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  const success = await initPlayer();
  if (!success) {
    elements.btnJoin.disabled = true;
  }
});
```

---

## Step 4: Test Your Watch Party

1. **Start a local server** (needed for Shaka Player):
   ```bash
   # Python 3
   python -m http.server 8000

   # Node.js
   npx serve .
   ```

2. **Open two browser windows** at `http://localhost:8000`

3. **In both windows:**
   - Enter the same room code (e.g., "movie-night")
   - Enter different usernames
   - Click "Join Party"

4. **In one window:**
   - Click "Take Control"
   - Play, pause, or seek the video

5. **Watch the magic!** The other window syncs automatically.

---

## Advanced Features

### Add a Video Library

Let users choose from multiple videos:

```javascript
const VIDEO_LIBRARY = [
  {
    id: 'bbb',
    title: 'Big Buck Bunny',
    url: 'https://storage.googleapis.com/shaka-demo-assets/bbb-dark-truths/dash.mpd',
    thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/c/c5/Big_buck_bunny_poster_big.jpg',
  },
  {
    id: 'sintel',
    title: 'Sintel',
    url: 'https://storage.googleapis.com/shaka-demo-assets/sintel/dash.mpd',
    thumbnail: 'https://durian.blender.org/wp-content/uploads/2010/06/sintel-poster.jpg',
  },
];

async function loadVideo(videoId) {
  const video = VIDEO_LIBRARY.find(v => v.id === videoId);
  if (video) {
    await player.load(video.url);
    elements.videoTitle.textContent = video.title;
    log(`Loaded: ${video.title}`, 'success');
  }
}
```

### Add Chat

Integrate PubNub for chat messages alongside video sync:

```javascript
// Use a separate channel for chat
const chatChannel = pubnub.channel(`chat-${roomId}`);
const chatSubscription = chatChannel.subscription();

chatSubscription.onMessage = (event) => {
  displayChatMessage(event.message);
};

function sendChatMessage(text) {
  pubnub.publish({
    channel: `chat-${roomId}`,
    message: {
      userId: syncManager.getUserId(),
      text: text,
      timestamp: Date.now(),
    },
  });
}
```

### Add Room Passwords

Use PubNub Access Manager to protect rooms:

```javascript
// On your server, generate tokens with room-specific permissions
const token = await pubnub.grantToken({
  ttl: 60, // minutes
  resources: {
    channels: {
      [`shaka-sync-${roomId}`]: { read: true, write: true },
    },
  },
});

// Client uses the token
syncManager = new SyncManager(player, {
  ...config,
  authKey: token,
});
```

---

## Production Considerations

### 1. Use Environment Variables for Keys

```javascript
// Don't commit real keys!
const PUBNUB_CONFIG = {
  publishKey: process.env.PUBNUB_PUBLISH_KEY,
  subscribeKey: process.env.PUBNUB_SUBSCRIBE_KEY,
};
```

### 2. Handle Network Reconnection

```javascript
syncManager.addEventListener('disconnected', () => {
  // Show reconnection UI
  showReconnectingBanner();

  // Attempt to reconnect after delay
  setTimeout(() => {
    if (!syncManager.isConnected()) {
      syncManager.connect(currentRoomId);
    }
  }, 3000);
});
```

### 3. Persist Room State

Use `localStorage` to remember the last room:

```javascript
// On join
localStorage.setItem('lastRoom', roomId);

// On page load
const lastRoom = localStorage.getItem('lastRoom');
if (lastRoom) {
  elements.roomIdInput.value = lastRoom;
}
```

### 4. Add Analytics

Track watch party engagement:

```javascript
syncManager.addEventListener('userjoined', (event) => {
  analytics.track('watch_party_joined', {
    roomId: syncManager.getRoomId(),
    viewers: event.occupancy,
  });
});
```

---

## Troubleshooting

### Video plays but doesn't sync

- Make sure one user has clicked "Take Control" (master)
- Check that both users are in the same room
- Verify PubNub keys are correct

### "CORS error" when loading video

- Shaka Player requires proper CORS headers
- Use videos from CORS-enabled sources
- Or serve your own videos with proper headers

### High latency between clients

- Check network conditions
- Reduce `syncIntervalMs` for more frequent updates
- Consider regional PubNub data centers

---

## Next Steps

- 📖 Explore the [API Reference](../API.md) for all options
- 🔐 Learn about [PubNub Access Manager](https://www.pubnub.com/docs/general/security/access-control)
- 💬 Add [PubNub Chat](https://www.pubnub.com/docs/chat/overview) for real-time messaging
- 📊 Use [PubNub Presence](https://www.pubnub.com/docs/general/presence/overview) for online/offline status

---

## Live Demo

Check out the working demo included with this package:

```bash
cd pubnub-shaka-sync/demo
# Open index.html in a browser
```

---

**Questions?** Visit [PubNub Support](https://support.pubnub.com) or open an issue on GitHub.
