/**
 * Allowlists & Denylists
 *
 * Controls access to features, channels, and resources through
 * configurable allow/deny lists with pattern matching.
 */

/** Allowlist rule */
export interface AllowlistRule {
  id: string;
  pattern: string;
  type: 'regex' | 'exact' | 'glob' | 'prefix';
  category: 'channel' | 'user' | 'domain' | 'command' | 'feature';
  action: 'allow' | 'deny';
  priority: number;
  description?: string;
  createdAt: number;
}

/** Access check result */
export interface AccessResult {
  allowed: boolean;
  matchedRule?: AllowlistRule;
  reason: string;
}

/**
 * Allowlist/denylist manager for AG-Claw.
 *
 * Controls access through configurable rules with pattern matching.
 * Deny rules always override allow rules regardless of priority.
 */
export class AllowlistManager {
  private rules: Map<string, AllowlistRule> = new Map();
  private strictMode: boolean;

  constructor(strictMode = false) {
    this.strictMode = strictMode;
  }

  /** Add a rule */
  addRule(rule: Omit<AllowlistRule, 'id' | 'createdAt'>): AllowlistRule {
    const full: AllowlistRule = {
      ...rule,
      id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
    };
    this.rules.set(full.id, full);
    return full;
  }

  /** Remove a rule */
  removeRule(id: string): boolean {
    return this.rules.delete(id);
  }

  /** Check if a value is allowed for a given category */
  check(value: string, category: AllowlistRule['category']): AccessResult {
    // Sort by priority (higher = checked first)
    const sorted = Array.from(this.rules.values())
      .filter(r => r.category === category)
      .sort((a, b) => b.priority - a.priority);

    // Deny rules always win
    for (const rule of sorted) {
      if (this.matches(value, rule)) {
        if (rule.action === 'deny') {
          return { allowed: false, matchedRule: rule, reason: `Denied by rule: ${rule.description ?? rule.id}` };
        }
        if (rule.action === 'allow') {
          return { allowed: true, matchedRule: rule, reason: `Allowed by rule: ${rule.description ?? rule.id}` };
        }
      }
    }

    // Default: allow if not strict, deny if strict
    if (this.strictMode) {
      return { allowed: false, reason: `No matching rule in strict mode for: ${value}` };
    }
    return { allowed: true, reason: 'No matching rule, default allow' };
  }

  /** Check if a value matches a rule pattern */
  private matches(value: string, rule: AllowlistRule): boolean {
    switch (rule.type) {
      case 'exact':
        return value === rule.pattern;
      case 'prefix':
        return value.startsWith(rule.pattern);
      case 'glob': {
        const regex = rule.pattern
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.');
        return new RegExp(`^${regex}$`).test(value);
      }
      case 'regex':
        try {
          return new RegExp(rule.pattern).test(value);
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  /** Get all rules for a category */
  getRules(category?: AllowlistRule['category']): AllowlistRule[] {
    return Array.from(this.rules.values())
      .filter(r => !category || r.category === category)
      .sort((a, b) => b.priority - a.priority);
  }

  /** Enable/disable strict mode */
  setStrictMode(strict: boolean): void {
    this.strictMode = strict;
  }

  /** Export rules as JSON */
  export(): string {
    return JSON.stringify(Array.from(this.rules.values()), null, 2);
  }

  /** Import rules from JSON */
  import(json: string): number {
    const rules = JSON.parse(json) as AllowlistRule[];
    let count = 0;
    for (const rule of rules) {
      this.rules.set(rule.id, rule);
      count++;
    }
    return count;
  }
}
