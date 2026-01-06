import { RealtimeRelay } from './lib/relay.js';
import dotenv from 'dotenv';
dotenv.config({ override: true });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error(
    `Environment variable "OPENAI_API_KEY" is required.\n` +
      `Please set it in your .env file.`
  );
  process.exit(1);
}

const PORT = parseInt(process.env.PORT) || 8081;

// Configure relay server with optional environment variables
const config = {
  connectionTimeout: parseInt(process.env.CONNECTION_TIMEOUT) || 30000,
  heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL) || 30000,
  maxMessageSize: parseInt(process.env.MAX_MESSAGE_SIZE) || 1024 * 1024,
  logLevel: parseInt(process.env.LOG_LEVEL) || 2, // INFO by default
};

const relay = new RealtimeRelay(OPENAI_API_KEY, config);
relay.listen(PORT);

// Log configuration on startup
console.log('Relay server configuration:');
console.log(`- Port: ${PORT}`);
console.log(`- Connection timeout: ${config.connectionTimeout}ms`);
console.log(`- Heartbeat interval: ${config.heartbeatInterval}ms`);
console.log(`- Max message size: ${config.maxMessageSize} bytes`);
console.log(`- Log level: ${config.logLevel} (0=ERROR, 1=WARN, 2=INFO, 3=DEBUG)`);
