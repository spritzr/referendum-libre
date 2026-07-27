// Externally-hosted pages linked from the app. Values come from `.env`
// (per-fork app identity — see CONTRIBUTING.md ▸ "Forking for a new app")
// so a fork only needs to edit `.env`, never this file.
//
// Each process.env.EXPO_PUBLIC_* access must stay a static string literal
// (not a variable/helper) — Metro's `expo/no-dynamic-env-var` lint rule
// requires that so it can statically inline these at bundle time.
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required env var ${name}. See .env / CONTRIBUTING.md.`);
  }
  return value;
}

export const LEGAL_URLS = {
  privacyPolicy: required(
    'EXPO_PUBLIC_LEGAL_PRIVACY_POLICY_URL',
    process.env.EXPO_PUBLIC_LEGAL_PRIVACY_POLICY_URL
  ),
  termsAndConditions: required(
    'EXPO_PUBLIC_LEGAL_TERMS_URL',
    process.env.EXPO_PUBLIC_LEGAL_TERMS_URL
  ),
} as const;

// Per-referendum info pages on the public website. The app builds the URL
// from the on-chain proposal id; the website forwards /referendums/<id> to
// the correct referendum page (e.g. /referendums/52 → ZFE). Linked per-vote
// from the home screen ("En savoir plus").
export const REFERENDUMS_BASE_URL = required(
  'EXPO_PUBLIC_REFERENDUMS_BASE_URL',
  process.env.EXPO_PUBLIC_REFERENDUMS_BASE_URL
);
export const referendumInfoUrl = (proposalId: string | number): string =>
  `${REFERENDUMS_BASE_URL}${proposalId}`;

export const CONTACT_EMAIL = required(
  'EXPO_PUBLIC_CONTACT_EMAIL',
  process.env.EXPO_PUBLIC_CONTACT_EMAIL
);

// Address used for developer error reports triggered from the in-app
// "Envoyer un rapport d'erreur" button. Separate from CONTACT_EMAIL so the
// public contact alias is unaffected if we move the dev mailbox.
export const ERROR_REPORT_EMAIL = required(
  'EXPO_PUBLIC_ERROR_REPORT_EMAIL',
  process.env.EXPO_PUBLIC_ERROR_REPORT_EMAIL
);
