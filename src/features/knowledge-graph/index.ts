/**
 * Knowledge Graph Feature
 *
 * Stores and queries knowledge as a graph of entities and relationships.
 * Supports SQLite, Neo4j, and in-memory backends.
 */

import Database from 'better-sqlite3';
import { FeatureModule, FeatureContext, FeatureMeta, HealthStatus } from '../core/plugin-loader';

/** Knowledge Graph configuration */
export interface KnowledgeGraphConfig {
  enabled: boolean;
  backend: 'sqlite' | 'neo4j' | 'memory';
  path: string;
}

/** Graph entity (node) */
export interface Entity {
  id: string;
  type: string;
  name: string;
  properties: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

/** Graph relationship (edge) */
export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  properties: Record<string, unknown>;
  weight: number;
  createdAt: number;
}

/** Query result */
export interface QueryResult {
  entities: Entity[];
  relationships: Relationship[];
  paths?: Entity[][];
}

/** Graph storage backend interface */
interface GraphBackend {
  init(): Promise<void>;
  close(): Promise<void>;
  addEntity(entity: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>): Promise<Entity>;
  getEntity(id: string): Promise<Entity | null>;
  updateEntity(id: string, updates: Partial<Entity>): Promise<Entity>;
  deleteEntity(id: string): Promise<void>;
  addRelationship(rel: Omit<Relationship, 'id' | 'createdAt'>): Promise<Relationship>;
  getRelationships(entityId: string, type?: string): Promise<Relationship[]>;
  findEntities(query: { type?: string; name?: string; properties?: Record<string, unknown> }): Promise<Entity[]>;
  findPaths(sourceId: string, targetId: string, maxDepth?: number): Promise<Entity[][]>;
  getStats(): Promise<{ entities: number; relationships: number }>;
}

/**
 * Knowledge Graph feature — stores knowledge as an entity-relationship graph.
 *
 * Enables the agent to build and query a structured knowledge base
 * with typed entities and weighted relationships.
 */
class KnowledgeGraphFeature implements FeatureModule {
  readonly meta: FeatureMeta = {
    name: 'knowledge-graph',
    version: '0.1.0',
    description: 'Entity-relationship knowledge graph with query support',
    dependencies: [],
  };

  private config: KnowledgeGraphConfig = {
    enabled: false,
    backend: 'sqlite',
    path: './data/knowledge.db',
  };
  private ctx!: FeatureContext;
  private backend: GraphBackend | null = null;

  async init(config: Record<string, unknown>, context: FeatureContext): Promise<void> {
    this.ctx = context;
    this.config = { ...this.config, ...(config as Partial<KnowledgeGraphConfig>) };
  }

  async start(): Promise<void> {
    switch (this.config.backend) {
      case 'sqlite':
        this.backend = new SQLiteGraphBackend(this.config.path);
        break;
      case 'memory':
        this.backend = new MemoryGraphBackend();
        break;
      case 'neo4j':
        throw new Error('Neo4j backend not yet implemented');
      default:
        throw new Error(`Unknown backend: ${this.config.backend}`);
    }

    await this.backend.init();
    this.ctx.logger.info('Knowledge Graph active', { backend: this.config.backend });
  }

  async stop(): Promise<void> {
    await this.backend?.close();
    this.backend = null;
  }

  async healthCheck(): Promise<HealthStatus> {
    if (!this.backend) return { healthy: false, message: 'Not initialized' };
    const stats = await this.backend.getStats();
    return {
      healthy: true,
      details: stats,
    };
  }

  /** Add an entity to the graph */
  async addEntity(type: string, name: string, properties: Record<string, unknown> = {}): Promise<Entity> {
    if (!this.backend) throw new Error('Backend not initialized');
    return this.backend.addEntity({ type, name, properties });
  }

  /** Get entity by ID */
  async getEntity(id: string): Promise<Entity | null> {
    if (!this.backend) throw new Error('Backend not initialized');
    return this.backend.getEntity(id);
  }

  /** Add a relationship between two entities */
  async addRelationship(
    sourceId: string,
    targetId: string,
    type: string,
    properties: Record<string, unknown> = {},
    weight = 1.0
  ): Promise<Relationship> {
    if (!this.backend) throw new Error('Backend not initialized');
    return this.backend.addRelationship({ sourceId, targetId, type, properties, weight });
  }

