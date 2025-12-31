// Synapse WebSocket Server for Yjs Collaboration
// Uses official y-websocket utils for proper CRDT sync

import { WebSocketServer } from 'ws';
import http from 'http';
import * as Y from 'yjs';
import { setupWSConnection, docs } from 'y-websocket/bin/utils';

const PORT = process.env.PORT || 1234;

// Create HTTP server for health checks
const server = http.createServer((req, res) => {
    // CORS headers for health checks
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'healthy',
            rooms: docs.size,
            timestamp: new Date().toISOString()
        }));
        return;
    }
    res.writeHead(200);
    res.end('Synapse WebSocket Server - y-websocket');
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
    // Extract room name from URL path (e.g., /ROOM123)
    const roomName = req.url?.slice(1) || 'default';

    console.log(`👤 Client connecting to room: ${roomName}`);

    // Use y-websocket's official connection handler
    // This handles all Yjs sync protocol correctly
    setupWSConnection(ws, req, {
        docName: roomName,
        gc: true // Enable garbage collection
    });

    console.log(`✅ Client connected to room: ${roomName} (${docs.size} total rooms)`);

    ws.on('close', () => {
        console.log(`👋 Client disconnected from room: ${roomName}`);
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`🚀 Synapse WebSocket server running on port ${PORT}`);
    console.log(`   Using y-websocket official protocol`);
    console.log(`   Health check: http://localhost:${PORT}/health`);
});
