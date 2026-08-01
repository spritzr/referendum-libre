import React, { createContext, useContext, ReactNode } from 'react';
import { useVideoPlayer } from 'expo-video';
import { VIDEO_6 } from '@/constants/videos';

interface VideoContextType {
  comprendrePlayer: any;
}

const VideoContext = createContext<VideoContextType | null>(null);

export function VideoProvider({ children }: { children: ReactNode }) {
  // Initialize and preload comprendre video immediately when app loads
  const comprendrePlayer = useVideoPlayer(
    VIDEO_6,
    player => {
      player.loop = false;
      player.muted = true;
      player.audioMixingMode = 'mixWithOthers';
      // Preload immediately but don't play
      player.pause();
    }
  );

  return (
    <VideoContext.Provider value={{ comprendrePlayer }}>
      {children}
    </VideoContext.Provider>
  );
}

export function useComprendreVideo() {
  const context = useContext(VideoContext);
  if (!context) {
    throw new Error('useComprendreVideo must be used within VideoProvider');
  }
  return context.comprendrePlayer;
}