  /** Find entities matching criteria */
  async findEntities(query: { type?: string; name?: string; properties?: Record<string, unknown> }): Promise<Entity[]> {
    if (!this.backend) throw new Error('Backend not initialized');
    return this.backend.findEntities(query);
  }

  /** Find shortest paths between two entities */
  async findPaths(sourceId: string, targetId: string, maxDepth = 5): Promise<Entity[][]> {
    if (!this.backend) throw new Error('Backend not initialized');
    return this.backend.findPaths(sourceId, targetId, maxDepth);
  }
}

/** SQLite-based graph backend */
class SQLiteGraphBackend implements GraphBackend {
  private db!: Database.Database;

  constructor(private path: string) {}

  async init(): Promise<void> {
    const { mkdirSync } = await import('fs');
    const { dirname } = await import('path');
    mkdirSync(dirname(this.path), { recursive: true });

    this.db = new Database(this.path);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        properties TEXT DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
      CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);

      CREATE TABLE IF NOT EXISTS relationships (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
        target_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        properties TEXT DEFAULT '{}',
        weight REAL DEFAULT 1.0,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_rel_source ON relationships(source_id);
      CREATE INDEX IF NOT EXISTS idx_rel_target ON relationships(target_id);
      CREATE INDEX IF NOT EXISTS idx_rel_type ON relationships(type);
    `);
  }

  async close(): Promise<void> {
    this.db?.close();
  }

  async addEntity(data: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>): Promise<Entity> {
    const id = `ent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    this.db.prepare(
      'INSERT INTO entities (id, type, name, properties, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, data.type, data.name, JSON.stringify(data.properties), now, now);
    return { id, ...data, createdAt: now, updatedAt: now };
  }

  async getEntity(id: string): Promise<Entity | null> {
    const row = this.db.prepare('SELECT * FROM entities WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: row.id as string,
      type: row.type as string,
      name: row.name as string,
      properties: JSON.parse(row.properties as string),
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  }

  async updateEntity(id: string, updates: Partial<Entity>): Promise<Entity> {
    const existing = await this.getEntity(id);
    if (!existing) throw new Error(`Entity not found: ${id}`);

    const now = Date.now();
    const props = updates.properties ?? existing.properties;
    this.db.prepare(
      'UPDATE entities SET name = ?, properties = ?, updated_at = ? WHERE id = ?'
    ).run(updates.name ?? existing.name, JSON.stringify(props), now, id);

    return { ...existing, ...updates, updatedAt: now };
  }

  async deleteEntity(id: string): Promise<void> {
    this.db.prepare('DELETE FROM relationships WHERE source_id = ? OR target_id = ?').run(id, id);
    this.db.prepare('DELETE FROM entities WHERE id = ?').run(id);
  }

  async addRelationship(data: Omit<Relationship, 'id' | 'createdAt'>): Promise<Relationship> {
    const id = `rel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    this.db.prepare(
      'INSERT INTO relationships (id, source_id, target_id, type, properties, weight, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, data.sourceId, data.targetId, data.type, JSON.stringify(data.properties), data.weight, now);
    return { id, ...data, createdAt: now };
  }

  async getRelationships(entityId: string, type?: string): Promise<Relationship[]> {
    let query = 'SELECT * FROM relationships WHERE source_id = ? OR target_id = ?';
    const params: unknown[] = [entityId, entityId];
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    const rows = this.db.prepare(query).all(...params) as Record<string, unknown>[];
    return rows.map(row => ({
      id: row.id as string,
      sourceId: row.source_id as string,
      targetId: row.target_id as string,
      type: row.type as string,
      properties: JSON.parse(row.properties as string),
      weight: row.weight as number,
      createdAt: row.created_at as number,
    }));
  }

  async findEntities(query: { type?: string; name?: string; properties?: Record<string, unknown> }): Promise<Entity[]> {
    let sql = 'SELECT * FROM entities WHERE 1=1';
    const params: unknown[] = [];
    if (query.type) {
      sql += ' AND type = ?';
      params.push(query.type);
    }
    if (query.name) {
      sql += ' AND name LIKE ?';
      params.push(`%${query.name}%`);
    }
    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map(row => ({
      id: row.id as string,
      type: row.type as string,
      name: row.name as string,
      properties: JSON.parse(row.properties as string),
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    }));
  }

  async findPaths(sourceId: string, targetId: string, maxDepth = 5): Promise<Entity[][]> {
    // BFS pathfinding
    const visited = new Set<string>();
    const queue: Array<{ id: string; path: string[] }> = [{ id: sourceId, path: [sourceId] }];
    const paths: Entity[][] = [];

    while (queue.length > 0 && paths.length < 10) {
      const { id, path } = queue.shift()!;
      if (id === targetId) {
        const entities = await Promise.all(path.map(pid => this.getEntity(pid)));
        paths.push(entities.filter((e): e is Entity => e !== null));
        continue;
      }
      if (path.length >= maxDepth) continue;
      if (visited.has(id)) continue;
      visited.add(id);

      const rels = await this.getRelationships(id);
      for (const rel of rels) {
        const nextId = rel.sourceId === id ? rel.targetId : rel.sourceId;
        if (!visited.has(nextId)) {
          queue.push({ id: nextId, path: [...path, nextId] });
        }
      }
    }
    return paths;
  }

  async getStats(): Promise<{ entities: number; relationships: number }> {
    const entities = (this.db.prepare('SELECT COUNT(*) as count FROM entities').get() as { count: number }).count;
    const relationships = (this.db.prepare('SELECT COUNT(*) as count FROM relationships').get() as { count: number }).count;
    return { entities, relationships };
  }
}

/** In-memory graph backend */
class MemoryGraphBackend implements GraphBackend {
  private entities: Map<string, Entity> = new Map();
  private relationships: Map<string, Relationship> = new Map();

  async init(): Promise<void> {}
  async close(): Promise<void> {}

  async addEntity(data: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>): Promise<Entity> {
    const id = `ent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    const entity: Entity = { id, ...data, createdAt: now, updatedAt: now };
    this.entities.set(id, entity);
    return entity;
  }

  async getEntity(id: string): Promise<Entity | null> {
    return this.entities.get(id) ?? null;
  }

  async updateEntity(id: string, updates: Partial<Entity>): Promise<Entity> {
    const existing = this.entities.get(id);
    if (!existing) throw new Error(`Entity not found: ${id}`);
    const updated = { ...existing, ...updates, updatedAt: Date.now() };
    this.entities.set(id, updated);
    return updated;
  }

  async deleteEntity(id: string): Promise<void> {
    this.entities.delete(id);
    for (const [relId, rel] of this.relationships) {
      if (rel.sourceId === id || rel.targetId === id) {
        this.relationships.delete(relId);
      }
    }
  }

  async addRelationship(data: Omit<Relationship, 'id' | 'createdAt'>): Promise<Relationship> {
    const id = `rel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const rel: Relationship = { id, ...data, createdAt: Date.now() };
    this.relationships.set(id, rel);
    return rel;
  }

  async getRelationships(entityId: string, type?: string): Promise<Relationship[]> {
    return Array.from(this.relationships.values()).filter(
      r => (r.sourceId === entityId || r.targetId === entityId) && (!type || r.type === type)
    );
  }

  async findEntities(query: { type?: string; name?: string }): Promise<Entity[]> {
    return Array.from(this.entities.values()).filter(e => {
      if (query.type && e.type !== query.type) return false;
      if (query.name && !e.name.includes(query.name)) return false;
      return true;
    });
  }

  async findPaths(sourceId: string, targetId: string, maxDepth = 5): Promise<Entity[][]> {
    const visited = new Set<string>();
    const queue: Array<{ id: string; path: string[] }> = [{ id: sourceId, path: [sourceId] }];
    const paths: Entity[][] = [];

    while (queue.length > 0 && paths.length < 10) {
      const { id, path } = queue.shift()!;
      if (id === targetId) {
        const entities = path.map(pid => this.entities.get(pid)).filter((e): e is Entity => e !== undefined);
        paths.push(entities);
        continue;
      }
      if (path.length >= maxDepth || visited.has(id)) continue;
      visited.add(id);

      const rels = await this.getRelationships(id);
      for (const rel of rels) {
        const nextId = rel.sourceId === id ? rel.targetId : rel.sourceId;
        if (!visited.has(nextId)) {
          queue.push({ id: nextId, path: [...path, nextId] });
        }
      }
    }
    return paths;
  }

  async getStats(): Promise<{ entities: number; relationships: number }> {
    return { entities: this.entities.size, relationships: this.relationships.size };
  }
}

export default new KnowledgeGraphFeature();
