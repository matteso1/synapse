# Synapse

A real-time collaborative whiteboard built with React, TypeScript, and CRDTs. Multiple users can draw together on an infinite canvas with instant synchronization and conflict-free merging.

[Architecture](#architecture) | [Getting Started](#getting-started)

---

## Features

- **Real-time Collaboration** — Multiple users draw simultaneously with instant sync
- **Conflict-Free Replication** — Yjs CRDTs ensure consistent state across all clients
- **Live Cursors** — See other users' cursor positions in real-time
- **Infinite Canvas** — Pan and zoom to explore unlimited drawing space
- **Room-Based Sessions** — Share a 6-character code to invite collaborators

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React 18, TypeScript, Vite | UI and rendering |
| Canvas | HTML5 Canvas API | Hardware-accelerated drawing |
| State | Zustand | Local state management |
| Sync | Yjs + y-websocket | CRDT-based real-time sync |
| Backend | Node.js, WebSocket | Room management and message relay |

---

## Architecture

### System Overview

```mermaid
flowchart TB
    subgraph Clients["Browser Clients"]
        C1["Client 1<br/>Canvas + Yjs Doc"]
        C2["Client 2<br/>Canvas + Yjs Doc"]
        C3["Client N<br/>Canvas + Yjs Doc"]
    end

    subgraph Server["WebSocket Server"]
        WS["Room Manager"]
        SYNC["Yjs Sync Protocol"]
        AWARE["Awareness Protocol"]
    end

    C1 <-->|WebSocket| WS
    C2 <-->|WebSocket| WS
    C3 <-->|WebSocket| WS

    WS --> SYNC
    WS --> AWARE
```

### Data Flow

```mermaid
sequenceDiagram
    participant A as User A
    participant S as Server
    participant B as User B

    A->>S: Draw stroke (Yjs update)
    S->>B: Broadcast update
    B->>B: Apply to local doc
    
    Note over A,B: Both users see the same result<br/>regardless of network latency
    
    B->>S: Draw stroke (Yjs update)
    S->>A: Broadcast update
    A->>A: Apply to local doc
```

### CRDT Conflict Resolution

```mermaid
flowchart LR
    subgraph UserA["User A"]
        A1["Draws circle"]
    end

    subgraph UserB["User B"]
        B1["Draws square"]
    end

    subgraph Merge["CRDT Merge"]
        M["Both shapes<br/>preserved"]
    end

    A1 --> M
    B1 --> M

    M --> Result["Final Canvas:<br/>Circle + Square"]
```

### Component Architecture

```mermaid
flowchart TB
    subgraph Frontend["React Frontend"]
        App["App.tsx"]
        Canvas["Canvas.tsx"]
        Toolbar["Toolbar.tsx"]
        Presence["UserPresence.tsx"]
    end

    subgraph Hooks["Custom Hooks"]
        UseYjs["useYjs()"]
    end

    subgraph State["State Management"]
        Store["Zustand Store"]
        YDoc["Yjs Document"]
    end

    subgraph Render["Rendering"]
        Renderer["Canvas Renderer"]
        Grid["Grid Layer"]
        Objects["Object Layer"]
        Cursors["Cursor Layer"]
    end

    App --> Canvas
    App --> Toolbar
    App --> Presence
    Canvas --> UseYjs
    UseYjs --> Store
    UseYjs --> YDoc
    Canvas --> Renderer
    Renderer --> Grid
    Renderer --> Objects
    Renderer --> Cursors
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Git

### Local Development

```bash
# Clone the repository
git clone https://github.com/matteso1/synapse.git
cd synapse

# Start the WebSocket server
cd ws-server
npm install
npm start

# In a new terminal, start the frontend
cd client
npm install
npm run dev
```

The frontend runs at `http://localhost:5173` and connects to the WebSocket server at `ws://localhost:1234`.

### Usage

1. Open the app and click **Create New Room**
2. Share the 6-character room code with collaborators
3. Draw together in real-time

---

## Project Structure

```
synapse/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Canvas, Toolbar, UserPresence
│   │   ├── hooks/          # useYjs (CRDT integration)
│   │   ├── stores/         # Zustand state
│   │   ├── lib/            # Canvas rendering
│   │   └── types/          # TypeScript definitions
│   └── package.json
│
├── ws-server/              # Node.js WebSocket server
│   ├── server.js           # Yjs sync and room management
│   └── package.json
│
└── server/                 # Rust backend (production)
    ├── src/
    │   ├── main.rs         # Actix-web server
    │   ├── room.rs         # Room management
    │   └── protocol.rs     # Message types
    └── Cargo.toml
```

---

## Deployment

| Component | Platform | URL |
|-----------|----------|-----|
| Frontend | Vercel | synapse.nilsmatteson.com |
| WebSocket | Railway | wss://synapse-ws.up.railway.app |

### Environment Variables

**Frontend (Vercel):**

```
VITE_WS_URL=wss://your-railway-domain.up.railway.app
```

**Backend (Railway):**

```
PORT=8080  # Set automatically by Railway
```

---

## Roadmap

- [x] Freehand drawing
- [x] Real-time cursor sharing
- [x] Yjs CRDT integration
- [x] User presence indicators
- [x] Room-based collaboration
- [ ] Shape tools (rectangle, ellipse, line)
- [ ] Selection and transformation
- [ ] Undo/redo history
- [ ] Export to PNG/SVG

---

## License

MIT
