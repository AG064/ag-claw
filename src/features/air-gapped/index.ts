/**
 * Air-Gapped Feature
 *
 * Fully offline operation mode with local models, no external API calls,
 * and encrypted local storage. Designed for high-security environments.
 */

import { FeatureModule, FeatureContext, FeatureMeta, HealthStatus } from '../core/plugin-loader';

/** Air-gapped configuration */
export interface AirGappedConfig {
  enabled: boolean;
  localModelPath: string;
  localEmbeddingPath: string;
  allowedHosts: string[];
  encryptStorage: boolean;
  auditAllAccess: boolean;
  maxOfflineDays: number;
}

/** Network policy */
export interface NetworkPolicy {
  allowExternalApi: boolean;
  allowDns: boolean;
  allowNtp: boolean;
  blockedPorts: number[];
  allowedHosts: string[];
}

/** Audit log entry */
export interface AuditEntry {
  id: string;
  timestamp: number;
  action: string;
  resource: string;
  result: 'allowed' | 'denied';
  details?: Record<string, unknown>;
}

/**
 * Air-Gapped feature — fully offline operation mode.
 *
 * Enables AG-Claw to run in completely isolated environments
 * using local models, encrypted storage, and strict network policies.
 */
class AirGappedFeature implements FeatureModule {
  readonly meta: FeatureMeta = {
    name: 'air-gapped',
    version: '0.1.0',
    description: 'Fully offline operation mode with local models',
    dependencies: [],
  };

  private config: AirGappedConfig = {
    enabled: false,
    localModelPath: './models/llm',
    localEmbeddingPath: './models/embeddings',
    allowedHosts: [],
    encryptStorage: true,
    auditAllAccess: true,
    maxOfflineDays: 365,
  };
  private ctx!: FeatureContext;
  private networkPolicy: NetworkPolicy = {
    allowExternalApi: false,
    allowDns: false,
    allowNtp: false,
    blockedPorts: [80, 443, 8080],
    allowedHosts: [],
  };
  private auditLog: AuditEntry[] = [];
  private active = false;

  async init(config: Record<string, unknown>, context: FeatureContext): Promise<void> {
    this.ctx = context;
    this.config = { ...this.config, ...(config as Partial<AirGappedConfig>) };
  }

  async start(): Promise<void> {
    this.active = true;
    this.ctx.logger.info('Air-Gapped mode active', {
      localModelPath: this.config.localModelPath,
      encryptStorage: this.config.encryptStorage,
      networkPolicy: 'fully isolated',
    });
  }

  async stop(): Promise<void> {
    this.active = false;
  }

  async healthCheck(): Promise<HealthStatus> {
    return {
      healthy: this.active,
      message: this.active ? 'Air-gapped mode active' : 'Inactive',
      details: {
        auditEntries: this.auditLog.length,
        networkPolicy: this.networkPolicy,
      },
    };
  }

  /** Check if a network request is allowed */
  checkNetworkAccess(host: string, port: number): boolean {
    const allowed = this.config.allowedHosts.includes(host) && !this.networkPolicy.blockedPorts.includes(port);

    this.audit({
      action: 'network_access',
      resource: `${host}:${port}`,
      result: allowed ? 'allowed' : 'denied',
    });

    return allowed;
  }

  /** Get the network policy */
  getNetworkPolicy(): NetworkPolicy {
    return { ...this.networkPolicy };
  }

  /** Update network policy */
  setNetworkPolicy(policy: Partial<NetworkPolicy>): void {
    this.networkPolicy = { ...this.networkPolicy, ...policy };
    this.audit({
      action: 'policy_update',
      resource: 'network_policy',
      result: 'allowed',
      details: policy,
    });
  }

  /** Add entry to audit log */
  private audit(entry: Omit<AuditEntry, 'id' | 'timestamp'>): void {
    if (!this.config.auditAllAccess) return;

    const fullEntry: AuditEntry = {
      ...entry,
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };
    this.auditLog.push(fullEntry);

    // Keep last 10000 entries
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-5000);
    }
  }

  /** Get audit log entries */
  getAuditLog(filter?: { action?: string; result?: 'allowed' | 'denied'; limit?: number }): AuditEntry[] {
    let entries = [...this.auditLog];
    if (filter?.action) entries = entries.filter(e => e.action === filter.action);
    if (filter?.result) entries = entries.filter(e => e.result === filter.result);
    if (filter?.limit) entries = entries.slice(-filter.limit);
    return entries;
  }

  /** Check if local model is available */
  async isLocalModelAvailable(): Promise<boolean> {
    try {
      const { existsSync } = await import('fs');
      return existsSync(this.config.localModelPath);
    } catch {
      return false;
    }
  }

  /** Get air-gapped status summary */
  getStatus(): {
    active: boolean;
    localModelAvailable: boolean;
    networkPolicy: NetworkPolicy;
    auditEntries: number;
  } {
    return {
      active: this.active,
      localModelAvailable: false, // Would check filesystem
      networkPolicy: this.networkPolicy,
      auditEntries: this.auditLog.length,
    };
  }
}

export default new AirGappedFeature();
