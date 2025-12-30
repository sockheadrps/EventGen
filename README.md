![Video Title](demo_preview.gif)

API design can be difficult, but intentionally defining a clear and complete representation of an Event Driven Architecture prior to beginning implementation—when possible—has very clear benefits. Having definition organization and feature completeness at least defined allows the focus to shift from communication complexity to solving logical problems or implementing features.

This tool provides a way to define events and fields, along with a type interface for field types. Protocols designed in the GUI can output YAML, and you can also populate the protocol in the GUI by loading your own  YAML. This tool is for generating type-safe Event Driven Python code and JavaScript as a module with identical type representations built from a single source of defined types.




## Quick Start

### 1. Run the Web Builder

```bash
pip install -r server/requirements.txt
python server/main.py
```

Open **http://localhost:8000**.

### 2. Define Your Protocol

1. Add **Types** (enums like `RoomId`, `MessageType`)
2. Define **Features** (groups of related events, e.g. `Chat`, `Game`)
3. Each feature has **Client Events** (client → server) and **Server Events** (server → client)

### 3. Generate & Download

1. Click **Generate Code**
2. Review the output
3. **Download** what you need (server, client, webclient, or all)
4. Extract and edit—it's your code now

---

## Using the Generated Code

The ZIP file contains:

```text
wsprot_export/
├── server/               # Python Server
│   ├── models.py         # Pydantic message classes
│   ├── events.py         # Event dispatcher & decorators
│   ├── handlers.py       # Handler stubs (edit this!)
│   └── ...
├── client/               # Python Client
│   ├── models.py
│   ├── events.py
│   ├── handlers.py       # Handler stubs (edit this!)
│   └── ...
├── webclient/            # JavaScript Client
│   ├── client.js
│   └── ...
└── protocol.yaml         # Original definition
```

### Python Server (Generic)

The generated code is framework-agnostic. You just need to feed data to the dispatcher:

```python
# main.py
import asyncio
from server.handlers import ChatHandler
from server.events import ClientDispatcher, Events
from server.models import JoinRoom

class MyHandler(ChatHandler):
    # 1. Access your transport (e.g. WebSocket, Queue, etc)
    def __init__(self, transport):
        self.transport = transport

    # 2. Implement handlers
    @on_event(Events.Chat.JOIN_ROOM)
    async def chat_join_room(self, message: JoinRoom):
        print(f"User joining room: {message.room_id}")
        # Reply using your transport
        await self.transport.send({
            "type": Events.Chat.ROOM_JOINED,
            "room_id": message.room_id
        })

# 3. dispatch messages from anywhere
async def main():
    # ... setup your connection ...
    handler = MyHandler(transport)
    dispatcher = ClientDispatcher(handler)

    # When you receive data (str/bytes/dict):
    await dispatcher(incoming_data)
```

### JavaScript Client

The JS client is transport-agnostic—pass any transport with `send()` and `onMessage()`:

```javascript
import { Client, Events, createWebSocketTransport } from './client.js';

// WebSocket example
const ws = new WebSocket('ws://localhost:8000/ws');
const transport = createWebSocketTransport(ws);
const client = new Client(transport);

// Listen for events
client.on(Events.Chat.MESSAGE_RECEIVED, (msg) => {
    console.log(`${msg.sender}: ${msg.content}`);
});

// Send events
ws.onopen = () => {
    client.sendChatJoinRoom('general');
};
```

Works with any JSON transport (message queues, postMessage, etc.):



1. **Design** your protocol in the visual builder (or build your own YAML)
2. **Generate** starter code once
3. **Edit** the generated code directly—it's now your code
4. **Build** your application


## Requirements

- Python 3.8+
`pydantic`, `pyyaml`
