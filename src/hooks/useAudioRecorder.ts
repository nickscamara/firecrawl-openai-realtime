import { useRef } from 'react';
import { WavRecorder } from '../lib/wavtools/index.js';

const SAMPLE_RATE = 24000;

export const useAudioRecorder = () => {
  const wavRecorderRef = useRef<WavRecorder>(
    new WavRecorder({ sampleRate: SAMPLE_RATE })
  );

  return wavRecorderRef;
};
