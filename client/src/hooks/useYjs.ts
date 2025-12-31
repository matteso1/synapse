// Yjs integration hook for collaborative state sync

import { useEffect, useRef, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import type { AnyCanvasObject, UserPresence } from '../types';
import { useCanvasStore } from '../stores/canvasStore';

interface UseYjsOptions {
    roomId: string;
    userName?: string;
    serverUrl?: string;
}

export function useYjs({ roomId, userName, serverUrl = 'ws://localhost:1234' }: UseYjsOptions) {
    const [isConnected, setIsConnected] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

    const ydocRef = useRef<Y.Doc | null>(null);
    const providerRef = useRef<WebsocketProvider | null>(null);
    const objectsMapRef = useRef<Y.Map<any> | null>(null);
    const undoManagerRef = useRef<Y.UndoManager | null>(null);

    const { setObjects, setUsers, setLocalUserId } = useCanvasStore();

    useEffect(() => {
        // Create Yjs document
        const ydoc = new Y.Doc();
        ydocRef.current = ydoc;

        // Create shared objects map
        const objectsMap = ydoc.getMap('objects');
        objectsMapRef.current = objectsMap;

        // Create UndoManager to track changes
        const undoManager = new Y.UndoManager(objectsMap);
        undoManagerRef.current = undoManager;

        // Connect to WebSocket server
        const provider = new WebsocketProvider(
            serverUrl,
            roomId,
            ydoc,
            { connect: true }
        );
        providerRef.current = provider;

        // Set local user ID
        const localUserId = ydoc.clientID.toString();
        setLocalUserId(localUserId);

        // Generate random user color
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
        const userColor = colors[Math.floor(Math.random() * colors.length)];

        // Set awareness (user presence)
        const displayName = userName || `User ${localUserId.slice(-4)}`;
        provider.awareness.setLocalStateField('user', {
            id: localUserId,
            name: displayName,
            color: userColor,
            cursor: null,
        });

        // Handle connection status - y-websocket uses 'sync' event when fully connected
        provider.on('status', (event: { status: string }) => {
            console.log('WebSocket status:', event.status);
            if (event.status === 'connected') {
                setIsConnected(true);
                setConnectionStatus('connected');
            } else if (event.status === 'disconnected') {
                setIsConnected(false);
                setConnectionStatus('disconnected');
            }
        });

        // Also check sync status
        provider.on('sync', (synced: boolean) => {
            console.log('Yjs synced:', synced);
            if (synced) {
                setIsConnected(true);
                setConnectionStatus('connected');
            }
        });

        // Sync objects from Yjs to local state
        const syncObjects = () => {
            const newObjects = new Map<string, AnyCanvasObject>();
            objectsMap.forEach((value, key) => {
                newObjects.set(key, value as AnyCanvasObject);
            });
            setObjects(newObjects);
        };

        // Observe changes to objects map
        objectsMap.observe(syncObjects);

        // Initial sync
        syncObjects();

        // Handle awareness changes (user presence) - completely replace user list
        const handleAwarenessChange = () => {
            const states = provider.awareness.getStates();
            const newUsers = new Map<string, UserPresence>();

            states.forEach((state, _clientId) => {
                if (state.user) {
                    // Use user.id as key to deduplicate
                    newUsers.set(state.user.id, state.user as UserPresence);
                }
            });

            // Completely replace the users map
            setUsers(newUsers);
        };

        provider.awareness.on('change', handleAwarenessChange);
        // Initial awareness sync
        handleAwarenessChange();

        // Cleanup
        return () => {
            provider.awareness.off('change', handleAwarenessChange);
            undoManager.destroy();
            provider.disconnect();
            ydoc.destroy();
        };
    }, [roomId, serverUrl, setObjects, setUsers, setLocalUserId]);

    // Function to add an object to Yjs
    const addObject = (obj: AnyCanvasObject) => {
        if (objectsMapRef.current) {
            objectsMapRef.current.set(obj.id, obj);
        }
    };

    // Function to update an object in Yjs
    const updateObject = (id: string, updates: Partial<AnyCanvasObject>) => {
        if (objectsMapRef.current) {
            const existing = objectsMapRef.current.get(id);
            if (existing) {
                objectsMapRef.current.set(id, { ...existing, ...updates });
            }
        }
    };

    // Function to remove an object from Yjs
    const removeObject = (id: string) => {
        if (objectsMapRef.current) {
            objectsMapRef.current.delete(id);
        }
    };

    // Function to clear all objects
    const clearObjects = () => {
        if (objectsMapRef.current) {
            objectsMapRef.current.clear();
        }
    };

    // Function to update cursor position in awareness
    const updateCursor = (x: number, y: number) => {
        if (providerRef.current) {
            const currentState = providerRef.current.awareness.getLocalState();
            if (currentState?.user) {
                providerRef.current.awareness.setLocalStateField('user', {
                    ...currentState.user,
                    cursor: { x, y },
                });
            }
        }
    };

    // Undo last action
    const undo = useCallback(() => {
        if (undoManagerRef.current) {
            undoManagerRef.current.undo();
        }
    }, []);

    // Redo last undone action
    const redo = useCallback(() => {
        if (undoManagerRef.current) {
            undoManagerRef.current.redo();
        }
    }, []);

    return {
        isConnected,
        connectionStatus,
        addObject,
        updateObject,
        removeObject,
        clearObjects,
        updateCursor,
        undo,
        redo,
        ydoc: ydocRef.current,
        provider: providerRef.current,
    };
}
