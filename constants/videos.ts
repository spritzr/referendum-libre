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
