# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.2.x   | ✅ Yes |
| < 0.2   | ❌ No |

## Reporting a Vulnerability

Found a security issue? Don't open a public issue. Email `security@agclaw.dev` instead.

Include:
- What you found
- How to reproduce it
- What the impact is

We'll respond within 48 hours.

## Security Architecture

AG-Claw has multiple layers of protection:

### Encryption
- **AES-256-GCM** for stored secrets and profiles
- Master key from environment variable (`AGCLAW_MASTER_KEY`)
- Files stored with `0600` permissions (owner-only)

### Authentication
- API key authentication on webchat and API gateway
- Token-based sessions with configurable expiry
- No plaintext passwords stored (hashed with bcrypt)

### Network
- SSRF protection: blocks requests to internal IPs (10.x, 172.16-31.x, 192.168.x, 127.x, ::1)
- Configurable allowed/blocked host lists
- Air-gapped mode: blocks all outbound requests

### Container Security
- Command whitelist for sandboxed execution
- No shell injection (commands validated before exec)
- Resource limits (timeout, memory)

### Rate Limiting
- Sliding window rate limiter
- Per-key configurable limits
- Automatic cleanup of old entries

### Audit
- Immutable append-only audit log
- Tool call tracing (input + output)
- Decision logging (why, not just what)
- Searchable by timestamp, action, actor

### Input Validation
- SQL injection: all queries use parameterized statements
- Path traversal: file paths resolved and checked against base directory
- ReDoS protection: regex patterns validated and wrapped in try/catch

## Configuration

### Required Environment Variables

```bash
# Master key for encryption (generate with: openssl rand -hex 32)
AGCLAW_MASTER_KEY=your-key-here

# Optional: custom data directory
AGCLAW_WORKDIR=/path/to/data
```

### Recommended Settings

In `agclaw.json`:

```json
{
  "security": {
    "policy": "strict",
    "rateLimiting": true,
    "auditLog": true
  }
}
```

## What We Don't Store

- We don't send your data to external services (except what you configure)
- API keys are encrypted at rest
- No analytics or telemetry by default

## Known Limitations (Alpha)

- Some features (Telegram, Discord) need API keys — see feature docs
- Encrypted secrets require AGCLAW_MASTER_KEY to be set
- Webhook authentication is per-feature, not unified yet

## Dependencies

- `better-sqlite3` — SQLite (local only)
- `jsep` — expression parsing (no network)
- `chokidar` — file watching (local only)
- No telemetry libraries

## Disclosure Policy

We follow responsible disclosure. Fixes are released before public disclosure.
