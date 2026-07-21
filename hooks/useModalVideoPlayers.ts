import { useCallback, useRef } from 'react';
import { useVideoPlayer } from 'expo-video';
import { VIDEO_1, VIDEO_2, VIDEO_3, VIDEO_4_PHONE_OVER_CARD, VIDEO_5, VIDEO_INTRO } from '@/constants/videos';

// EXPERIMENT: one shared VideoPlayer for the whole flow (incl. intro) instead
// of one per step — keeps a single MediaCodec alive. Risk: the ±1 mount
// window can co-mount two VideoViews on this same player, unsupported on
// Android (expo/expo#30271). Verify on low/mid Android hardware.
// stepSources assumes today's step numbering (intro folded into Step4).

const stepSources: Record<number, any> = {
  1: VIDEO_1,
  2: VIDEO_2,
  3: VIDEO_3,
  4: VIDEO_INTRO,
  6: VIDEO_4_PHONE_OVER_CARD,
  7: VIDEO_5,
  9: VIDEO_3,
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
    if (nextStep === 5 || nextStep === 10) {
      safe(() => player.pause());
      return;
    }

    const source = stepSources[nextStep];
    if (!source) return;

    const alreadyLoaded = loadedStepRef.current === nextStep
      || (nextStep === 9 && loadedStepRef.current === 3);

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

  // All keys alias the same instance — see file header for the collision risk.
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
