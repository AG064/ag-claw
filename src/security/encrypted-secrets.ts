/**
 * Encrypted Secrets
 *
 * Manages sensitive configuration values with AES-256-GCM encryption.
 * Stores encrypted secrets in a local file with key derivation from passphrase.
 */

import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync, createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';

/** Encrypted secret entry */
export interface EncryptedSecret {
  id: string;
  key: string;
  iv: string;
  salt: string;
  ciphertext: string;
  tag: string; // GCM auth tag
  createdAt: number;
  updatedAt: number;
}

/** Secrets vault file format */
interface SecretsVault {
  version: number;
  secrets: EncryptedSecret[];
}

/**
 * Encrypted secrets manager with AES-256-GCM.
 *
 * Derives encryption key from a passphrase using PBKDF2.
 * Each secret is encrypted with a unique IV and salt.
 *
 * Usage:
 * ```ts
 * const secrets = new EncryptedSecrets();
 * secrets.init('my-passphrase');
 * secrets.set('api_key', 'sk-123456');
 * const key = secrets.get('api_key');
 * ```
 */
export class EncryptedSecrets {
  private secrets: Map<string, EncryptedSecret> = new Map();
  private masterKey: Buffer | null = null;
  private storePath: string;

  constructor(storePath: string = './data/secrets.enc') {
    this.storePath = resolve(storePath);
  }

  /** Initialize with a passphrase */
  init(passphrase: string): void {
    // Derive a stable master key from the passphrase
    const salt = this.getStableSalt();
    this.masterKey = pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');

    // Load existing secrets
    if (existsSync(this.storePath)) {
      this.load();
    }
  }

  /** Get a stable salt (hash of the store path) */
  private getStableSalt(): Buffer {
    return createHash('sha256').update(this.storePath).digest();
  }

  /** Encrypt a value */
  private encrypt(plaintext: string): { iv: string; salt: string; ciphertext: string; tag: string } {
    if (!this.masterKey) throw new Error('Secrets not initialized. Call init() first.');

    const iv = randomBytes(16);
    const salt = randomBytes(16);
    const key = pbkdf2Sync(this.masterKey, salt, 10000, 32, 'sha256');

    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      iv: iv.toString('hex'),
      salt: salt.toString('hex'),
      ciphertext: encrypted.toString('hex'),
      tag: tag.toString('hex'),
    };
  }

  /** Decrypt a value */
  private decrypt(iv: string, salt: string, ciphertext: string, tag: string): string {
    if (!this.masterKey) throw new Error('Secrets not initialized. Call init() first.');

    const key = pbkdf2Sync(
      this.masterKey,
      Buffer.from(salt, 'hex'),
      10000,
      32,
      'sha256'
    );

    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'hex')),
      decipher.final(),
    ]);

    return decrypted.toString('utf-8');
  }

  /** Store a secret */
  set(key: string, value: string): void {
    const now = Date.now();
    const encrypted = this.encrypt(value);

    const existing = this.secrets.get(key);
    const secret: EncryptedSecret = {
      id: existing?.id ?? `sec_${key}`,
      key,
      ...encrypted,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.secrets.set(key, secret);
    this.save();
  }

  /** Retrieve a decrypted secret */
  get(key: string): string | null {
    const secret = this.secrets.get(key);
    if (!secret) return null;

    try {
      return this.decrypt(secret.iv, secret.salt, secret.ciphertext, secret.tag);
    } catch {
      return null;
    }
  }

  /** Check if a secret exists */
  has(key: string): boolean {
    return this.secrets.has(key);
  }

  /** Delete a secret */
  delete(key: string): boolean {
    const result = this.secrets.delete(key);
    if (result) this.save();
    return result;
  }

  /** List all secret keys (not values) */
  listKeys(): string[] {
    return Array.from(this.secrets.keys());
  }

  /** Save encrypted secrets to file */
  private save(): void {
    if (!this.masterKey) return;

    const dir = dirname(this.storePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const vault: SecretsVault = {
      version: 1,
      secrets: Array.from(this.secrets.values()),
    };

    writeFileSync(this.storePath, JSON.stringify(vault, null, 2), 'utf-8');
  }

  /** Load encrypted secrets from file */
  private load(): void {
    try {
      const raw = readFileSync(this.storePath, 'utf-8');
      const vault: SecretsVault = JSON.parse(raw);

      if (vault.secrets) {
        for (const secret of vault.secrets) {
          this.secrets.set(secret.key, secret);
        }
      }
    } catch {
      // File doesn't exist or is corrupt — start fresh
    }
  }

  /** Clear all secrets from memory and storage */
  clear(): void {
    this.secrets.clear();
    this.masterKey = null;
    this.save();
  }
}
