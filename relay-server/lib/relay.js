import { WebSocketServer } from 'ws';
import { RealtimeClient } from '@openai/realtime-api-beta';

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const WS_CLOSE_CODES = {
  NORMAL: 1000,
  INVALID_PATH: 4000,
  CONNECTION_FAILED: 4001,
  INTERNAL_ERROR: 4002,
};

const DEFAULT_CONFIG = {
  connectionTimeout: 30000,
  heartbeatInterval: 30000,
  maxMessageSize: 1024 * 1024, // 1MB
  logLevel: LOG_LEVELS.INFO,
};

export class RealtimeRelay {
  constructor(apiKey, config = {}) {
    this.apiKey = apiKey;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.connections = new Map();
    this.wss = null;
  }

  listen(port) {
    this.wss = new WebSocketServer({ port });
    this.wss.on('connection', this.connectionHandler.bind(this));
    this.log('INFO', `Listening on ws://localhost:${port}`);
  }

  async connectionHandler(ws, req) {
    const connectionId = this.generateConnectionId();

    try {
      // Validate request
      if (!req.url) {
        this.log('WARN', `[${connectionId}] No URL provided, closing connection`);
        this.closeConnection(ws, WS_CLOSE_CODES.INVALID_PATH, 'No URL provided');
        return;
      }

      const url = new URL(req.url, `http://${req.headers.host}`);
      const pathname = url.pathname;

      if (pathname !== '/') {
        this.log('WARN', `[${connectionId}] Invalid pathname: "${pathname}"`);
        this.closeConnection(ws, WS_CLOSE_CODES.INVALID_PATH, `Invalid pathname: ${pathname}`);
        return;
      }

      // Initialize connection
      this.log('INFO', `[${connectionId}] New connection established`);
      const connection = this.initializeConnection(connectionId, ws);

      // Setup OpenAI client
      await this.setupOpenAIClient(connectionId, connection);

    } catch (error) {
      this.log('ERROR', `[${connectionId}] Connection handler error: ${error.message}`);
      this.closeConnection(ws, WS_CLOSE_CODES.INTERNAL_ERROR, 'Internal server error');
      this.cleanupConnection(connectionId);
    }
  }

  initializeConnection(connectionId, ws) {
    const connection = {
      id: connectionId,
      ws,
      client: null,
      messageQueue: [],
      isConnecting: true,
      heartbeatTimer: null,
      connectionTimer: null,
    };

    // Setup message handler
    ws.on('message', (data) => this.handleClientMessage(connectionId, data));

    // Setup close handler
    ws.on('close', () => this.handleClientDisconnect(connectionId));

    // Setup error handler
    ws.on('error', (error) => this.handleClientError(connectionId, error));

    // Setup connection timeout
    connection.connectionTimer = setTimeout(() => {
      this.log('WARN', `[${connectionId}] Connection timeout`);
      this.closeConnection(ws, WS_CLOSE_CODES.CONNECTION_FAILED, 'Connection timeout');
      this.cleanupConnection(connectionId);
    }, this.config.connectionTimeout);

    this.connections.set(connectionId, connection);
    return connection;
  }

  async setupOpenAIClient(connectionId, connection) {
    const { ws } = connection;

    try {
      this.log('INFO', `[${connectionId}] Connecting to OpenAI...`);
      const client = new RealtimeClient({ apiKey: this.apiKey });
      connection.client = client;

      // Setup downstream relay (OpenAI -> Client)
      this.setupDownstreamRelay(connectionId, client, ws);

      // Connect to OpenAI
      await client.connect();

      // Clear connection timeout
      if (connection.connectionTimer) {
        clearTimeout(connection.connectionTimer);
        connection.connectionTimer = null;
      }

      connection.isConnecting = false;
      this.log('INFO', `[${connectionId}] Connected to OpenAI successfully`);

      // Process queued messages
      this.processMessageQueue(connectionId, connection);

      // Setup heartbeat
      this.setupHeartbeat(connectionId, connection);

    } catch (error) {
      this.log('ERROR', `[${connectionId}] Error connecting to OpenAI: ${error.message}`);
      this.sendErrorToClient(ws, 'connection_failed', 'Failed to connect to OpenAI');
      this.closeConnection(ws, WS_CLOSE_CODES.CONNECTION_FAILED, 'OpenAI connection failed');
      this.cleanupConnection(connectionId);
    }
  }

