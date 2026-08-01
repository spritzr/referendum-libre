import { useCallback, useRef } from 'react';
import { useVideoPlayer, type VideoSource } from 'expo-video';
import { VIDEO_1, VIDEO_2, VIDEO_3, VIDEO_4_PHONE_OVER_CARD, VIDEO_5, VIDEO_INTRO } from '@/constants/videos';
import { FlowStep, type FlowStepValue } from '@/constants/voting-flow-steps';

// One shared VideoPlayer for the whole voting flow (incl. intro) instead of
// one per step — only one MediaCodec is ever alive. Safe now that
// app/voting-flow.tsx mounts exactly one step at a time (no ±1 carousel
// window, so no two VideoViews can ever be bound to this player at once —
// see expo/expo#30271 for why that would otherwise be a crash risk).

const stepSources: Partial<Record<FlowStepValue, VideoSource>> = {
  [FlowStep.IntroConsent]: VIDEO_1,
  [FlowStep.EligibilityCheck]: VIDEO_2,
  [FlowStep.AnonymousVoteExplainer]: VIDEO_3,
  [FlowStep.IntroVideo]: VIDEO_INTRO,
  [FlowStep.DocumentScanStart]: VIDEO_1,
  [FlowStep.NFCRead]: VIDEO_4_PHONE_OVER_CARD,
  [FlowStep.BlockchainVerify]: VIDEO_5,
  [FlowStep.VoteChoice]: VIDEO_3,
};

const safe = (fn: () => void) => {
  try { fn(); } catch { /* Ignore errors from released players */ }
};

export function useModalVideoPlayers() {
  const player = useVideoPlayer(VIDEO_1, (p) => {
    p.loop = true;
    p.muted = true;
    p.audioMixingMode = 'mixWithOthers';
    p.pause();
  });

  const loadedStepRef = useRef<FlowStepValue | null>(FlowStep.IntroConsent);

  const handleStepChange = useCallback((nextStep: FlowStepValue) => {
    if (nextStep === FlowStep.MRZScan || nextStep === FlowStep.VoteConfirm) {
      safe(() => player.pause());
      return;
    }

    const source = stepSources[nextStep];
    if (!source) return;

    // StepVoteChoice (10) has no VideoView of its own — pre-loading VIDEO_3
    // there means it's already warm by the time StepVoteConfirm (11) shows
    // it. Only applies coming from StepAnonymousVoteExplainer (3), the other
    // step already on VIDEO_3.
    const alreadyLoaded = loadedStepRef.current === nextStep
      || (nextStep === FlowStep.VoteChoice && loadedStepRef.current === FlowStep.AnonymousVoteExplainer);

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
