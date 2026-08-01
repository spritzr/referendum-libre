import type { VideoSource, VideoContentFit } from 'expo-video';
import { FlowStep, type FlowStepValue } from '@/constants/voting-flow-steps';

// Voting-flow and "comprendre" tab clips, all re-muxed to H.264 Constrained
// Baseline + faststart so Media3/ExoPlayer hardware-decodes them on low/mid
// Android devices (see hooks/useModalVideoPlayers.ts). Baseline is a strict
// subset of Main profile, so the same file plays fine on iOS too.

export const VIDEO_1 = require('@/assets/videos/video1.mp4');
export const VIDEO_2 = require('@/assets/videos/video2.mp4');
export const VIDEO_3 = require('@/assets/videos/video3.mp4');
export const VIDEO_4_PHONE_OVER_CARD = require('@/assets/videos/video4_phoneOverCard.mp4');
export const VIDEO_5 = require('@/assets/videos/video5.mp4');
export const VIDEO_6 = require('@/assets/videos/video6.mp4');
// Placeholder — the original Step 4 intro clip was removed (copyright).
// TODO: replace assets/videos/intro-placeholder.mp4 with a licensed intro.
export const VIDEO_INTRO = require('@/assets/videos/intro-placeholder.mp4');

export interface StepVideoConfig {
  source: VideoSource;
  contentFit: VideoContentFit;
}

// Single source of truth for "what video plays and how it's fit" per voting
// flow step. Steps not listed here render no video (camera steps, vote
// choice/proof/result screens). hooks/useModalVideoPlayers.ts reads `source`
// to know when to replaceAsync(); the Step components read `contentFit` so
// that stays out of each component file. Step sizing itself still lives in
// components/voting-modal/styles.ts (stepVideoSize) since that's a layout
// concern, not a video-content one.
//
// StepVoteChoice (10) renders no VideoView of its own — its entry exists
// only to pre-warm VIDEO_3 (via replaceAsync in useModalVideoPlayers.ts) so
// it's already loaded by the time StepVoteConfirm (11) needs it; `contentFit`
// there is unused but set to match StepVoteConfirm's actual rendering.
// StepVoteConfirm itself has no entry: it just pauses on whatever's loaded
// rather than looping, and on Android doesn't mount a VideoView at all
// (static poster image instead).
export const STEP_VIDEOS: Partial<Record<FlowStepValue, StepVideoConfig>> = {
  [FlowStep.IntroConsent]: { source: VIDEO_1, contentFit: 'cover' },
  [FlowStep.EligibilityCheck]: { source: VIDEO_2, contentFit: 'contain' },
  [FlowStep.AnonymousVoteExplainer]: { source: VIDEO_3, contentFit: 'contain' },
  [FlowStep.IntroVideo]: { source: VIDEO_INTRO, contentFit: 'contain' },
  [FlowStep.DocumentScanStart]: { source: VIDEO_1, contentFit: 'cover' },
  [FlowStep.NFCRead]: { source: VIDEO_4_PHONE_OVER_CARD, contentFit: 'contain' },
  [FlowStep.BlockchainVerify]: { source: VIDEO_5, contentFit: 'contain' },
  [FlowStep.VoteChoice]: { source: VIDEO_3, contentFit: 'cover' },
};
