# OpenAI Realtime Mobile App

A simplified React Native implementation of the OpenAI Realtime API for voice conversations.

## Features

- Voice-to-voice conversations using OpenAI's Realtime API
- Simple, clean UI for mobile devices
- Support for both iOS and Android
- Real-time audio recording and streaming
- Text display of conversation history

## Prerequisites

- Node.js 18 or higher
- React Native development environment set up
  - For iOS: Xcode and CocoaPods
  - For Android: Android Studio and SDK
- OpenAI API key with Realtime API access

## Installation

1. Navigate to the mobile directory:
```bash
cd mobile
```

2. Install dependencies:
```bash
npm install
```

3. For iOS, install pods:
```bash
cd ios && pod install && cd ..
```

## Running the App

### iOS
```bash
npm run ios
```

### Android
```bash
npm run android
```

## Usage

1. Launch the app
2. Enter your OpenAI API key in the input field
3. Tap "Connect" to establish connection with OpenAI Realtime API
4. Tap the "🎤 Record" button to start speaking
5. Tap "⏹️ Stop" when you're done speaking
6. The assistant will respond with voice and text

## Configuration

The app is configured with:
- Voice: "alloy" (OpenAI's default voice)
- Turn detection: Server VAD (Voice Activity Detection)
- Audio transcription: Whisper-1 model

You can modify these settings in `App.tsx` in the `connect()` function.

## Permissions

### iOS
The app requires microphone permission. Make sure to add the following to your `Info.plist`:
```xml
<key>NSMicrophoneUsageDescription</key>
<string>This app needs access to the microphone for voice conversations</string>
```

### Android
Microphone and storage permissions are already configured in `AndroidManifest.xml`.

## Architecture

The app uses:
- **@openai/realtime-api-beta**: Official OpenAI Realtime API client
- **react-native-audio-recorder-player**: For audio recording/playback
- **react-native-permissions**: For handling device permissions

## Limitations

This is a simplified implementation for demonstration purposes:

1. **Audio Processing**: The current implementation uses basic audio recording. For production, you'd need:
   - Real-time audio streaming to the API
   - Proper PCM16 format conversion at 24kHz
   - Audio playback of assistant responses

2. **Error Handling**: Basic error handling is implemented. Production apps should handle:
   - Network disconnections
   - API rate limits
   - Permission denials
   - Audio device issues

3. **Features**: Many features from the web version are not included:
   - Function calling (weather, web scraping, etc.)
   - Audio visualization
   - Event logging
   - Memory/context management

## Extending the App

To add more features:

1. **Function Calling**: Add tools using `client.addTool()` in the `initializeClient()` function
2. **Audio Visualization**: Use React Native audio visualization libraries
3. **Better UI**: Add more controls, settings, and visual feedback
4. **Persistent Storage**: Save API key and conversation history

## Troubleshooting

- **"Cannot find module"**: Run `npm install` again
- **iOS build fails**: Try `cd ios && pod install && cd ..`
- **Android permissions**: Make sure you grant microphone permission when prompted
- **Connection fails**: Verify your API key has Realtime API access

## Notes

- The OpenAI Realtime API is currently in beta
- API key is stored in memory only (not persisted)
- This is a starting point - enhance as needed for your use case

## License

Same as the parent project (see LICENSE in root directory)
