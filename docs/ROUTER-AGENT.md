# Router Agent — Multi-User Orchestrator

## Overview

Router Agent — это центральный роутер, который принимает ВСЕ сообщения и направляет их нужному агенту.

## Architecture

```
User/Chat → Router → [AGX | Anneka | Home] → Response
```

### Routing Rules

| Sender | Target Agent | Shared Context |
|--------|-------------|----------------|
| AG (Лёша) | AGX (main) | Home |
| Аня | Anneka | Home |
| Home Chat | Home Agent | AGX + Anneka |

## Router Logic (Pseudocode)

```
on_message(message):
    sender = message.sender_id
    chat = message.chat_id
    
    if sender == ЛЁША_ID:
        → spawn AGX agent session
    elif sender == АНЯ_ID:
        → spawn Anneka agent session
    elif chat == HOME_CHAT_ID:
        → spawn Home agent session
    else:
        → AGX (default)
    
    # Agents can access shared Home context
    # But Лёша and Аня contexts are isolated
```

## Privacy Model

- **Isolation**: AGX workspace и Anneka workspace — полностью изолированы
- **Shared**: Home workspace доступен обоим
- **Router**: Не хранит память, только роутит

## Implementation in AG-Claw

Create `src/agents/router/`:
- Simple session spawner
- Reads routing rules from config
- Spawns target agent sessions

## Use Cases

1. **Family Bot** — AG + Аня + shared Home
2. **Customer Support** — multiple users, one bot per user
3. **Team Bot** — shared team context + private user contexts
