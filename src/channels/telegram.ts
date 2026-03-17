/**
 * Telegram Channel
 *
 * Wrapper around OpenClaw's Telegram integration with AG-Claw
 * feature bridge and message formatting.
 */

import { FeatureModule, FeatureContext, FeatureMeta, HealthStatus } from '../core/plugin-loader';

/** Telegram channel configuration */
export interface TelegramChannelConfig {
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  allowedChats: number[];
  blockedChats: number[];
  parseMode: 'HTML' | 'Markdown' | 'MarkdownV2';
}

/** Telegram message */
export interface TelegramMessage {
  chatId: number;
  text: string;
  parseMode?: string;
  replyToMessageId?: number;
  disableNotification?: boolean;
}

/** Telegram update handler */
export type TelegramUpdateHandler = (update: Record<string, unknown>) => Promise<void>;

/**
 * Telegram channel — wraps OpenClaw's Telegram integration.
 *
 * Bridges OpenClaw's existing Telegram support with AG-Claw's
 * feature system, providing unified message handling.
 */
class TelegramChannel implements FeatureModule {
  readonly meta: FeatureMeta = {
    name: 'telegram',
    version: '0.1.0',
    description: 'Telegram channel integration (OpenClaw wrapper)',
    dependencies: [],
  };

  private config: TelegramChannelConfig = {
    enabled: false,
    parseMode: 'HTML',
    allowedChats: [],
    blockedChats: [],
  };
  private ctx!: FeatureContext;
  private handlers: TelegramUpdateHandler[] = [];
  private connected = false;

  async init(config: Record<string, unknown>, context: FeatureContext): Promise<void> {
    this.ctx = context;
    this.config = { ...this.config, ...(config as Partial<TelegramChannelConfig>) };
  }

  async start(): Promise<void> {
    if (!this.config.token) {
      this.ctx.logger.warn('Telegram token not configured');
      return;
    }

    this.connected = true;
    this.ctx.logger.info('Telegram channel active', {
      allowedChats: this.config.allowedChats.length || 'all',
    });
  }

  async stop(): Promise<void> {
    this.connected = false;
  }

  async healthCheck(): Promise<HealthStatus> {
    return {
      healthy: this.connected,
      message: this.connected ? 'Connected' : 'Disconnected',
    };
  }

  /** Register update handler */
  onUpdate(handler: TelegramUpdateHandler): void {
    this.handlers.push(handler);
  }

  /** Check if chat is allowed */
  isChatAllowed(chatId: number): boolean {
    if (this.config.blockedChats.includes(chatId)) return false;
    if (this.config.allowedChats.length === 0) return true;
    return this.config.allowedChats.includes(chatId);
  }

  /** Send a message to a Telegram chat */
  async sendMessage(message: TelegramMessage): Promise<boolean> {
    if (!this.config.token || !this.connected) return false;

    try {
      const url = `https://api.telegram.org/bot${this.config.token}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: message.chatId,
          text: message.text,
          parse_mode: message.parseMode ?? this.config.parseMode,
          reply_to_message_id: message.replyToMessageId,
          disable_notification: message.disableNotification,
        }),
      });

      return response.ok;
    } catch (err) {
      this.ctx.logger.error('Failed to send Telegram message', {
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  /** Process incoming update from OpenClaw */
  async processUpdate(update: Record<string, unknown>): Promise<void> {
    for (const handler of this.handlers) {
      try {
        await handler(update);
      } catch (err) {
        this.ctx.logger.error('Telegram update handler error', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}

export default new TelegramChannel();
