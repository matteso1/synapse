// Synapse WebSocket Server for Yjs Collaboration
// Uses y-websocket for CRDT synchronization

import { WebSocketServer } from 'ws';
import http from 'http';
import * as Y from 'yjs';

const PORT = process.env.PORT || 1234;

// Store for Yjs documents (in-memory for MVP)
const docs = new Map();

// Get or create a Yjs document for a room
function getYDoc(roomName) {
    if (!docs.has(roomName)) {
        const doc = new Y.Doc();
        docs.set(roomName, {
            doc,
            clients: new Set(),
        });
        console.log(`📄 Created new document for room: ${roomName}`);
    }
    return docs.get(roomName);
}

// Encode state vector
function encodeStateVector(doc) {
    return Y.encodeStateVector(doc);
}

// Encode state as update
function encodeStateAsUpdate(doc, targetStateVector) {
    return Y.encodeStateAsUpdate(doc, targetStateVector);
}

// Apply update to doc
function applyUpdate(doc, update) {
    Y.applyUpdate(doc, update);
}

// Create HTTP server
const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'healthy', rooms: docs.size }));
        return;
    }
    res.writeHead(200);
    res.end('Synapse WebSocket Server');
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Message types for Yjs protocol
const messageSync = 0;
const messageSyncStep1 = 0;
const messageSyncStep2 = 1;
const messageUpdate = 2;
const messageAwareness = 1;

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
    // Extract room name from URL path
    const roomName = req.url?.slice(1) || 'default';
    const room = getYDoc(roomName);
    const { doc, clients } = room;

    console.log(`👤 Client connected to room: ${roomName} (${clients.size + 1} clients)`);
    clients.add(ws);

    // Store room reference on socket
    ws.roomName = roomName;

    // Handle incoming messages
    ws.on('message', (message) => {
        try {
            const data = new Uint8Array(message);
            const messageType = data[0];

            if (messageType === messageSync) {
                const syncMessageType = data[1];

                if (syncMessageType === messageSyncStep1) {
                    // Client is requesting sync - send our state
                    const stateVector = data.slice(2);
                    const update = encodeStateAsUpdate(doc, stateVector);

                    // Send sync step 2
                    const response = new Uint8Array(2 + update.length);
                    response[0] = messageSync;
                    response[1] = messageSyncStep2;
                    response.set(update, 2);

                    ws.send(response);

                    // Also send our state vector so they can sync back
                    const ourStateVector = encodeStateVector(doc);
                    const step1 = new Uint8Array(2 + ourStateVector.length);
                    step1[0] = messageSync;
                    step1[1] = messageSyncStep1;
                    step1.set(ourStateVector, 2);
                    ws.send(step1);

                } else if (syncMessageType === messageSyncStep2) {
                    // Apply sync step 2 (state update from client)
                    const update = data.slice(2);
                    applyUpdate(doc, update);

                } else if (syncMessageType === messageUpdate) {
                    // Apply update and broadcast to other clients
                    const update = data.slice(2);
                    applyUpdate(doc, update);

                    // Broadcast to other clients in the room
                    clients.forEach((client) => {
                        if (client !== ws && client.readyState === 1) {
                            client.send(message);
                        }
                    });
                }
            } else if (messageType === messageAwareness) {
                // Broadcast awareness updates to all other clients
                clients.forEach((client) => {
                    if (client !== ws && client.readyState === 1) {
                        client.send(message);
                    }
                });
            }
        } catch (err) {
            console.error('Error processing message:', err);
        }
    });

    // Handle disconnection
    ws.on('close', () => {
        clients.delete(ws);
        console.log(`👋 Client disconnected from room: ${roomName} (${clients.size} clients remaining)`);

        // Clean up empty rooms after a delay
        if (clients.size === 0) {
            setTimeout(() => {
                if (clients.size === 0) {
                    docs.delete(roomName);
                    console.log(`🗑️ Cleaned up empty room: ${roomName}`);
                }
            }, 30000);
        }
    });

    // Send initial sync step 1 to client
    const stateVector = encodeStateVector(doc);
    const syncStep1 = new Uint8Array(2 + stateVector.length);
    syncStep1[0] = messageSync;
    syncStep1[1] = messageSyncStep1;
    syncStep1.set(stateVector, 2);
    ws.send(syncStep1);
});

// Start server
server.listen(PORT, () => {
    console.log(`🚀 Synapse WebSocket server running on port ${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/health`);
});
