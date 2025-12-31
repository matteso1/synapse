// Synapse WebSocket Server for Yjs Collaboration
// Uses y-protocols for proper CRDT sync

import { WebSocketServer } from 'ws';
import http from 'http';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

const PORT = process.env.PORT || 1234;

// Message types
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

// Store for documents and awareness
const docs = new Map();

class WSSharedDoc extends Y.Doc {
    constructor(name) {
        super({ gc: true });
        this.name = name;
        this.conns = new Map();
        this.awareness = new awarenessProtocol.Awareness(this);

        // Broadcast document updates to all connected clients
        this.on('update', (update, origin) => {
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, MESSAGE_SYNC);
            syncProtocol.writeUpdate(encoder, update);
            const message = encoding.toUint8Array(encoder);

            this.conns.forEach((_, conn) => {
                // Don't send back to the origin connection
                if (conn !== origin && conn.readyState === 1) {
                    conn.send(message);
                }
            });
        });

        this.awareness.on('update', ({ added, updated, removed }, conn) => {
            const changedClients = added.concat(updated, removed);
            if (conn !== null) {
                const connControlledIds = this.conns.get(conn);
                if (connControlledIds !== undefined) {
                    added.forEach(clientId => connControlledIds.add(clientId));
                    removed.forEach(clientId => connControlledIds.delete(clientId));
                }
            }
            // Broadcast awareness update
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
            encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients));
            const message = encoding.toUint8Array(encoder);
            this.conns.forEach((_, c) => {
                if (c.readyState === 1) {
                    c.send(message);
                }
            });
        });
    }
}

function getYDoc(docName) {
    if (!docs.has(docName)) {
        const doc = new WSSharedDoc(docName);
        docs.set(docName, doc);
        console.log(`📄 Created new document for room: ${docName}`);
    }
    return docs.get(docName);
}

function messageListener(conn, doc, message) {
    try {
        const encoder = encoding.createEncoder();
        const decoder = decoding.createDecoder(message);
        const messageType = decoding.readVarUint(decoder);

        switch (messageType) {
            case MESSAGE_SYNC:
                encoding.writeVarUint(encoder, MESSAGE_SYNC);
                syncProtocol.readSyncMessage(decoder, encoder, doc, conn);
                if (encoding.length(encoder) > 1) {
                    conn.send(encoding.toUint8Array(encoder));
                }
                break;
            case MESSAGE_AWARENESS:
                awarenessProtocol.applyAwarenessUpdate(
                    doc.awareness,
                    decoding.readVarUint8Array(decoder),
                    conn
                );
                break;
        }
    } catch (err) {
        console.error('Error processing message:', err.message);
    }
}

function setupConnection(conn, req) {
    const docName = req.url?.slice(1) || 'default';
    const doc = getYDoc(docName);

    doc.conns.set(conn, new Set());

    console.log(`👤 Client connected to room: ${docName} (${doc.conns.size} clients)`);

    conn.on('message', (message) => {
        messageListener(conn, doc, new Uint8Array(message));
    });

    conn.on('close', () => {
        const controlledIds = doc.conns.get(conn);
        doc.conns.delete(conn);

        // Remove awareness states
        if (controlledIds) {
            awarenessProtocol.removeAwarenessStates(doc.awareness, Array.from(controlledIds), null);
        }

        console.log(`👋 Client disconnected from room: ${docName} (${doc.conns.size} clients remaining)`);

        // Clean up empty rooms after delay
        if (doc.conns.size === 0) {
            setTimeout(() => {
                if (doc.conns.size === 0) {
                    docs.delete(docName);
                    console.log(`🗑️ Cleaned up empty room: ${docName}`);
                }
            }, 30000);
        }
    });

    // Send initial sync step 1
    {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        syncProtocol.writeSyncStep1(encoder, doc);
        conn.send(encoding.toUint8Array(encoder));
    }

    // Send awareness states
    const awarenessStates = doc.awareness.getStates();
    if (awarenessStates.size > 0) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
        encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(
            doc.awareness,
            Array.from(awarenessStates.keys())
        ));
        conn.send(encoding.toUint8Array(encoder));
    }
}

// Create HTTP server
const server = http.createServer((req, res) => {
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
    res.end('Synapse WebSocket Server');
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', setupConnection);

// Start server
server.listen(PORT, () => {
    console.log(`🚀 Synapse WebSocket server running on port ${PORT}`);
    console.log(`   Using y-protocols for sync`);
    console.log(`   Health check: http://localhost:${PORT}/health`);
});
