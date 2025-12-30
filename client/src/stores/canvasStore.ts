// Canvas state management with Zustand

import { create } from 'zustand';
import type { Tool, Point, AnyCanvasObject, UserPresence } from '../types';

interface CanvasState {
    // Tool state
    tool: Tool;
    color: string;
    strokeWidth: number;

    // Viewport state
    zoom: number;
    panOffset: Point;

    // Canvas objects (local state - synced with Yjs)
    objects: Map<string, AnyCanvasObject>;

    // Selection state
    selectedIds: Set<string>;

    // User presence
    users: Map<string, UserPresence>;
    localUserId: string | null;

    // Actions
    setTool: (tool: Tool) => void;
    setColor: (color: string) => void;
    setStrokeWidth: (width: number) => void;
    setZoom: (zoom: number) => void;
    setPanOffset: (offset: Point) => void;
    addObject: (obj: AnyCanvasObject) => void;
    updateObject: (id: string, updates: Partial<AnyCanvasObject>) => void;
    removeObject: (id: string) => void;
    clearObjects: () => void;
    setObjects: (objects: Map<string, AnyCanvasObject>) => void;
    setSelectedIds: (ids: Set<string>) => void;
    updateUser: (user: UserPresence) => void;
    removeUser: (userId: string) => void;
    setUsers: (users: Map<string, UserPresence>) => void;
    clearUsers: () => void;
    setLocalUserId: (id: string | null) => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
    // Initial state
    tool: 'pen',
    color: '#ffffff',
    strokeWidth: 3,
    zoom: 1,
    panOffset: { x: 0, y: 0 },
    objects: new Map(),
    selectedIds: new Set(),
    users: new Map(),
    localUserId: null,

    // Tool actions
    setTool: (tool) => set({ tool }),
    setColor: (color) => set({ color }),
    setStrokeWidth: (strokeWidth) => set({ strokeWidth }),

    // Viewport actions
    setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(5, zoom)) }),
    setPanOffset: (panOffset) => set({ panOffset }),

    // Object actions
    addObject: (obj) => set((state) => {
        const newObjects = new Map(state.objects);
        newObjects.set(obj.id, obj);
        return { objects: newObjects };
    }),

    updateObject: (id, updates) => set((state) => {
        const obj = state.objects.get(id);
        if (!obj) return state;
        const newObjects = new Map(state.objects);
        newObjects.set(id, { ...obj, ...updates } as AnyCanvasObject);
        return { objects: newObjects };
    }),

    removeObject: (id) => set((state) => {
        const newObjects = new Map(state.objects);
        newObjects.delete(id);
        return { objects: newObjects };
    }),

    clearObjects: () => set({ objects: new Map() }),

    setObjects: (objects) => set({ objects }),

    // Selection actions
    setSelectedIds: (selectedIds) => set({ selectedIds }),

    // User presence actions
    updateUser: (user) => set((state) => {
        const newUsers = new Map(state.users);
        newUsers.set(user.id, user);
        return { users: newUsers };
    }),

    removeUser: (userId) => set((state) => {
        const newUsers = new Map(state.users);
        newUsers.delete(userId);
        return { users: newUsers };
    }),

    setUsers: (users) => set({ users }),

    clearUsers: () => set({ users: new Map() }),

    setLocalUserId: (localUserId) => set({ localUserId }),
}));

// Color palette for the whiteboard
export const COLOR_PALETTE = [
    '#ffffff', // White
    '#f87171', // Red
    '#fb923c', // Orange
    '#fbbf24', // Yellow
    '#a3e635', // Lime
    '#4ade80', // Green
    '#22d3ee', // Cyan
    '#60a5fa', // Blue
    '#a78bfa', // Purple
    '#f472b6', // Pink
];

// Stroke width options
export const STROKE_WIDTHS = [2, 4, 6, 10, 16];
