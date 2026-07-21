# Contributing to Referendum Libre

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Development Setup

### Prerequisites

- Node.js 20+
- pnpm 10.x via Corepack (`corepack enable` if `pnpm` is unavailable)
- Expo SDK 54 (local CLI via `pnpm expo` — no global install)
- iOS: Xcode 16+, CocoaPods
- Android: Android Studio, NDK 27.1.12297006

### Getting Started

```bash
# Clone the repository
git clone https://github.com/referendum-libre/referendum-libre-react-native.git
cd referendum-libre-react-native

# Install dependencies
pnpm install

# Generate native projects
pnpm expo prebuild

# Start development
pnpm ios
# or
pnpm android
```

### Package manager

Use `pnpm` for installs and scripts. It is faster for repeated worktree setup because pnpm reuses a global content-addressable store instead of copying every package per checkout. Project pnpm settings live in `pnpm-workspace.yaml`; `enableGlobalVirtualStore: true` there enables pnpm's global virtual store so repeated installs across git worktrees can link `node_modules` faster.

- Do not add or update `package-lock.json` or `yarn.lock`.
- Keep `pnpm-lock.yaml` in sync when dependencies change.
- Prefer `pnpm <script>` for package scripts and `pnpm expo ...` for the local Expo CLI.

## Code Style

### Formatting

We use Prettier for code formatting. Run before committing:

```bash
pnpm format
```

### Linting

We use ESLint for code quality. Check for issues with:

```bash
pnpm lint
```

### TypeScript

- Use strict TypeScript - avoid `any` types when possible
- Define interfaces for component props
- Use proper type imports

## Git Workflow

### Branching model

We use a two-branch GitFlow-lite:

- **`develop`** — integration branch. All feature work, bug fixes, refactors,
  and docs go here. The weekly Android build (debug-signed APK) runs off
  this branch.
- **`master`** — release branch. Updated only by maintainers, who merge
  `develop` into `master` when a cut is ready. Signed-release APKs are
  built from tags on `master`.

```
   feature/foo ──┐
                 ├──► develop ──(maintainer merge)──► master ──(tag v1.4)──► signed APK
   fix/bar ─────┘                  │                              │
                                   ▼                              ▼
                          weekly debug APK              GitHub Release w/ SHA-256
```

### Branch Naming

- `feature/` - New features (e.g., `feature/add-biometric-auth`)
- `fix/` - Bug fixes (e.g., `fix/nfc-timeout-error`)
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions or fixes

### Commit Messages

Follow conventional commit format:

```
type(scope): description

[optional body]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
- `feat(voting): add confirmation step`
- `fix(nfc): handle timeout on slow devices`
- `docs(readme): update installation instructions`

### Pull Requests

1. Fork the repository (or branch directly if you have write access)
2. Create a feature branch off **`develop`**: `git checkout develop && git pull && git checkout -b feature/<short-name>`
3. Make your changes
4. Run `pnpm lint`, `pnpm format`, `pnpm test`, and `pnpm exec tsc --noEmit`
5. Test on both iOS and Android if possible
6. Open a PR **against `develop`**, not `master`. PRs targeting `master`
   will be redirected — only maintainers merge into `master`.

### Cutting a release (maintainers only)

Releases are gated to `master` so the signed-APK workflow can't be tricked
into shipping unreviewed code from a feature branch. The workflow
verifies that the tag's commit is an ancestor of `origin/master` and
refuses to run otherwise.

1. Merge `develop` into `master`:
   ```
   git checkout master && git pull
   git merge --no-ff develop
   git push origin master
   ```
2. Tag the release commit on `master`:
   ```
   git tag -a v1.4 -m "Referendum Libre v1.4"
   git push origin v1.4
   ```
   Tag names must match `v[0-9]*` (e.g. `v1.4`, `v1.4.1`, `v2.0-beta1`).
3. The `Android Release (signed APK)` workflow runs automatically. When it
   finishes, the signed APK + SHA-256 + `apksigner verify` output are
   attached to a GitHub Release named after the tag.
4. Bump `app.config.ts` `version` on `develop` to the next planned version
   so subsequent nightlies don't collide with the just-released tag.

The one-time signing-keystore setup (`keytool` recipe + required GitHub
secrets) is documented in the header of
`.github/workflows/android-release.yml`.

## Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

## Project Structure

```
app/                    # Expo Router screens
components/             # Reusable React components
contexts/               # React context providers
hooks/                  # Custom React hooks
utils/                  # Utility functions
constants/              # Theme and content constants
modules/                # Native modules
locales/                # i18n translations
```

## Need Help?

- Check existing [issues](https://github.com/referendum-libre/referendum-libre-react-native/issues)
- Read the [Integration Guide](./INTEGRATION_GUIDE.md) for native module setup
- Open a new issue for bugs or feature requests

## License

By contributing, you agree that your contributions will be licensed under the [GNU General Public License v3.0](./LICENSE) — the same licence the rest of the project ships under (`package.json::license: "GPL-3.0"`).
