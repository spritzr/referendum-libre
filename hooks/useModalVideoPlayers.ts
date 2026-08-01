import { useCallback } from 'react';
import { useVideoPlayer } from 'expo-video';

// Each step has its own clip, re-muxed to H.264 Constrained Baseline +
// faststart so Media3/ExoPlayer hardware-decodes it on low/mid Android
// devices instead of hitting the vendor-codec crash the original (Main
// profile) exports trigger there. Baseline is a strict subset of Main, so
// the same file plays fine on iOS/AVPlayer too — one clip per step, no
// per-platform branching needed.

export function useModalVideoPlayers() {
  const setup = (player: any) => {
    player.loop = true;
    player.muted = true;
    player.audioMixingMode = 'mixWithOthers';
    // Preload but don't play; handleStepChange starts the visible step's player.
    player.pause();
  };

  const player1 = useVideoPlayer(require('@/assets/videos/video1.mp4'), setup);
  const player2 = useVideoPlayer(require('@/assets/videos/video2.mp4'), setup);
  const player3 = useVideoPlayer(require('@/assets/videos/video3.mp4'), setup);
  const player4 = useVideoPlayer(require('@/assets/videos/video4_phoneOverCard.mp4'), setup);
  const player5 = useVideoPlayer(require('@/assets/videos/video5.mp4'), setup);

  // Intro video — full-bleed clip that plays *above* the Step 4 content as a
  // teaching screen. Re-muxed .mp4 (H.264 Baseline, faststart) so Media3
  // takes the standard MP4 extractor path and hardware-decodes via MediaCodec
  // on every device.
  // Placeholder — the original Step 4 intro clip was removed (copyright).
  // TODO: replace assets/videos/intro-placeholder.mp4 with a licensed intro.
  const playerIntro = useVideoPlayer(
    require('@/assets/videos/intro-placeholder.mp4'),
    setup
  );

  const handleStepChange = useCallback((nextStep: number) => {
    const safePlay = (player: any) => {
      try {
        if (player && typeof player.play === 'function') {
          player.play();
        }
      } catch (e) { /* Ignore errors from released players */ }
    };

    const safePause = (player: any) => {
      try {
        if (player && typeof player.pause === 'function') {
          player.pause();
        }
      } catch (e) { /* Ignore errors from released players */ }
    };

    // Handle video playback for each step
    switch (nextStep) {
      case 1:
        safePlay(player1);
        break;
      case 2:
        safePause(player1);
        safePlay(player2);
        break;
      case 3:
        safePause(player2);
        safePlay(player3);
        break;
      case 4:
        safePause(player3);
        safePlay(player1);
        // Step 4 has an iOS-only intro phase that plays the intro video
        // ahead of the existing card content. Kick it off in parallel so
        // the user sees motion the instant the slide arrives.
        safePlay(playerIntro);
        break;
      case 5:
        safePause(player1);
        safePause(playerIntro);
        break;
      case 6:
        safePlay(player4);
        break;
      case 7:
        safePause(player4);
        safePlay(player5);
        break;
      case 9:
        safePlay(player3);
        break;
      case 10:
        safePause(player3);
        break;
    }
  }, [player1, player2, player3, player4, player5, playerIntro]);

  const pauseAll = useCallback(() => {
    [player1, player2, player3, player4, player5, playerIntro].forEach((player) => {
      try {
        if (player && typeof player.pause === 'function') {
          player.pause();
        }
      } catch (e) { /* Ignore errors from released players */ }
    });
  }, [player1, player2, player3, player4, player5, playerIntro]);

  const pauseVerificationVideo = useCallback(() => {
    try {
      if (player5 && typeof player5.pause === 'function') {
        player5.pause();
      }
    } catch (e) { /* Ignore errors from released players */ }
  }, [player5]);

  return {
    players: { player1, player2, player3, player4, player5, playerIntro },
    handleStepChange,
    pauseAll,
    pauseVerificationVideo,
  };
}
