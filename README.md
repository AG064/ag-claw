# AG-Claw

**Modular AI Agent Framework built on OpenClaw**

AG-Claw is what happens when you take [OpenClaw](https://github.com/nickarora/openclaw) and decide it needs a plugin system, a real security layer, and support for more than just Telegram. You get a self-hosted AI agent that you can actually customize. Feature by feature, on your terms.

Based on OpenClaw (MIT License).

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   AG-Claw Gateway                    │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Config   │  │ Plugin   │  │ Security Policy   │  │
│  │ Layer    │  │ Loader   │  │ Engine (NemoClaw) │  │
│  └────┬─────┘  └────┬─────┘  └─────────┬─────────┘  │
│       │              │                   │            │
│  ┌────▼──────────────▼───────────────────▼─────────┐ │
│  │              Feature Registry                    │ │
│  ├──────────┬──────────┬───────────┬───────────────┤ │
│  │ Webchat  │  Voice   │ Knowledge │   Browser     │ │
│  │          │ TTS/STT  │  Graph    │   Automation  │ │
│  ├──────────┼──────────┼───────────┼───────────────┤ │
│  │ Webhooks │  Mesh    │  Live     │  Container    │ │
│  │          │ Workflows│  Canvas   │  Sandbox      │ │
│  ├──────────┼──────────┼───────────┼───────────────┤ │
│  │ Morning  │ Evening  │  Smart    │    Group      │ │
│  │ Briefing │  Recap   │ Recom.    │  Management   │ │
│  └──────────┴──────────┴───────────┴───────────────┘ │
│                       │                               │
│  ┌────────────────────▼────────────────────────────┐ │
│  │              Channel Layer                       │ │
│  ├──────────┬──────────────┬───────────────────────┤ │
│  │ Telegram │   Webchat    │   Mobile (Push)       │ │
│  └──────────┴──────────────┴───────────────────────┘ │
│                       │                               │
│  ┌────────────────────▼────────────────────────────┐ │
│  │              Memory Layer                        │ │
│  ├──────────┬──────────────┬───────────────────────┤ │
│  │  SQLite  │  Markdown    │  Supabase / Evolving  │ │
│  └──────────┴──────────────┴───────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## Features

### Communication & Channels
| # | Feature | Status |
|---|---------|--------|
| 1 | Telegram Integration | ✅ Implemented |
| 2 | Webchat (WebSocket) | ✅ Implemented |
| 3 | Mobile Push Notifications | 🔧 In Development |
| 4 | Discord Bot | 🔧 In Development |
| 5 | Slack Integration | 🔧 In Development |
| 6 | Email (IMAP/SMTP) | 🔧 In Development |
| 7 | SMS Gateway | 🔧 In Development |
| 8 | WhatsApp Bridge | 🔧 In Development |

### Voice & Audio
| # | Feature | Status |
|---|---------|--------|
| 9 | Text-to-Speech (TTS) | ✅ Implemented |
| 10 | Speech-to-Text (STT) | ✅ Implemented |
| 11 | Wake Word Detection | 🔧 In Development |
| 12 | Voice Cloning | 🔧 In Development |
| 13 | Podcast Generation | 🔧 In Development |

### Memory & Knowledge
| # | Feature | Status |
|---|---------|--------|
| 14 | SQLite Memory | ✅ Implemented |
| 15 | Markdown Memory | ✅ Implemented |
| 16 | Supabase Memory | ✅ Implemented |
| 17 | Self-Evolving Memory | 🔧 In Development |
| 18 | Knowledge Graph | ✅ Implemented |
| 19 | Multimodal Memory | ✅ Implemented |
| 20 | Semantic Search | 🔧 In Development |
| 21 | Memory Compression | 🔧 In Development |

### Automation & Integration
| # | Feature | Status |
|---|---------|--------|
| 22 | Browser Automation | ✅ Implemented |
| 23 | Webhooks | ✅ Implemented |
| 24 | Mesh Workflows | ✅ Implemented |
| 25 | Container Sandbox | ✅ Implemented |
| 26 | Air-Gapped Mode | ✅ Implemented |
| 27 | Cron Scheduler | 🔧 In Development |
| 28 | API Gateway | 🔧 In Development |
| 29 | File Watcher | 🔧 In Development |

### Daily Intelligence
| # | Feature | Status |
|---|---------|--------|
| 30 | Morning Briefing | ✅ Implemented |
| 31 | Evening Recap | ✅ Implemented |
| 32 | Smart Recommendations | ✅ Implemented |
| 33 | Calendar Integration | 🔧 In Development |
| 34 | Weather Alerts | 🔧 In Development |
| 35 | News Digest | 🔧 In Development |

### Collaboration
| # | Feature | Status |
|---|---------|--------|
| 36 | Group Management | ✅ Implemented |
| 37 | Multi-Agent Coordination | 🔧 In Development |
| 38 | Role-Based Access | 🔧 In Development |
| 39 | Shared Knowledge Base | 🔧 In Development |

### Security (NemoClaw-inspired)
| # | Feature | Status |
|---|---------|--------|
| 40 | Allowlists/Denylists | ✅ Implemented |
| 41 | Encrypted Secrets | ✅ Implemented |
| 42 | Policy Engine | ✅ Implemented |
| 43 | Audit Logging | 🔧 In Development |
| 44 | Rate Limiting | 🔧 In Development |
| 45 | Content Filtering | 🔧 In Development |

### Creative & Multimodal
| # | Feature | Status |
|---|---------|--------|
| 46 | Live Canvas | ✅ Implemented |
| 47 | Image Generation | 🔧 In Development |
| 48 | Video Processing | 🔧 In Development |
| 49 | Document Analysis | 🔧 In Development |
| 50 | Code Execution Sandbox | 🔧 In Development |

### Platform & Deployment
| # | Feature | Status |
|---|---------|--------|
| 51 | Docker Deployment | ✅ Implemented |
| 52 | Auto-Update | 🔧 In Development |
| 53 | Health Monitoring | 🔧 In Development |
| 54 | Mobile Companion App | 🔧 In Development |
| 55 | Plugin Marketplace | 🔧 In Development |

**Total: 55 features. 22 done, 33 on the way.**

## Installation

### Quick Start
```bash
curl -fsSL https://raw.githubusercontent.com/AG064/ag-claw/main/install.sh | bash
```

### Manual
```bash
git clone https://github.com/AG064/ag-claw.git
cd ag-claw
./install.sh
```

### Docker
```bash
docker compose -f docker/docker-compose.yml up -d
```

## Configuration

Everything lives in `config/default.yaml`:

```yaml
server:
  port: 3000
  host: "0.0.0.0"

features:
  webchat:
    enabled: true
    port: 3001
  voice:
    enabled: true
    provider: "elevenlabs"
  knowledge-graph:
    enabled: true
    backend: "sqlite"

security:
  policy: "config/security-policy.yaml"
  secrets: "encrypted"

memory:
  primary: "sqlite"
  path: "./data/memory.db"
```

## Project Structure

```
ag-claw/
├── src/
│   ├── index.ts              # Entry point
│   ├── core/                 # Core framework
│   │   ├── config.ts         # Configuration loader
│   │   ├── logger.ts         # Structured logging
│   │   └── plugin-loader.ts  # Dynamic feature loading
│   ├── features/             # Modular features
│   ├── channels/             # Communication channels
│   ├── memory/               # Storage backends
│   └── security/             # Security layer
├── config/                   # YAML configuration
├── docker/                   # Docker deployment
├── docs/                     # Documentation
├── mobile/                   # Mobile app plans
└── skills/                   # Custom skills
```

## Development

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build
npm run build

# Start production
npm start
```

## License

MIT License - see [LICENSE](./LICENSE) for details.

Based on [OpenClaw](https://github.com/nickarora/openclaw) (MIT).
