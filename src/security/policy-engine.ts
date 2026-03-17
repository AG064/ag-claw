/**
 * Policy Engine
 *
 * NemoClaw-inspired policy engine for AG-Claw security.
 * Evaluates actions against a configurable policy set with
 * conditions, quotas, and audit logging.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { parse } from 'yaml';

/** Policy action */
export type PolicyAction = 'allow' | 'deny' | 'audit' | 'rate_limit';

/** Policy condition */
export interface PolicyCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'matches' | 'greater_than' | 'less_than' | 'in';
  value: unknown;
}

/** Policy rule */
export interface PolicyRule {
  id: string;
  name: string;
  description?: string;
  action: PolicyAction;
  conditions: PolicyCondition[];
  priority: number;
  enabled: boolean;
  auditLevel?: 'none' | 'info' | 'warning' | 'error';
}

/** Rate limit configuration */
export interface RateLimit {
  windowMs: number;
  maxRequests: number;
  keyField: string; // Which field to use as rate limit key
}

/** Policy evaluation context */
export interface PolicyContext {
  action: string;
  resource: string;
  user?: string;
  channel?: string;
  feature?: string;
  [key: string]: unknown;
}

/** Evaluation result */
export interface PolicyEvaluation {
  allowed: boolean;
  action: PolicyAction;
  matchedRule?: PolicyRule;
  reason: string;
  shouldAudit: boolean;
}

/** Quota tracking */
interface QuotaEntry {
  key: string;
  count: number;
  windowStart: number;
}

/**
 * Policy Engine — NemoClaw-inspired security policy evaluation.
 *
 * Evaluates actions against a set of rules with conditions.
 * Supports allow/deny, audit logging, rate limiting, and quotas.
 *
 * Inspired by NemoClaw's security layer approach.
 */
export class PolicyEngine {
  private rules: Map<string, PolicyRule> = new Map();
  private rateLimits: Map<string, RateLimit> = new Map();
  private quotas: Map<string, QuotaEntry> = new Map();
  private auditLog: Array<{ timestamp: number; context: PolicyContext; evaluation: PolicyEvaluation }> = [];

  /** Load policies from YAML file */
  loadFromFile(filePath: string): void {
    const fullPath = resolve(filePath);
    if (!existsSync(fullPath)) {
      throw new Error(`Policy file not found: ${fullPath}`);
    }

    const raw = readFileSync(fullPath, 'utf-8');
    const config = parse(raw) as {
      rules?: PolicyRule[];
      rateLimits?: Record<string, RateLimit>;
    };

    if (config.rules) {
      for (const rule of config.rules) {
        this.addRule(rule);
      }
    }

    if (config.rateLimits) {
      for (const [key, limit] of Object.entries(config.rateLimits)) {
        this.rateLimits.set(key, limit);
      }
    }
  }

  /** Add a policy rule */
  addRule(rule: PolicyRule): void {
    this.rules.set(rule.id, rule);
  }

  /** Remove a rule */
  removeRule(id: string): boolean {
    return this.rules.delete(id);
  }

  /** Evaluate a context against all rules */
  evaluate(context: PolicyContext): PolicyEvaluation {
    // Check rate limits first
    if (context.user) {
      for (const [key, limit] of this.rateLimits) {
        const rateResult = this.checkRateLimit(context.user, limit);
        if (!rateResult) {
          return {
            allowed: false,
            action: 'rate_limit',
            reason: `Rate limit exceeded for key: ${key}`,
            shouldAudit: true,
          };
        }
      }
    }

    // Evaluate rules by priority
    const sortedRules = Array.from(this.rules.values())
      .filter(r => r.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (this.evaluateConditions(rule.conditions, context)) {
        const evaluation: PolicyEvaluation = {
          allowed: rule.action === 'allow',
          action: rule.action,
          matchedRule: rule,
          reason: `Matched rule: ${rule.name}`,
          shouldAudit: rule.auditLevel !== 'none',
        };

        if (evaluation.shouldAudit) {
          this.auditLog.push({ timestamp: Date.now(), context, evaluation });
        }

        return evaluation;
      }
    }

    // Default: allow
    return {
      allowed: true,
      action: 'allow',
      reason: 'No matching rule, default allow',
      shouldAudit: false,
    };
  }

  /** Evaluate conditions against context */
  private evaluateConditions(conditions: PolicyCondition[], context: PolicyContext): boolean {
    return conditions.every(cond => {
      const value = context[cond.field];
      switch (cond.operator) {
        case 'equals':
          return value === cond.value;
        case 'not_equals':
          return value !== cond.value;
        case 'contains':
          return typeof value === 'string' && value.includes(cond.value as string);
        case 'matches':
          return typeof value === 'string' && new RegExp(cond.value as string).test(value);
        case 'greater_than':
          return typeof value === 'number' && value > (cond.value as number);
        case 'less_than':
          return typeof value === 'number' && value < (cond.value as number);
        case 'in':
          return Array.isArray(cond.value) && (cond.value as unknown[]).includes(value);
        default:
          return false;
      }
    });
  }

  /** Check rate limit for a key */
  private checkRateLimit(key: string, limit: RateLimit): boolean {
    const now = Date.now();
    const entry = this.quotas.get(key);

    if (!entry || now - entry.windowStart > limit.windowMs) {
      this.quotas.set(key, { key, count: 1, windowStart: now });
      return true;
    }

    entry.count++;
    return entry.count <= limit.maxRequests;
  }

  /** Get audit log */
  getAuditLog(limit = 100): typeof this.auditLog {
    return this.auditLog.slice(-limit);
  }

  /** Clear audit log */
  clearAuditLog(): void {
    this.auditLog = [];
  }

  /** Get all rules */
  getRules(): PolicyRule[] {
    return Array.from(this.rules.values()).sort((a, b) => b.priority - a.priority);
  }

  /** Enable/disable a rule */
  setRuleEnabled(id: string, enabled: boolean): boolean {
    const rule = this.rules.get(id);
    if (!rule) return false;
    rule.enabled = enabled;
    return true;
  }
}
