import { useCallback, useRef } from 'react';
import { useVideoPlayer, type VideoSource } from 'expo-video';
import { VIDEO_1, STEP_VIDEOS } from '@/constants/videos';
import { FlowStep, type FlowStepValue } from '@/constants/voting-flow-steps';

// One shared VideoPlayer for the whole voting flow (incl. intro) instead of
// one per step — only one MediaCodec is ever alive. Safe now that
// app/voting-flow.tsx mounts exactly one step at a time (no ±1 carousel
// window, so no two VideoViews can ever be bound to this player at once —
// see expo/expo#30271 for why that would otherwise be a crash risk).
// Which video plays on which step is centralized in STEP_VIDEOS
// (constants/videos.ts).

// expo-video throws if a method is called on a player whose native peer was
// already released (e.g. a deferred replaceAsync().then() or statusChange
// listener firing after the screen unmounted). Swallow that race instead of
// crashing.
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

  const loadedSourceRef = useRef<VideoSource>(VIDEO_1);
  // Bumped on every handleStepChange call so a slow replaceAsync() from a
  // superseded step can detect it's stale and no-op instead of clobbering
  // whatever the current step actually loaded (replaceAsync has no
  // built-in cancellation — see expo-video's VideoPlayer.types.d.ts).
  const requestIdRef = useRef(0);

  const handleStepChange = useCallback((nextStep: FlowStepValue) => {
    const requestId = ++requestIdRef.current;

    if (nextStep === FlowStep.MRZScan || nextStep === FlowStep.VoteConfirm) {
      safe(() => player.pause());
      return;
    }

    const source = STEP_VIDEOS[nextStep]?.source;
    if (!source) return;

    if (source === loadedSourceRef.current) {
      safe(() => player.play());
      return;
    }

    // replace() resolves once ExoPlayer.prepare() is *called*, not once a
    // frame is decoded — wait for readyToPlay before playing.
    player.replaceAsync(source).then(() => {
      if (requestIdRef.current !== requestId) return; // superseded by a later step change
      loadedSourceRef.current = source;
      if (player.status === 'readyToPlay') {
        safe(() => player.play());
        return;
      }
      const sub = player.addListener('statusChange', ({ status }) => {
        if (status === 'readyToPlay' || status === 'error') sub.remove();
        if (status === 'readyToPlay' && requestIdRef.current === requestId) safe(() => player.play());
      });
    });
  }, [player]);

  const pauseAll = useCallback(() => safe(() => player.pause()), [player]);
  const pauseVerificationVideo = useCallback(() => safe(() => player.pause()), [player]);

  return {
    player,
    handleStepChange,
    pauseAll,
    pauseVerificationVideo,
  };
}
