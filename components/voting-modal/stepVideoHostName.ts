import type { FlowStepValue } from '@/constants/voting-flow-steps';

// Shared naming convention between app/voting-flow.tsx's single <Portal>
// (which always points at the currently active step) and each video-bearing
// Step component's <PortalHost> (which claims that step's slot while it's
// mounted). Keeping this in one place means the two sides can never drift
// apart into mismatched host names.
export const stepVideoHostName = (step: FlowStepValue): string => `step-video-${step}`;
