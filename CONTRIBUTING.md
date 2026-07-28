# Contributing to Referendum Libre

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Development Setup

### Prerequisites

- Node.js 20+
- Expo SDK 54 (local CLI via `npx expo` — no global install)
- iOS: Xcode 16+, CocoaPods
- Android: Android Studio, NDK 27.1.12297006

### Getting Started

```bash
# Clone the repository
git clone https://github.com/referendum-libre/referendum-libre-react-native.git
cd referendum-libre-react-native

# Install dependencies
npm install

# Generate native projects
npx expo prebuild

# Start development
npx expo run:ios
# or
npx expo run:android
```

## Code Style

### Formatting

We use Prettier for code formatting. Run before committing:

```bash
npm run format
```

### Linting

We use ESLint for code quality. Check for issues with:

```bash
npm run lint
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
4. Run `npm run lint`, `npm run format`, `npm test`, and `npx tsc --noEmit`
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

## Forking for a new app

This codebase is designed to be forked for other independent apps/referendums
(different app identity, different FreedomTool proposal, different legal
pages) without carrying Referendum Libre's own identity along, and without
every future `git merge` from this template fighting over the same lines.

All of the values that differ between forks live in **`.env`** at the repo
root — committed, and intentionally **not secret** (bundle id, contract
addresses, legal URLs — all of it ends up readable in the shipped app
anyway). Real secrets (signing keys, App Store Connect credentials) stay in
`.env.local`, which is gitignored — see `.env.local.example`.

### One-time setup after forking

1. Edit `.env` and replace every value (app name/slug/scheme, iOS bundle id,
   Android package, FreedomTool proposal contract addresses, proposal-index
   signing public key, legal/contact URLs). `.env.example` lists the full
   set of keys with `__REPLACE_ME__` placeholders.
2. Regenerate the proposal-index signing keypair:
   `node scripts/generate-proposal-signing-key.mjs` — put the public key in
   `.env` (`EXPO_PUBLIC_PROPOSAL_INDEX_PUBLIC_KEY_HEX`), put the private key
   in this repo's `PROPOSAL_INDEX_SIGNING_KEY` GitHub Actions secret.
3. Replace the app icon/splash assets under `assets/images/`.
4. Generate a new Android upload keystore
   (`scripts/ci/generate-upload-keystore.sh`) and set the four
   `ANDROID_KEYSTORE_*`/`ANDROID_KEY_*` GitHub secrets — **do not reuse
   Referendum Libre's keystore**, it can never be swapped once an app is
   published under a given package name.
5. Set up `.env.local` (copy from `.env.local.example`) with the new org's Apple
   ID / App Store Connect credentials if you'll use `eas submit`.
6. Review `constants/terms.ts` and `locales/*.json` for any hardcoded
   Referendum Libre branding/copy.

`app.config.ts` and the `constants/*.ts` files that read app identity from
`.env` throw at startup if a required variable is missing, so a forgotten
step surfaces immediately rather than silently shipping the wrong value.

The Android release workflow (`android-release.yml`) additionally refuses to
build a signed release if `.env` still contains the `__REPLACE_ME__`
sentinel — see that file's placeholder convention below.

### Placeholder convention

This repo's own `.env` currently holds Referendum Libre's real values (this
_is_ that app) — there's nothing to replace here. When you fork, as step 1
above, replace each value with the new app's own; if you'd rather stub a
value out until it's ready, write `__REPLACE_ME__` as its value. The
release workflow (`android-release.yml`) greps `.env` for that literal
string and refuses to build a signed release while it's still present, so a
half-configured fork can't accidentally ship.

### Secret naming: same name, local vs CI

Every real secret (signing keys, store credentials) has exactly **one
canonical name**, regardless of which of the two places it's stored:

- **Locally**: `.env.local` (gitignored — see `.env.local.example`).
- **In CI**: a GitHub Actions secret with the _same name_.

| Secret                                                                                                                | `.env.local`       | GitHub Actions secret | Used by                                       |
| --------------------------------------------------------------------------------------------------------------------- | ------------------ | --------------------- | --------------------------------------------- |
| `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`                   | not currently used | ✅                    | `android-release.yml` (signs the release APK) |
| `EXPO_APPLE_ID`, `EXPO_APPLE_APP_SPECIFIC_PASSWORD` or `EXPO_ASC_API_KEY_PATH`/`EXPO_ASC_KEY_ID`/`EXPO_ASC_ISSUER_ID` | ✅                 | not currently used    | manual `eas submit` (no CI workflow yet)      |
| `PROPOSAL_INDEX_SIGNING_KEY`                                                                                          | not currently used | ✅                    | `publish-proposal-index.yml`                  |

Android release building and iOS submission each currently only run in one
of the two places (Android: CI only; iOS: local only via `eas submit`) —
that's a gap, not a design choice. If either grows a counterpart later (a
local signed-APK build, or an iOS CI workflow), **reuse the exact same
variable name** in the new location instead of inventing a different one.

Note that `scripts/ci/build-signed-apk-local.sh` (the existing local
equivalent of `android-release.yml`) does _not_ follow this convention
today — it reads the keystore from a fixed path
(`~/.android-signing-keystores/...`) and prompts for the password
interactively, rather than reading `ANDROID_KEYSTORE_*`/`ANDROID_KEY_*`
from `.env.local`. Worth aligning if/when this table's gaps get filled in.

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
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
