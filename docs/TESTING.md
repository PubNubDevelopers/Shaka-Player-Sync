# Testing Guide

This document covers testing strategies and procedures for `@pubnub/shaka-player`.

---

## Table of Contents

- [Running Tests](#running-tests)
- [Unit Tests](#unit-tests)
- [Integration Tests](#integration-tests)
- [Browser Testing](#browser-testing)
- [Manual Testing Checklist](#manual-testing-checklist)

---

## Running Tests

### Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with UI
npm run test:ui
```

### Test Structure

```
tests/
├── setup.ts                  # Test setup and global mocks
├── mocks/
│   ├── pubnub.mock.ts       # Mock PubNub SDK
│   └── video.mock.ts        # Mock HTMLMediaElement and Shaka Player
├── sync-manager.test.ts     # Unit tests for SyncManager
└── integration.test.ts      # Integration tests for multi-client scenarios
```

---

## Unit Tests

Unit tests focus on testing individual methods and behaviors of the `SyncManager` class in isolation.

### Test Categories

#### Constructor Tests
- Creates instance with correct defaults
- Accepts custom configuration
- Auto-generates userId when not provided

#### Connection Tests
- Connects to rooms correctly
- Initializes PubNub with correct config
- Throws appropriate errors for invalid config
- Emits connection events

#### Role Management Tests
- `becomeMaster()` sets role and broadcasts claim
- `becomeFollower()` stops sync timer
- Role transitions work correctly

#### Event Listener Tests
- Adding and removing listeners
- Event emission on presence changes
- Event emission on master changes

#### Message Handling Tests
- Ignores own messages
- Processes commands only as follower
- Applies commands correctly (play, pause, seek, ratechange)

---

## Integration Tests

Integration tests simulate multi-client scenarios with mocked PubNub.

### Test Scenarios

#### Multi-Client Sync
- Master sends play/pause/seek commands
- Followers receive and apply commands
- Multiple followers stay in sync

#### Master Handoff
- Original master demotes when new master claims
- All clients receive masterchanged event

#### Presence Events
- User join notifications
- User leave/timeout notifications

#### Sync Pulse
- Periodic sync pulses during playback
- Drift correction when threshold exceeded

#### Latency Compensation
- Commands account for network delay
- Followers arrive at correct playback position

---

## Browser Testing

### Supported Browsers

| Browser | Desktop | Mobile | Status |
|---------|---------|--------|--------|
| Chrome | ✅ | ✅ | Primary target |
| Firefox | ✅ | ✅ | Supported |
| Safari | ✅ | ✅ | Supported |
| Edge | ✅ | ✅ | Supported |

### Manual Browser Testing Setup

1. **Start a local server**:
   ```bash
   cd pubnub-shaka-sync
   npx serve .
   ```

2. **Open the demo**:
   Navigate to `http://localhost:3000/demo/index.html`

3. **Test in multiple windows**:
   Open the demo in two browser windows side by side.

### Browser-Specific Testing Checklist

#### Chrome (Primary)
- [ ] Video loads and plays correctly
- [ ] Sync commands work (play, pause, seek)
- [ ] Master/follower role switching works
- [ ] Drift correction works
- [ ] No console errors

#### Firefox
- [ ] Video loads and plays correctly
- [ ] Sync commands work (play, pause, seek)
- [ ] Master/follower role switching works
- [ ] Autoplay policy handled correctly

#### Safari
- [ ] Video loads and plays correctly
- [ ] HLS playback works (native Safari support)
- [ ] Sync commands work
- [ ] Autoplay policy handled correctly

#### Edge
- [ ] Video loads and plays correctly
- [ ] Sync commands work
- [ ] Chromium-based features work

#### Mobile Chrome (Android)
- [ ] Touch controls work
- [ ] Sync commands work
- [ ] Autoplay requires user interaction

#### Mobile Safari (iOS)
- [ ] Touch controls work
- [ ] Native HLS playback
- [ ] Fullscreen works

### Automated Browser Testing (Future)

For automated cross-browser testing, consider:

```bash
# Using Playwright
npm install -D @playwright/test

# playwright.config.ts
export default defineConfig({
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
  ],
});
```

---

## Manual Testing Checklist

### Basic Functionality

- [ ] **Connect to room**: Enter room ID and click Connect
- [ ] **Disconnect**: Click Disconnect button
- [ ] **Become master**: Click "Become Master"
- [ ] **Become follower**: Click "Become Follower"

### Sync Commands (as Master)

- [ ] **Play**: Click play on video, verify followers start playing
- [ ] **Pause**: Click pause, verify followers pause
- [ ] **Seek**: Drag timeline, verify followers jump to same position
- [ ] **Rate change**: Change playback speed, verify followers match

### Sync Behavior (as Follower)

- [ ] **Receive play**: Verify video starts when master plays
- [ ] **Receive pause**: Verify video pauses when master pauses
- [ ] **Receive seek**: Verify video jumps when master seeks
- [ ] **Drift correction**: After 30+ seconds, verify times stay aligned

### Edge Cases

- [ ] **Late joiner**: Join room after master has started, verify correct sync
- [ ] **Network interruption**: Disconnect/reconnect, verify resync
- [ ] **Rapid commands**: Send play/pause rapidly, verify no crashes
- [ ] **Long video**: Test with hour+ content, verify drift correction

### Multi-Client (3+ clients)

- [ ] **All sync**: Verify all followers sync with master
- [ ] **Master handoff**: Transfer control, verify all clients update
- [ ] **Presence**: Verify join/leave notifications

### Error Handling

- [ ] **Missing keys**: Verify error when PubNub keys not provided
- [ ] **Invalid room**: Verify behavior with empty room ID
- [ ] **Video not attached**: Verify error when player has no video element

---

## Test Coverage Goals

| Category | Target | Current |
|----------|--------|---------|
| Statements | 80% | - |
| Branches | 75% | - |
| Functions | 85% | - |
| Lines | 80% | - |

Run coverage report:
```bash
npm run test:coverage
```

---

## Debugging Tests

### Enable Verbose Logging

```typescript
// In test file
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(console.info);
});
```

### Debug Specific Test

```bash
# Run single test file
npx vitest run tests/sync-manager.test.ts

# Run specific test by name
npx vitest run -t "should connect to a room"
```

### Inspect Mock Calls

```typescript
const instance = MockPubNub.getInstance();
console.log('Publish calls:', instance?.publish.mock.calls);
```

---

## Contributing Tests

When adding new features, please include:

1. **Unit tests** for the new functionality
2. **Integration tests** if the feature affects multi-client behavior
3. **Update this document** if new testing procedures are needed

### Test Naming Convention

```typescript
describe('SyncManager', () => {
  describe('methodName', () => {
    it('should [expected behavior] when [condition]', () => {
      // test
    });
  });
});
```

---

## CI/CD Integration

Tests run automatically on:
- Pull request creation
- Push to main branch

GitHub Actions workflow:
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
```
