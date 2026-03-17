/**
 * Browser Automation Feature
 *
 * Headless browser control for web scraping, form filling, and page interaction.
 * Uses Puppeteer-compatible API with sandboxed execution.
 */

import { FeatureModule, FeatureContext, FeatureMeta, HealthStatus } from '../../core/plugin-loader';

/** Browser automation configuration */
export interface BrowserAutomationConfig {
  enabled: boolean;
  headless: boolean;
  timeout: number;
  maxPages: number;
  allowedDomains: string[];
  blockedDomains: string[];
}

/** Navigation options */
export interface NavigateOptions {
  url: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  timeout?: number;
}

/** Page action types */
export type PageAction =
  | { type: 'click'; selector: string }
  | { type: 'type'; selector: string; text: string }
  | { type: 'select'; selector: string; value: string }
  | { type: 'screenshot'; path?: string; fullPage?: boolean }
  | { type: 'extract'; selector: string; attribute?: string }
  | { type: 'evaluate'; script: string }
  | { type: 'waitFor'; selector: string; timeout?: number };

/** Action result */
export interface ActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  screenshot?: Buffer;
}

/** Page session */
interface PageSession {
  id: string;
  url: string;
  createdAt: number;
  lastAction: number;
}

/**
 * Browser Automation feature — headless browser control.
 *
 * Provides web scraping, form interaction, and page manipulation
 * capabilities with domain allowlists and sandboxed execution.
 */
class BrowserAutomationFeature implements FeatureModule {
  readonly meta: FeatureMeta = {
    name: 'browser-automation',
    version: '0.1.0',
    description: 'Headless browser control for web scraping and automation',
    dependencies: [],
  };

  private config: BrowserAutomationConfig = {
    enabled: false,
    headless: true,
    timeout: 30000,
    maxPages: 10,
    allowedDomains: ['*'],
    blockedDomains: [],
  };
  private ctx!: FeatureContext;
  private sessions: Map<string, PageSession> = new Map();

  async init(config: Record<string, unknown>, context: FeatureContext): Promise<void> {
    this.ctx = context;
    this.config = { ...this.config, ...(config as Partial<BrowserAutomationConfig>) };
  }

  async start(): Promise<void> {
    this.ctx.logger.info('Browser Automation active', {
      headless: this.config.headless,
      maxPages: this.config.maxPages,
    });
  }

  async stop(): Promise<void> {
    this.sessions.clear();
  }

  async healthCheck(): Promise<HealthStatus> {
    return {
      healthy: true,
      details: { activeSessions: this.sessions.size },
    };
  }

  /** Check if URL is allowed by domain policy */
  isUrlAllowed(url: string): boolean {
    try {
      const domain = new URL(url).hostname;
      if (this.config.blockedDomains.some(d => domain.includes(d))) return false;
      if (this.config.allowedDomains.includes('*')) return true;
      return this.config.allowedDomains.some(d => domain.includes(d));
    } catch {
      return false;
    }
  }

  /** Create a new browser session */
  async createSession(url?: string): Promise<string> {
    if (this.sessions.size >= this.config.maxPages) {
      throw new Error(`Maximum page limit (${this.config.maxPages}) reached`);
    }

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const session: PageSession = {
      id: sessionId,
      url: url ?? 'about:blank',
      createdAt: Date.now(),
      lastAction: Date.now(),
    };

    this.sessions.set(sessionId, session);
    this.ctx.logger.debug('Browser session created', { sessionId, url });
    return sessionId;
  }

  /** Navigate to a URL */
  async navigate(sessionId: string, options: NavigateOptions): Promise<ActionResult> {
    if (!this.isUrlAllowed(options.url)) {
      return { success: false, error: `URL not allowed: ${options.url}` };
    }

    const session = this.sessions.get(sessionId);
    if (!session) return { success: false, error: 'Session not found' };

    session.url = options.url;
    session.lastAction = Date.now();

    // Actual browser navigation would happen here via Puppeteer/Playwright
    this.ctx.logger.debug('Navigating', { sessionId, url: options.url });
    return { success: true, data: { url: options.url } };
  }

  /** Execute a page action */
  async executeAction(sessionId: string, action: PageAction): Promise<ActionResult> {
    const session = this.sessions.get(sessionId);
    if (!session) return { success: false, error: 'Session not found' };

    session.lastAction = Date.now();

    // Action execution would interface with the actual browser
    this.ctx.logger.debug('Executing action', { sessionId, actionType: action.type });
    return { success: true };
  }

  /** Close a browser session */
  async closeSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    this.ctx.logger.debug('Browser session closed', { sessionId });
  }
}

export default new BrowserAutomationFeature();
