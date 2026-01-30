# Contributing to @pubnub/shaka-player

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)

---

## Code of Conduct

This project follows the [PubNub Code of Conduct](https://www.pubnub.com/code-of-conduct/). Please be respectful and constructive in all interactions.

---

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm 9 or higher
- Git

### Setup

1. **Fork the repository** on GitHub

2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/shaka-player-sync.git
   cd shaka-player-sync
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Create a branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

5. **Build the project**:
   ```bash
   npm run build
   ```

6. **Run tests**:
   ```bash
   npm test
   ```

---

## Development Workflow

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Build for production (CJS, ESM, IIFE) |
| `npm run dev` | Build in watch mode |
| `npm test` | Run tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run typecheck` | TypeScript type checking |
| `npm run lint` | Run ESLint |

### Making Changes

1. Write your code in the `src/` directory
2. Add tests for new functionality in `tests/`
3. Update documentation if needed
4. Run the full test suite before committing

### Testing Your Changes

```bash
# Run unit tests
npm test

# Run tests in watch mode while developing
npm run test:watch

# Check types
npm run typecheck

# Run linter
npm run lint
```

### Testing in the Demo

```bash
# Build the package
npm run build

# Serve the demo
npx serve .

# Open http://localhost:3000/demo/index.html
```

---

## Pull Request Process

1. **Update documentation**: Update README.md and other docs if your change affects the public API.

2. **Add tests**: All new features and bug fixes should include tests.

3. **Follow coding standards**: Run `npm run lint` and fix any issues.

4. **Write a clear PR description**:
   - What does this PR do?
   - Why is this change needed?
   - How was it tested?

5. **Link related issues**: Reference any related GitHub issues.

6. **Request review**: Tag relevant maintainers for review.

### PR Title Format

Use conventional commit format:

- `feat: add new feature`
- `fix: correct sync timing issue`
- `docs: update API documentation`
- `test: add tests for drift correction`
- `chore: update dependencies`

---

## Coding Standards

### TypeScript

- Use TypeScript for all source files
- Enable strict mode
- Define explicit types for function parameters and return values
- Use interfaces over type aliases where possible

### Style Guide

- Use 2 spaces for indentation
- Use single quotes for strings
- Add semicolons at the end of statements
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

### Example

```typescript
/**
 * Calculates the drift between two playback positions.
 *
 * @param localTime - The local video playback time
 * @param remoteTime - The remote (master) playback time
 * @returns The absolute drift in seconds
 */
function calculateDrift(localTime: number, remoteTime: number): number {
  return Math.abs(localTime - remoteTime);
}
```

### File Organization

```
src/
├── index.ts           # Public exports
├── sync-manager.ts    # Main class
├── types.ts           # TypeScript interfaces
└── utils.ts           # Helper functions (if needed)
```

---

## Testing

### Test Structure

```typescript
describe('SyncManager', () => {
  describe('methodName', () => {
    it('should [expected behavior] when [condition]', () => {
      // Arrange
      const syncManager = new SyncManager(player, config);

      // Act
      syncManager.connect('room');

      // Assert
      expect(syncManager.isConnected()).toBe(true);
    });
  });
});
```

### Test Categories

1. **Unit tests**: Test individual methods in isolation
2. **Integration tests**: Test multi-client scenarios
3. **Edge cases**: Test error handling and boundary conditions

### Mock Guidelines

- Mock PubNub SDK for all tests
- Mock HTMLMediaElement for video control tests
- Use `vi.fn()` for mock functions
- Clear mocks between tests

---

## Documentation

### Code Documentation

- Add JSDoc comments to all public methods
- Include `@param` and `@returns` tags
- Add `@example` for complex APIs

### README Updates

Update README.md when:
- Adding new public methods
- Changing configuration options
- Modifying event types

### Changelog

Add an entry to CHANGELOG.md for:
- New features
- Bug fixes
- Breaking changes
- Deprecations

---

## Questions?

- Open a [GitHub issue](https://github.com/pubnub/shaka-player-sync/issues) for bugs or feature requests
- Contact [PubNub Support](https://support.pubnub.com) for help

Thank you for contributing! 🎉
