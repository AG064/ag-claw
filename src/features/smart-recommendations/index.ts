/**
 * Smart Recommendations Feature
 *
 * AI-powered recommendation engine that learns from user behavior
 * to suggest content, actions, and optimizations.
 */

import { FeatureModule, FeatureContext, FeatureMeta, HealthStatus } from '../../core/plugin-loader';

/** Smart recommendations configuration */
export interface SmartRecommendationsConfig {
  enabled: boolean;
  maxRecommendations: number;
  minConfidence: number;
  learningRate: number;
  decayFactor: number;
  categories: string[];
}

/** Recommendation */
export interface Recommendation {
  id: string;
  category: string;
  title: string;
  description: string;
  confidence: number;
  reason: string;
  action?: {
    type: string;
    params: Record<string, unknown>;
  };
  metadata: Record<string, unknown>;
  createdAt: number;
  accepted?: boolean;
  feedbackScore?: number;
}

/** User behavior event */
export interface BehaviorEvent {
  type: string;
  category: string;
  value: string;
  timestamp: number;
  context?: Record<string, unknown>;
}

/** Feature preference profile */
interface PreferenceProfile {
  category: string;
  score: number;
  lastUpdated: number;
  eventCount: number;
}

/**
 * Smart Recommendations feature — AI-powered suggestion engine.
 *
 * Learns from user interactions and behavior patterns to provide
 * personalized recommendations for content, actions, and workflows.
 */
class SmartRecommendationsFeature implements FeatureModule {
  readonly meta: FeatureMeta = {
    name: 'smart-recommendations',
    version: '0.1.0',
    description: 'AI-powered recommendation engine with behavior learning',
    dependencies: [],
  };

  private config: SmartRecommendationsConfig = {
    enabled: false,
    maxRecommendations: 10,
    minConfidence: 0.3,
    learningRate: 0.1,
    decayFactor: 0.95,
    categories: ['content', 'action', 'workflow', 'learning'],
  };
  private ctx!: FeatureContext;
  private behaviorHistory: BehaviorEvent[] = [];
  private profiles: Map<string, PreferenceProfile> = new Map();
  private recommendations: Map<string, Recommendation> = new Map();

  async init(config: Record<string, unknown>, context: FeatureContext): Promise<void> {
    this.ctx = context;
    this.config = { ...this.config, ...(config as Partial<SmartRecommendationsConfig>) };
  }

  async start(): Promise<void> {
    this.ctx.logger.info('Smart Recommendations active', {
      categories: this.config.categories,
      maxRecommendations: this.config.maxRecommendations,
    });
  }

  async stop(): Promise<void> {
    this.behaviorHistory = [];
    this.profiles.clear();
    this.recommendations.clear();
  }

  async healthCheck(): Promise<HealthStatus> {
    return {
      healthy: true,
      details: {
        profiles: this.profiles.size,
        behaviorEvents: this.behaviorHistory.length,
        activeRecommendations: this.recommendations.size,
      },
    };
  }

  /** Record a user behavior event */
  recordEvent(event: BehaviorEvent): void {
    this.behaviorHistory.push(event);

    // Update preference profile
    const key = `${event.category}:${event.value}`;
    const existing = this.profiles.get(key);
    if (existing) {
      existing.score = existing.score * (1 - this.config.learningRate) + this.config.learningRate;
      existing.lastUpdated = Date.now();
      existing.eventCount++;
    } else {
      this.profiles.set(key, {
        category: event.category,
        score: this.config.learningRate,
        lastUpdated: Date.now(),
        eventCount: 1,
      });
    }

    // Decay other profiles in same category
    for (const [, profile] of this.profiles) {
      if (profile.category === event.category && profile.lastUpdated < event.timestamp) {
        profile.score *= this.config.decayFactor;
      }
    }

    // Keep history bounded
    if (this.behaviorHistory.length > 10000) {
      this.behaviorHistory = this.behaviorHistory.slice(-5000);
    }
  }

  /** Generate recommendations based on current profiles */
  async generateRecommendations(): Promise<Recommendation[]> {
    const results: Recommendation[] = [];

    // Sort profiles by score
    const sortedProfiles = Array.from(this.profiles.entries())
      .sort((a, b) => b[1].score - a[1].score);

    for (const [key, profile] of sortedProfiles.slice(0, this.config.maxRecommendations)) {
      if (profile.score < this.config.minConfidence) continue;

      const [, value] = key.split(':');
      const rec: Recommendation = {
        id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        category: profile.category,
        title: `Based on your ${profile.category} preferences`,
        description: `You've shown interest in "${value}" (${profile.eventCount} interactions)`,
        confidence: Math.round(profile.score * 100) / 100,
        reason: `${profile.eventCount} related interactions with ${Math.round(profile.score * 100)}% confidence`,
        metadata: { key, eventCount: profile.eventCount },
        createdAt: Date.now(),
      };

      this.recommendations.set(rec.id, rec);
      results.push(rec);
    }

    return results;
  }

  /** Provide feedback on a recommendation */
  provideFeedback(recommendationId: string, accepted: boolean, score?: number): void {
    const rec = this.recommendations.get(recommendationId);
    if (rec) {
      rec.accepted = accepted;
      rec.feedbackScore = score;

      // Update profile based on feedback
      const key = rec.metadata.key as string;
      if (key) {
        const profile = this.profiles.get(key);
        if (profile) {
          const adjustment = accepted ? this.config.learningRate : -this.config.learningRate;
          profile.score = Math.max(0, Math.min(1, profile.score + adjustment));
        }
      }
    }
  }

  /** Get top preference profiles */
  getTopPreferences(limit = 10): Array<{ category: string; value: string; score: number }> {
    return Array.from(this.profiles.entries())
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, limit)
      .map(([key, profile]) => {
        const [, value] = key.split(':');
        return { category: profile.category, value: value ?? '', score: profile.score };
      });
  }
}

export default new SmartRecommendationsFeature();