  setupDownstreamRelay(connectionId, client, ws) {
    // Relay events from OpenAI to client
    client.realtime.on('server.*', (event) => {
      try {
        this.log('DEBUG', `[${connectionId}] Relaying "${event.type}" to client`);
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify(event));
        }
      } catch (error) {
        this.log('ERROR', `[${connectionId}] Error relaying to client: ${error.message}`);
      }
    });

    // Handle OpenAI connection close
    client.realtime.on('close', () => {
      this.log('INFO', `[${connectionId}] OpenAI connection closed`);
      this.closeConnection(ws, WS_CLOSE_CODES.NORMAL, 'OpenAI connection closed');
      this.cleanupConnection(connectionId);
    });
  }

  handleClientMessage(connectionId, data) {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      this.log('WARN', `[${connectionId}] Message received for unknown connection`);
      return;
    }

    // Validate message size
    if (data.length > this.config.maxMessageSize) {
      this.log('WARN', `[${connectionId}] Message too large: ${data.length} bytes`);
      this.sendErrorToClient(connection.ws, 'message_too_large', 'Message exceeds maximum size');
      return;
    }

    // Queue messages if still connecting
    if (connection.isConnecting) {
      connection.messageQueue.push(data);
      this.log('DEBUG', `[${connectionId}] Message queued (connecting)`);
      return;
    }

    // Process message
    this.processClientMessage(connectionId, connection, data);
  }

  processClientMessage(connectionId, connection, data) {
    try {
      const event = JSON.parse(data);

      // Validate event structure
      if (!event.type) {
        throw new Error('Event missing type field');
      }

      this.log('DEBUG', `[${connectionId}] Relaying "${event.type}" to OpenAI`);

      if (connection.client && connection.client.isConnected()) {
        connection.client.realtime.send(event.type, event);
      } else {
        throw new Error('Client not connected');
      }
    } catch (error) {
      this.log('ERROR', `[${connectionId}] Error processing message: ${error.message}`);
      this.sendErrorToClient(connection.ws, 'invalid_message', `Failed to process message: ${error.message}`);
    }
  }

  processMessageQueue(connectionId, connection) {
    this.log('INFO', `[${connectionId}] Processing ${connection.messageQueue.length} queued messages`);

    while (connection.messageQueue.length > 0) {
      const data = connection.messageQueue.shift();
      this.processClientMessage(connectionId, connection, data);
    }
  }

  handleClientDisconnect(connectionId) {
    this.log('INFO', `[${connectionId}] Client disconnected`);
    this.cleanupConnection(connectionId);
  }

  handleClientError(connectionId, error) {
    this.log('ERROR', `[${connectionId}] WebSocket error: ${error.message}`);
  }

  setupHeartbeat(connectionId, connection) {
    if (this.config.heartbeatInterval <= 0) {
      return;
    }

    connection.heartbeatTimer = setInterval(() => {
      if (connection.ws.readyState === connection.ws.OPEN) {
        try {
          connection.ws.ping();
          this.log('DEBUG', `[${connectionId}] Heartbeat sent`);
        } catch (error) {
          this.log('ERROR', `[${connectionId}] Heartbeat failed: ${error.message}`);
          this.cleanupConnection(connectionId);
        }
      } else {
        this.cleanupConnection(connectionId);
      }
    }, this.config.heartbeatInterval);
  }

  cleanupConnection(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    this.log('INFO', `[${connectionId}] Cleaning up connection`);

    // Clear timers
    if (connection.heartbeatTimer) {
      clearInterval(connection.heartbeatTimer);
    }
    if (connection.connectionTimer) {
      clearTimeout(connection.connectionTimer);
    }

    // Disconnect client
    if (connection.client) {
      try {
        connection.client.disconnect();
      } catch (error) {
        this.log('ERROR', `[${connectionId}] Error disconnecting client: ${error.message}`);
      }
    }

    // Close WebSocket if still open
    if (connection.ws.readyState === connection.ws.OPEN ||
        connection.ws.readyState === connection.ws.CONNECTING) {
      try {
        connection.ws.close(WS_CLOSE_CODES.NORMAL);
      } catch (error) {
        this.log('ERROR', `[${connectionId}] Error closing WebSocket: ${error.message}`);
      }
    }

    // Remove from connections map
    this.connections.delete(connectionId);
  }

  closeConnection(ws, code, reason) {
    try {
      if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
        ws.close(code, reason);
      }
    } catch (error) {
      this.log('ERROR', `Error closing connection: ${error.message}`);
    }
  }

  sendErrorToClient(ws, errorType, message) {
    if (ws.readyState === ws.OPEN) {
      try {
        ws.send(JSON.stringify({
          type: 'error',
          error: {
            type: errorType,
            message: message,
          },
        }));
      } catch (error) {
        this.log('ERROR', `Failed to send error to client: ${error.message}`);
      }
    }
  }

  generateConnectionId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  log(level, ...args) {
    const levelValue = LOG_LEVELS[level] || LOG_LEVELS.INFO;
    if (levelValue <= this.config.logLevel) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [RealtimeRelay] [${level}]`, ...args);
    }
  }

  getConnectionStats() {
    return {
      activeConnections: this.connections.size,
      connections: Array.from(this.connections.values()).map(conn => ({
        id: conn.id,
        isConnecting: conn.isConnecting,
        queuedMessages: conn.messageQueue.length,
      })),
    };
  }
}
