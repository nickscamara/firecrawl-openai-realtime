import { useRef, useEffect } from 'react';
import { RealtimeClient } from '@openai/realtime-api-beta';

interface UseRealtimeClientProps {
  apiKey: string;
  localRelayServerUrl: string;
}

export const useRealtimeClient = ({ apiKey, localRelayServerUrl }: UseRealtimeClientProps) => {
  const clientRef = useRef<RealtimeClient>(
    new RealtimeClient(
      localRelayServerUrl
        ? { url: localRelayServerUrl }
        : {
            apiKey: apiKey,
            dangerouslyAllowAPIKeyInBrowser: true,
          }
    )
  );

  useEffect(() => {
    return () => {
      clientRef.current.reset();
    };
  }, []);

  return clientRef;
};
