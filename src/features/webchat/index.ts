/**
 * Webchat Feature
 *
 * WebSocket-based real-time chat interface with message history,
 * typing indicators, and multi-room support.
 */

import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { FeatureModule, FeatureContext, FeatureMeta, HealthStatus } from '../core/plugin-loader';

/** Webchat configuration */
export interface WebchatConfig {
  enabled: boolean;
  port: number;
  maxConnections: number;
  messageHistory: number;
}

/** Chat message structure */
export interface ChatMessage {
  id: string;
  userId: string;
  roomId: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/** Connected client */
interface Client {
  ws: WebSocket;
  userId: string;
  roomId: string;
  connectedAt: number;
}

/**
 * Webchat feature — real-time WebSocket chat server.
 *
 * Provides browser-based chat interface with support for multiple
 * rooms, message history, and typing indicators.
 */
class WebchatFeature implements FeatureModule {
  readonly meta: FeatureMeta = {
    name: 'webchat',
    version: '0.1.0',
    description: 'WebSocket-based real-time chat interface',
    dependencies: [],
  };

  private server: WebSocketServer | null = null;
  private httpServer: HttpServer | null = null;
  private clients: Map<string, Client> = new Map();
  private messageHistory: ChatMessage[] = [];
  private config: WebchatConfig = {
    enabled: false,
    port: 3001,
    maxConnections: 1000,
    messageHistory: 100,
  };
  private ctx!: FeatureContext;

  async init(config: Record<string, unknown>, context: FeatureContext): Promise<void> {
    this.ctx = context;
    this.config = { ...this.config, ...(config as Partial<WebchatConfig>) };
    this.ctx.logger.info('Webchat initialized', { port: this.config.port });
  }

  async start(): Promise<void> {
    this.httpServer = new HttpServer();
    this.server = new WebSocketServer({ server: this.httpServer });

    this.server.on('connection', (ws: WebSocket, req) => {
      if (this.clients.size >= this.config.maxConnections) {
        ws.close(1013, 'Server at capacity');
        return;
      }

      const clientId = this.generateId();
      const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
      const roomId = url.searchParams.get('room') ?? 'default';
      const userId = url.searchParams.get('user') ?? `anon-${clientId}`;

      this.clients.set(clientId, { ws, userId, roomId, connectedAt: Date.now() });
      this.ctx.logger.info('Client connected', { clientId, userId, roomId });

      // Send message history
      const history = this.messageHistory
        .filter(m => m.roomId === roomId)
        .slice(-this.config.messageHistory);
      ws.send(JSON.stringify({ type: 'history', messages: history }));

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handleMessage(clientId, msg);
        } catch {
          this.ctx.logger.warn('Invalid message received', { clientId });
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        this.ctx.logger.info('Client disconnected', { clientId });
      });

      ws.on('error', (err) => {
        this.ctx.logger.error('WebSocket error', { clientId, error: err.message });
      });
    });

    this.httpServer.listen(this.config.port, () => {
      this.ctx.logger.info(`Webchat server listening on port ${this.config.port}`);
    });
  }

  async stop(): Promise<void> {
    for (const [, client] of this.clients) {
      client.ws.close(1001, 'Server shutting down');
    }
    this.clients.clear();
    this.server?.close();
    this.httpServer?.close();
  }

  async healthCheck(): Promise<HealthStatus> {
    return {
      healthy: this.server !== null,
      message: this.server ? `Active, ${this.clients.size} clients` : 'Not started',
      details: {
        clients: this.clients.size,
        messages: this.messageHistory.length,
      },
    };
  }

  /** Handle incoming WebSocket message */
  private handleMessage(clientId: string, msg: { type: string; content?: string }): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (msg.type) {
      case 'chat': {
        const chatMsg: ChatMessage = {
          id: this.generateId(),
          userId: client.userId,
          roomId: client.roomId,
          content: msg.content ?? '',
          role: 'user',
          timestamp: Date.now(),
        };
        this.messageHistory.push(chatMsg);
        if (this.messageHistory.length > this.config.messageHistory * 10) {
          this.messageHistory = this.messageHistory.slice(-this.config.messageHistory);
        }
        this.broadcastToRoom(client.roomId, { type: 'message', message: chatMsg });
        break;
      }
      case 'typing': {
        this.broadcastToRoom(client.roomId, {
          type: 'typing',
          userId: client.userId,
        }, clientId);
        break;
      }
    }
  }

  /** Broadcast message to all clients in a room */
  private broadcastToRoom(roomId: string, data: unknown, excludeClientId?: string): void {
    const payload = JSON.stringify(data);
    for (const [id, client] of this.clients) {
      if (id !== excludeClientId && client.roomId === roomId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}

export default new WebchatFeature();
