/**
 * AG-Claw Entry Point
 *
 * Bootstraps the AG-Claw agent framework:
 * - Loads configuration
 * - Initializes logging
 * - Starts the plugin loader
 * - Enables configured features
 * - Sets up graceful shutdown
 */

import { getConfig, AGClawConfig } from './core/config';
import { createLogger, Logger } from './core/logger';
import { PluginLoader } from './core/plugin-loader';

class AGClaw {
  private config: AGClawConfig;
  private logger: Logger;
  private pluginLoader: PluginLoader;
  private shuttingDown = false;

  constructor() {
    const configManager = getConfig();
    this.config = configManager.get();
    this.logger = createLogger({
      level: this.config.logging.level,
      format: this.config.logging.format,
    });
    this.pluginLoader = new PluginLoader(this.config);
  }

  /** Start the AG-Claw framework */
  async start(): Promise<void> {
    this.logger.info('Starting AG-Claw Framework', {
      version: '0.1.0',
      nodeVersion: process.version,
      platform: process.platform,
    });

    // Register shutdown handlers
    this.registerShutdownHandlers();

    // Load and enable features
    await this.pluginLoader.loadAll();
    await this.pluginLoader.enableAll();

    const features = this.pluginLoader.listFeatures();
    const activeCount = features.filter(f => f.state === 'active').length;
    const totalCount = features.length;

    this.logger.info(`AG-Claw started successfully`, {
      features: `${activeCount}/${totalCount} active`,
      port: this.config.server.port,
    });

    // Start health check interval
    this.startHealthChecks();
  }

  /** Periodic health checks for active features */
  private startHealthChecks(): void {
    setInterval(async () => {
      if (this.shuttingDown) return;

      const results = await this.pluginLoader.healthCheckAll();
      for (const [name, status] of results) {
        if (!status.healthy) {
          this.logger.warn(`Feature unhealthy: ${name}`, { message: status.message });
        }
      }
    }, 60_000); // Every minute
  }

  /** Register signal handlers for graceful shutdown */
  private registerShutdownHandlers(): void {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGUSR2'];

    for (const signal of signals) {
      process.on(signal, async () => {
        if (this.shuttingDown) return;
        this.shuttingDown = true;

        this.logger.info(`Received ${signal}, shutting down gracefully...`);
        await this.shutdown();
        process.exit(0);
      });
    }

    process.on('uncaughtException', (err) => {
      this.logger.error('Uncaught exception', { error: err.message, stack: err.stack });
      // Don't exit — log and continue
    });

    process.on('unhandledRejection', (reason) => {
      this.logger.error('Unhandled rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
      });
    });
  }

  /** Graceful shutdown */
  private async shutdown(): Promise<void> {
    const features = this.pluginLoader.listFeatures();
    const active = features.filter(f => f.state === 'active');

    this.logger.info(`Stopping ${active.length} active features...`);

    for (const feature of active.reverse()) {
      try {
        await this.pluginLoader.disableFeature(feature.name);
      } catch (err) {
        this.logger.error(`Error stopping feature: ${feature.name}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    this.logger.info('AG-Claw shutdown complete');
  }
}

// Start if run directly
if (require.main === module) {
  const app = new AGClaw();
  app.start().catch((err) => {
    console.error('Failed to start AG-Claw:', err);
    process.exit(1);
  });
}

export { AGClaw };
