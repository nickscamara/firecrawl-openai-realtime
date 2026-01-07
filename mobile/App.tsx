import React, {useState, useRef, useEffect} from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import {RealtimeClient} from '@openai/realtime-api-beta';
import {Buffer} from 'buffer';

// Polyfill for Buffer
global.Buffer = Buffer;

interface Message {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

function App(): React.JSX.Element {
  const [apiKey, setApiKey] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState('Enter your OpenAI API key to start');

  const clientRef = useRef<RealtimeClient | null>(null);
  const audioRecorderPlayerRef = useRef(new AudioRecorderPlayer());
  const audioBufferRef = useRef<Int16Array[]>([]);

  // Initialize RealtimeClient
  const initializeClient = () => {
    if (!apiKey) {
      Alert.alert('Error', 'Please enter your OpenAI API key');
      return;
    }

    try {
      const client = new RealtimeClient({
        apiKey: apiKey,
        dangerouslyAllowAPIKeyInBrowser: true,
      });

      // Set up event listeners
      client.on('conversation.updated', ({item, delta}: any) => {
        if (item.role === 'assistant' && item.formatted?.text) {
          setMessages((prev) => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage?.role === 'assistant') {
              // Update existing assistant message
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...lastMessage,
                text: item.formatted.text,
              };
              return updated;
            } else {
              // Add new assistant message
              return [
                ...prev,
                {
                  role: 'assistant',
                  text: item.formatted.text,
                  timestamp: new Date(),
                },
              ];
            }
          });
        }

        // Handle audio playback (simplified - would need proper implementation)
        if (delta?.audio) {
          // In a full implementation, you'd play this audio
          console.log('Received audio delta');
        }
      });

      client.on('error', (event: any) => {
        console.error('RealtimeClient error:', event);
        setStatus('Error: ' + event.message);
      });

      clientRef.current = client;
      setStatus('Client initialized. Click Connect to start.');
    } catch (error: any) {
      Alert.alert('Error', 'Failed to initialize client: ' + error.message);
    }
  };

  // Connect to OpenAI Realtime API
  const connect = async () => {
    if (!clientRef.current) {
      initializeClient();
      if (!clientRef.current) return;
    }

    try {
      setStatus('Connecting...');
      await clientRef.current.connect();

      // Update session settings
      clientRef.current.updateSession({
        instructions: 'You are a helpful voice assistant. Be concise and friendly.',
        voice: 'alloy',
        input_audio_transcription: {model: 'whisper-1'},
        turn_detection: {type: 'server_vad'},
      });

      setIsConnected(true);
      setStatus('Connected! Tap Record to speak.');

      // Send initial greeting
      clientRef.current.sendUserMessageContent([
        {
          type: 'input_text',
          text: 'Hello!',
        },
      ]);
    } catch (error: any) {
      Alert.alert('Connection Error', error.message);
      setStatus('Failed to connect');
    }
  };

  // Disconnect
  const disconnect = async () => {
    if (clientRef.current) {
      await clientRef.current.disconnect();
      setIsConnected(false);
      setStatus('Disconnected');
    }
  };

  // Start recording
  const startRecording = async () => {
    if (!isConnected) {
      Alert.alert('Error', 'Please connect first');
      return;
    }

    try {
      setIsRecording(true);
      setStatus('Recording... Tap Stop when done.');
      audioBufferRef.current = [];

      // Start recording with audio recorder
      const path = Platform.select({
        ios: 'audio.m4a',
        android: 'sdcard/audio.mp4',
      });

      await audioRecorderPlayerRef.current.startRecorder(path);

      // Note: In a production app, you'd need to stream audio data
      // to the RealtimeClient in real-time using appendInputAudio()
    } catch (error: any) {
      Alert.alert('Recording Error', error.message);
      setIsRecording(false);
    }
  };

  // Stop recording
  const stopRecording = async () => {
    try {
      const result = await audioRecorderPlayerRef.current.stopRecorder();
      setIsRecording(false);
      setStatus('Processing...');

      // In a full implementation, you would:
      // 1. Read the recorded audio file
      // 2. Convert it to the proper format (PCM16, 24kHz)
      // 3. Send it to the client using appendInputAudio()
      // 4. Call createResponse()

      // For now, we'll just send a text message as a placeholder
      const userMessage = '(Audio message sent)';
      setMessages((prev) => [
        ...prev,
        {
          role: 'user',
          text: userMessage,
          timestamp: new Date(),
        },
      ]);

      // Trigger response
      if (clientRef.current) {
        clientRef.current.createResponse();
      }

      setStatus('Connected. Ready to record.');
    } catch (error: any) {
      Alert.alert('Error', error.message);
      setIsRecording(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
      audioRecorderPlayerRef.current.removeRecordBackListener();
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>OpenAI Realtime</Text>
        <Text style={styles.status}>{status}</Text>
      </View>

      {!isConnected && (
        <View style={styles.setupContainer}>
          <Text style={styles.label}>OpenAI API Key:</Text>
          <TextInput
            style={styles.input}
            placeholder="sk-..."
            value={apiKey}
            onChangeText={setApiKey}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.button, styles.connectButton]}
            onPress={connect}>
            <Text style={styles.buttonText}>Connect</Text>
          </TouchableOpacity>
        </View>
      )}

      {isConnected && (
        <>
          <ScrollView style={styles.messagesContainer}>
            {messages.map((msg, index) => (
              <View
                key={index}
                style={[
                  styles.message,
                  msg.role === 'user' ? styles.userMessage : styles.assistantMessage,
                ]}>
                <Text style={styles.messageRole}>
                  {msg.role === 'user' ? 'You' : 'Assistant'}
                </Text>
                <Text style={styles.messageText}>{msg.text}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.controls}>
            {!isRecording ? (
              <TouchableOpacity
                style={[styles.button, styles.recordButton]}
                onPress={startRecording}>
                <Text style={styles.buttonText}>🎤 Record</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.button, styles.stopButton]}
                onPress={stopRecording}>
                <Text style={styles.buttonText}>⏹️ Stop</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.button, styles.disconnectButton]}
              onPress={disconnect}>
              <Text style={styles.buttonText}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  status: {
    fontSize: 14,
    color: '#888',
  },
  setupContainer: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 16,
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
  },
  message: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
  },
  userMessage: {
    backgroundColor: '#2a4a8a',
    alignSelf: 'flex-end',
    maxWidth: '80%',
  },
  assistantMessage: {
    backgroundColor: '#2a2a2a',
    alignSelf: 'flex-start',
    maxWidth: '80%',
  },
  messageRole: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
    fontWeight: 'bold',
  },
  messageText: {
    fontSize: 16,
    color: '#fff',
  },
  controls: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  connectButton: {
    backgroundColor: '#10a37f',
  },
  recordButton: {
    backgroundColor: '#d9534f',
  },
  stopButton: {
    backgroundColor: '#f0ad4e',
  },
  disconnectButton: {
    backgroundColor: '#5a5a5a',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default App;
