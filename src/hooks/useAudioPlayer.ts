import { useRef } from 'react';
import { WavStreamPlayer } from '../lib/wavtools/index.js';

const SAMPLE_RATE = 24000;

export const useAudioPlayer = () => {
  const wavStreamPlayerRef = useRef<WavStreamPlayer>(
    new WavStreamPlayer({ sampleRate: SAMPLE_RATE })
  );

  return wavStreamPlayerRef;
};
