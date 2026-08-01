// Single source of truth for the voting flow's step numbering. Shared between
// app/voting-flow.tsx (render switch + transition handlers) and
// hooks/useModalVideoPlayers.ts (which video loads on which step) so the two
// can never drift out of sync the way raw numeric literals did before.
export const FlowStep = {
  IntroConsent: 1,
  EligibilityCheck: 2,
  AnonymousVoteExplainer: 3,
  IntroVideo: 4,
  DocumentScanStart: 5,
  MRZScan: 6,
  NFCRead: 7,
  BlockchainVerify: 8,
  ReadyToVote: 9,
  VoteChoice: 10,
  VoteConfirm: 11,
  ProofSubmission: 12,
  VoteSuccess: 13,
  VoteError: 14,
} as const;

export type FlowStepValue = typeof FlowStep[keyof typeof FlowStep];
