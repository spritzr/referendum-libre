// Loads .env / .env.local the same way `expo start`/`expo prebuild` do, so
// per-fork app-identity values (constants/rarime-config.ts, constants/urls.ts,
// app.config.ts) resolve the same way in tests as in the app. Must run
// before any test file imports those modules — hence `setupFiles`, not
// `setupFilesAfterEnv`.
require('@expo/env').load(__dirname);
