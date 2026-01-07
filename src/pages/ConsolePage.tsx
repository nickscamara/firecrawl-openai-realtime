import { useEffect, useCallback, useState } from 'react';
import { ItemType } from '@openai/realtime-api-beta/dist/lib/client.js';
import { WavRecorder } from '../lib/wavtools/index.js';
import { instructions } from '../utils/conversation_config.js';
import { X, Edit, Zap } from 'react-feather';
import { Button } from '../components/button/Button';
import { Toggle } from '../components/toggle/Toggle';
import { Map } from '../components/Map';
import { EventLog } from '../components/EventLog';
import { ConversationLog } from '../components/ConversationLog';
import { AudioVisualization } from '../components/AudioVisualization';
import { useRealtimeClient } from '../hooks/useRealtimeClient';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useEventLogger } from '../hooks/useEventLogger';
import { useAudioVisualization } from '../hooks/useAudioVisualization';
import { registerRealtimeTools } from '../utils/realtimeTools';
import { Coordinates, RealtimeEvent } from '../types';
import {
  LOCAL_RELAY_SERVER_URL,
  DEFAULT_COORDINATES,
  API_KEY_STORAGE_KEY,
} from '../config/constants';
import './ConsolePage.scss';

export function ConsolePage() {
  const apiKey = LOCAL_RELAY_SERVER_URL
    ? ''
    : localStorage.getItem(API_KEY_STORAGE_KEY) ||
      prompt('OpenAI API Key') ||
      '';

  if (apiKey !== '') {
    localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
  }

  const wavRecorderRef = useAudioRecorder();
  const wavStreamPlayerRef = useAudioPlayer();
  const clientRef = useRealtimeClient({
    apiKey,
    localRelayServerUrl: LOCAL_RELAY_SERVER_URL,
  });

  const {
    realtimeEvents,
    setRealtimeEvents,
    expandedEvents,
    eventsScrollRef,
    formatTime,
    resetStartTime,
    toggleEventExpanded,
  } = useEventLogger();

  const { clientCanvasRef, serverCanvasRef } = useAudioVisualization({
    wavRecorder: wavRecorderRef.current,
    wavStreamPlayer: wavStreamPlayerRef.current,
  });

  const [items, setItems] = useState<ItemType[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [canPushToTalk, setCanPushToTalk] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [memoryKv, setMemoryKv] = useState<{ [key: string]: any }>({});
  const [coords, setCoords] = useState<Coordinates | null>(DEFAULT_COORDINATES);
  const [marker, setMarker] = useState<Coordinates | null>(null);
  const [screenshot, setScreenshot] = useState<string>('');

  const resetAPIKey = useCallback(() => {
    const apiKey = prompt('OpenAI API Key');
    if (apiKey !== null) {
      localStorage.clear();
      localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
      window.location.reload();
    }
  }, []);

  const connectConversation = useCallback(async () => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;

    resetStartTime();
    setIsConnected(true);
    setRealtimeEvents([]);
    setItems(client.conversation.getItems());

    await wavRecorder.begin();
    await wavStreamPlayer.connect();
    await client.connect();

    client.sendUserMessageContent([
      {
        type: `input_text`,
        text: `Hello!`,
      },
    ]);

    if (client.getTurnDetectionType() === 'server_vad') {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    }
  }, [clientRef, wavRecorderRef, wavStreamPlayerRef, resetStartTime, setRealtimeEvents]);

  const disconnectConversation = useCallback(async () => {
    setIsConnected(false);
    setRealtimeEvents([]);
    setItems([]);
    setMemoryKv({});
    setCoords(DEFAULT_COORDINATES);
    setMarker(null);

    const client = clientRef.current;
    client.disconnect();

    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.end();

    const wavStreamPlayer = wavStreamPlayerRef.current;
    await wavStreamPlayer.interrupt();
  }, [clientRef, wavRecorderRef, wavStreamPlayerRef, setRealtimeEvents]);

  const deleteConversationItem = useCallback(
    async (id: string) => {
      const client = clientRef.current;
      client.deleteItem(id);
    },
    [clientRef]
  );

  const startRecording = async () => {
    setIsRecording(true);
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const trackSampleOffset = await wavStreamPlayer.interrupt();
    if (trackSampleOffset?.trackId) {
      const { trackId, offset } = trackSampleOffset;
      await client.cancelResponse(trackId, offset);
    }
    await wavRecorder.record((data) => client.appendInputAudio(data.mono));
  };

  const stopRecording = async () => {
    setIsRecording(false);
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.pause();
    client.createResponse();
  };

  const changeTurnEndType = async (value: string) => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    if (value === 'none' && wavRecorder.getStatus() === 'recording') {
      await wavRecorder.pause();
    }
    client.updateSession({
      turn_detection: value === 'none' ? null : { type: 'server_vad' },
    });
    if (value === 'server_vad' && client.isConnected()) {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    }
    setCanPushToTalk(value === 'none');
  };

  useEffect(() => {
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const client = clientRef.current;

    client.updateSession({ instructions: instructions });
    client.updateSession({ input_audio_transcription: { model: 'whisper-1' } });

    registerRealtimeTools(client, {
      onMemorySet: (key, value) => {
        setMemoryKv((memoryKv) => {
          const newKv = { ...memoryKv };
          newKv[key] = value;
          return newKv;
        });
      },
      onWeatherFetch: (lat, lng, location, temperature, wind_speed) => {
        setMarker({ lat, lng, location });
        setCoords({ lat, lng, location });
        setMarker({ lat, lng, location, temperature, wind_speed });
      },
      onScreenshotSet: (screenshot) => {
        setScreenshot(screenshot);
      },
    });

    client.on('realtime.event', (realtimeEvent: RealtimeEvent) => {
      setRealtimeEvents((realtimeEvents) => {
        const lastEvent = realtimeEvents[realtimeEvents.length - 1];
        if (lastEvent?.event.type === realtimeEvent.event.type) {
          lastEvent.count = (lastEvent.count || 0) + 1;
          return realtimeEvents.slice(0, -1).concat(lastEvent);
        } else {
          return realtimeEvents.concat(realtimeEvent);
        }
      });
    });

    client.on('error', (event: any) => console.error(event));

    client.on('conversation.interrupted', async () => {
      const trackSampleOffset = await wavStreamPlayer.interrupt();
      if (trackSampleOffset?.trackId) {
        const { trackId, offset } = trackSampleOffset;
        await client.cancelResponse(trackId, offset);
      }
    });

    client.on('conversation.updated', async ({ item, delta }: any) => {
      const items = client.conversation.getItems();
      if (delta?.audio) {
        wavStreamPlayer.add16BitPCM(delta.audio, item.id);
      }
      if (item.status === 'completed' && item.formatted.audio?.length) {
        const wavFile = await WavRecorder.decode(
          item.formatted.audio,
          24000,
          24000
        );
        item.formatted.file = wavFile;
      }
      setItems(items);
    });

    setItems(client.conversation.getItems());

    return () => {
      client.reset();
    };
  }, [clientRef, wavStreamPlayerRef, setRealtimeEvents]);

  return (
    <div data-component="ConsolePage">
      <div className="content-top">
        <div className="content-title">
          <img src="/openai-logomark.svg" />
          <span>realtime console</span>
        </div>
        <div className="content-api-key">
          {!LOCAL_RELAY_SERVER_URL && (
            <Button
              icon={Edit}
              iconPosition="end"
              buttonStyle="flush"
              label={`api key: ${apiKey.slice(0, 3)}...`}
              onClick={() => resetAPIKey()}
            />
          )}
        </div>
      </div>
      <div className="content-main">
        <div className="content-logs">
          <div className="content-block events">
            <AudioVisualization
              clientCanvasRef={clientCanvasRef}
              serverCanvasRef={serverCanvasRef}
            />
            <EventLog
              events={realtimeEvents}
              expandedEvents={expandedEvents}
              onToggleExpand={toggleEventExpanded}
              formatTime={formatTime}
              scrollRef={eventsScrollRef}
            />
          </div>
          <ConversationLog items={items} onDeleteItem={deleteConversationItem} />
          <div className="content-actions">
            <Toggle
              defaultValue={false}
              labels={['manual', 'vad']}
              values={['none', 'server_vad']}
              onChange={(_, value) => changeTurnEndType(value)}
            />
            <div className="spacer" />
            {isConnected && canPushToTalk && (
              <Button
                label={isRecording ? 'release to send' : 'push to talk'}
                buttonStyle={isRecording ? 'alert' : 'regular'}
                disabled={!isConnected || !canPushToTalk}
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
              />
            )}
            <div className="spacer" />
            <Button
              label={isConnected ? 'disconnect' : 'connect'}
              iconPosition={isConnected ? 'end' : 'start'}
              icon={isConnected ? X : Zap}
              buttonStyle={isConnected ? 'regular' : 'action'}
              onClick={
                isConnected ? disconnectConversation : connectConversation
              }
            />
          </div>
        </div>
        <div className="content-right">
          <div className="content-block map">
            {screenshot && <img src={screenshot} alt="screenshot" />}
          </div>
        </div>
      </div>
    </div>
  );
}
