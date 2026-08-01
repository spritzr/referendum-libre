import { useCallback, useRef } from 'react';
import { useVideoPlayer } from 'expo-video';
import { VIDEO_1, VIDEO_2, VIDEO_3, VIDEO_4_PHONE_OVER_CARD, VIDEO_5, VIDEO_INTRO } from '@/constants/videos';

// One shared VideoPlayer for the whole voting flow (incl. intro) instead of
// one per step — only one MediaCodec is ever alive. Safe now that
// app/voting-flow.tsx mounts exactly one step at a time (no ±1 carousel
// window, so no two VideoViews can ever be bound to this player at once —
// see expo/expo#30271 for why that would otherwise be a crash risk).
// stepSources keys off today's step numbering (StepIntroVideo is its own
// step 4, ahead of StepDocumentScanStart).

const stepSources: Record<number, any> = {
  1: VIDEO_1,
  2: VIDEO_2,
  3: VIDEO_3,
  4: VIDEO_INTRO,
  5: VIDEO_1,
  7: VIDEO_4_PHONE_OVER_CARD,
  8: VIDEO_5,
  10: VIDEO_3,
};

const safe = (fn: () => void) => {
  try { fn(); } catch (e) { /* Ignore errors from released players */ }
};

export function useModalVideoPlayers() {
  const player = useVideoPlayer(VIDEO_1, (p) => {
    p.loop = true;
    p.muted = true;
    p.audioMixingMode = 'mixWithOthers';
    p.pause();
  });

  const loadedStepRef = useRef<number | null>(1);

  const handleStepChange = useCallback((nextStep: number) => {
    if (nextStep === 6 || nextStep === 11) {
      safe(() => player.pause());
      return;
    }

    const source = stepSources[nextStep];
    if (!source) return;

    const alreadyLoaded = loadedStepRef.current === nextStep
      || (nextStep === 10 && loadedStepRef.current === 3);

    if (alreadyLoaded) {
      safe(() => player.play());
      return;
    }

    // replace() resolves once ExoPlayer.prepare() is *called*, not once a
    // frame is decoded — wait for readyToPlay before playing.
    player.replaceAsync(source).then(() => {
      loadedStepRef.current = nextStep;
      if (player.status === 'readyToPlay') {
        safe(() => player.play());
        return;
      }
      const sub = player.addListener('statusChange', ({ status }) => {
        if (status === 'readyToPlay' || status === 'error') sub.remove();
        if (status === 'readyToPlay') safe(() => player.play());
      });
    });
  }, [player]);

  const pauseAll = useCallback(() => safe(() => player.pause()), [player]);
  const pauseVerificationVideo = useCallback(() => safe(() => player.pause()), [player]);

  // All keys alias the same instance — exactly one VideoView is ever
  // mounted at a time, so sharing one player across all of them is safe.
  return {
    players: {
      player1: player,
      player2: player,
      player3: player,
      player4: player,
      player5: player,
      playerIntro: player,
    },
    handleStepChange,
    pauseAll,
    pauseVerificationVideo,
  };
}
