/**
 * SQLite Memory Backend
 *
 * Persistent memory storage using SQLite with WAL mode for
 * concurrent reads and fast writes. Supports full-text search.
 */

import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';

/** Memory entry stored in SQLite */
export interface SQLiteMemoryEntry {
  id: string;
  key: string;
  value: string;
  type: string;
  tags: string;
  metadata: string;
  importance: number;
  created_at: number;
  updated_at: number;
  accessed_at: number;
  access_count: number;
}

/** Query options */
export interface MemoryQuery {
  key?: string;
  type?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'updated_at' | 'accessed_at' | 'importance';
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

/**
 * SQLite-backed memory store with full CRUD and search.
 *
 * Uses WAL journal mode for better concurrency and supports
 * tagging, importance scoring, and access tracking.
 */
export class SQLiteMemory {
  private db!: Database.Database;

  constructor(private dbPath: string = './data/memory.db') {}

  /** Initialize the database and create tables */
  init(): void {
    const fullPath = resolve(this.dbPath);
    if (!existsSync(dirname(fullPath))) {
      mkdirSync(dirname(fullPath), { recursive: true });
    }

    this.db = new Database(fullPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        type TEXT DEFAULT 'text',
        tags TEXT DEFAULT '[]',
        metadata TEXT DEFAULT '{}',
        importance REAL DEFAULT 0.5,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        accessed_at INTEGER NOT NULL,
        access_count INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_memories_key ON memories(key);
      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
      CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC);
      CREATE INDEX IF NOT EXISTS idx_memories_updated ON memories(updated_at DESC);

      -- Virtual table for FTS5 full-text search
      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        key, value, tags,
        content='memories',
        content_rowid='rowid'
      );

      -- Triggers to keep FTS in sync
      CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
        INSERT INTO memories_fts(rowid, key, value, tags)
        VALUES (new.rowid, new.key, new.value, new.tags);
      END;

      CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, key, value, tags)
        VALUES ('delete', old.rowid, old.key, old.value, old.tags);
      END;

      CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, key, value, tags)
        VALUES ('delete', old.rowid, old.key, old.value, old.tags);
        INSERT INTO memories_fts(rowid, key, value, tags)
        VALUES (new.rowid, new.key, new.value, new.tags);
      END;
    `);
  }

  /** Store a memory entry */
  set(key: string, value: string, options: { type?: string; tags?: string[]; metadata?: Record<string, unknown>; importance?: number } = {}): SQLiteMemoryEntry {
    const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    const entry: SQLiteMemoryEntry = {
      id,
      key,
      value,
      type: options.type ?? 'text',
      tags: JSON.stringify(options.tags ?? []),
      metadata: JSON.stringify(options.metadata ?? {}),
      importance: Math.max(0, Math.min(1, options.importance ?? 0.5)),
      created_at: now,
      updated_at: now,
      accessed_at: now,
      access_count: 0,
    };

    this.db.prepare(
      `INSERT INTO memories (id, key, value, type, tags, metadata, importance, created_at, updated_at, accessed_at, access_count)
       VALUES (@id, @key, @value, @type, @tags, @metadata, @importance, @created_at, @updated_at, @accessed_at, @access_count)`
    ).run(entry);

    return entry;
  }

  /** Retrieve a memory by key */
  get(key: string): SQLiteMemoryEntry | null {
    const row = this.db.prepare('SELECT * FROM memories WHERE key = ?').get(key) as SQLiteMemoryEntry | undefined;
    if (row) {
      this.db.prepare('UPDATE memories SET accessed_at = ?, access_count = access_count + 1 WHERE id = ?').run(Date.now(), row.id);
    }
    return row ?? null;
  }

  /** Update an existing memory */
  update(key: string, value: string, options: Partial<{ type: string; tags: string[]; metadata: Record<string, unknown>; importance: number }>): boolean {
    const existing = this.get(key);
    if (!existing) return false;

    const now = Date.now();
    this.db.prepare(
      `UPDATE memories SET value = @value, type = @type, tags = @tags, metadata = @metadata, importance = @importance, updated_at = @updated_at WHERE key = @key`
    ).run({
      key,
      value,
      type: options.type ?? existing.type,
      tags: JSON.stringify(options.tags ?? JSON.parse(existing.tags)),
      metadata: JSON.stringify(options.metadata ?? JSON.parse(existing.metadata)),
      importance: options.importance ?? existing.importance,
      updated_at: now,
    });

    return true;
  }

  /** Delete a memory by key */
  delete(key: string): boolean {
    const result = this.db.prepare('DELETE FROM memories WHERE key = ?').run(key);
    return result.changes > 0;
  }

  /** Query memories with filtering and pagination */
  query(options: MemoryQuery): SQLiteMemoryEntry[] {
    let sql = 'SELECT * FROM memories WHERE 1=1';
    const params: unknown[] = [];

    if (options.key) {
      sql += ' AND key = ?';
      params.push(options.key);
    }
    if (options.type) {
      sql += ' AND type = ?';
      params.push(options.type);
    }

    const sortBy = options.sortBy ?? 'updated_at';
    const sortOrder = options.sortOrder ?? 'desc';
    sql += ` ORDER BY ${sortBy} ${sortOrder}`;

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }
    if (options.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }

    return this.db.prepare(sql).all(...params) as SQLiteMemoryEntry[];
  }

  /** Full-text search */
  search(query: string, limit = 20): SQLiteMemoryEntry[] {
    const rows = this.db.prepare(
      `SELECT m.* FROM memories m
       JOIN memories_fts fts ON m.rowid = fts.rowid
       WHERE memories_fts MATCH ?
       ORDER BY rank
       LIMIT ?`
    ).all(query, limit) as SQLiteMemoryEntry[];
    return rows;
  }

  /** Get total count */
  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM memories').get() as { count: number };
    return row.count;
  }

  /** Clear all memories */
  clear(): void {
    this.db.exec('DELETE FROM memories; DELETE FROM memories_fts;');
  }

  /** Close the database */
  close(): void {
    this.db?.close();
  }
}
