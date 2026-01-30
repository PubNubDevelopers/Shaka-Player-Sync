# Publishing Guide

This document covers how to publish `@pubnub/shaka-player` to npm.

---

## Prerequisites

### npm Account

1. Create an account at [npmjs.com](https://www.npmjs.com/)
2. Join the `@pubnub` organization (request access from PubNub team)
3. Enable 2FA for your account

### Local Setup

```bash
# Login to npm
npm login

# Verify you're logged in
npm whoami

# Verify access to @pubnub scope
npm access ls-packages | grep pubnub
```

---

## Version Management

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes
- **MINOR** (1.0.0 → 1.1.0): New features (backward compatible)
- **PATCH** (1.0.0 → 1.0.1): Bug fixes (backward compatible)

### Update Version

```bash
# Patch release (bug fixes)
npm version patch

# Minor release (new features)
npm version minor

# Major release (breaking changes)
npm version major
```

---

## Pre-Publish Checklist

### 1. Update Changelog

Add release notes to `CHANGELOG.md`:

```markdown
## [1.1.0] - 2026-02-15

### Added
- New feature X

### Fixed
- Bug Y
```

### 2. Run Tests

```bash
# All tests must pass
npm test

# Check coverage
npm run test:coverage
```

### 3. Build

```bash
npm run build
```

### 4. Verify Package Contents

```bash
# Check what will be published
npm pack --dry-run

# Should include:
# - dist/
# - src/
# - README.md
# - LICENSE
# - package.json
```

### 5. Test Installation Locally

```bash
# Create a tarball
npm pack

# In a test project:
npm install ../pubnub-shaka-sync/pubnub-shaka-player-sync-1.0.0.tgz

# Verify it works
node -e "const { SyncManager } = require('@pubnub/shaka-player'); console.log(SyncManager)"
```

---

## Publishing

### Manual Publishing

```bash
# Ensure you're on main branch
git checkout main
git pull origin main

# Update version
npm version patch  # or minor/major

# Build
npm run build

# Publish
npm publish --access public

# Push version tag
git push origin main --tags
```

### Automated Publishing (CI/CD)

Publishing is configured in `.github/workflows/ci.yml`. To enable:

1. Add `NPM_TOKEN` secret to GitHub repository
2. Uncomment the publish step in the workflow
3. Push to main branch

```yaml
- name: Publish to npm
  run: npm publish --access public
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## Post-Publish

### 1. Verify on npm

Check the package page: https://www.npmjs.com/package/@pubnub/shaka-player

### 2. Test Installation

```bash
# In a new directory
npm init -y
npm install @pubnub/shaka-player

# Verify
node -e "require('@pubnub/shaka-player')"
```

### 3. Update CDN Links

After publishing, update documentation CDN links:

```html
<script src="https://unpkg.com/@pubnub/shaka-player@1.0.0/dist/index.global.js"></script>
```

### 4. Create GitHub Release

1. Go to GitHub repository → Releases
2. Click "Draft a new release"
3. Select the version tag
4. Copy changelog entry to release notes
5. Publish release

---

## Troubleshooting

### "You do not have permission to publish"

```bash
# Check your npm login
npm whoami

# Check organization access
npm access ls-packages @pubnub
```

### "Package name already exists"

The package name `@pubnub/shaka-player` is scoped to the PubNub organization. Ensure you have publish access.

### "Build files missing"

```bash
# Rebuild
npm run build

# Verify dist exists
ls dist/
```

### Version Already Published

npm doesn't allow republishing the same version. Bump the version:

```bash
npm version patch
```

---

## Deprecating Versions

If a version has critical bugs:

```bash
# Deprecate with message
npm deprecate @pubnub/shaka-player@1.0.0 "Critical bug, please upgrade to 1.0.1"
```

---

## Unpublishing

**⚠️ Use with extreme caution!**

npm has strict policies on unpublishing. Generally only possible within 72 hours of publishing.

```bash
# Unpublish specific version
npm unpublish @pubnub/shaka-player@1.0.0

# Unpublish entire package (not recommended)
npm unpublish @pubnub/shaka-player --force
```

---

## Access Control

### Listing Collaborators

```bash
npm access ls-collaborators @pubnub/shaka-player
```

### Adding Collaborators

```bash
npm access grant read-write pubnub:developers
```

---

## Release Branches

For major releases, consider creating release branches:

```bash
# Create release branch
git checkout -b release/1.x main

# Cherry-pick fixes
git cherry-pick <commit-hash>

# Publish from release branch
npm version patch
npm publish
```

---

## Questions?

Contact the PubNub team or open an issue on GitHub.
