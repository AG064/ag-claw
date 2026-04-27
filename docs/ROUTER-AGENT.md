# Router Agent — Multi-User Orchestrator

## Overview

Router Agent — это центральный роутер, который принимает ВСЕ сообщения и направляет их нужному агенту.

## Architecture

```
User/Chat → Router → [AGX | [REMOVED] | Home] → Response
```

### Routing Rules

| Sender | Target Agent | Shared Context |
|--------|-------------|----------------|
| AG ([USER1]) | AGX (main) | Home |
| [REMOVED] | [REMOVED] | Home |
| Home Chat | Home Agent | AGX + [REMOVED] |

## Router Logic (Pseudocode)

```
on_message(message):
    sender = message.sender_id
    chat = message.chat_id
    
    if sender == USER1_ID:
        → spawn AGX agent session
    elif sender == USER2_ID:
        → spawn [REMOVED] agent session
    elif chat == HOME_CHAT_ID:
        → spawn Home agent session
    else:
        → AGX (default)
    
    # Agents can access shared Home context
    # But [USER1] and [REMOVED] contexts are isolated
```

## Privacy Model

- **Isolation**: AGX workspace и [REMOVED] workspace — полностью изолированы
- **Shared**: Home workspace доступен обоим
- **Router**: Не хранит память, только роутит

## Implementation in Argentum

Create `src/agents/router/`:
- Simple session spawner
- Reads routing rules from config
- Spawns target agent sessions

## Use Cases

1. **Family Bot** — AG + [REMOVED] + shared Home
2. **Customer Support** — multiple users, one bot per user
3. **Team Bot** — shared team context + private user contexts
