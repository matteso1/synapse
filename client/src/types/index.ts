// Canvas object types and interfaces

export interface Point {
    x: number;
    y: number;
}

export interface CanvasObject {
    id: string;
    type: 'path' | 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'text';
    color: string;
    strokeWidth: number;
    createdBy: string;
    createdAt: number;
}

export interface PathObject extends CanvasObject {
    type: 'path';
    points: Point[];
}

export interface RectangleObject extends CanvasObject {
    type: 'rectangle';
    x: number;
    y: number;
    width: number;
    height: number;
    fill?: string;
}

export interface EllipseObject extends CanvasObject {
    type: 'ellipse';
    cx: number;
    cy: number;
    rx: number;
    ry: number;
    fill?: string;
}

export interface LineObject extends CanvasObject {
    type: 'line';
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

export interface ArrowObject extends CanvasObject {
    type: 'arrow';
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

export interface TextObject extends CanvasObject {
    type: 'text';
    x: number;
    y: number;
    content: string;
    fontSize: number;
}

export type AnyCanvasObject = PathObject | RectangleObject | EllipseObject | LineObject | ArrowObject | TextObject;

// User presence types
export interface UserPresence {
    id: string;
    name: string;
    color: string;
    cursor?: Point;
    isDrawing?: boolean;
}

// Tool types
export type Tool = 'pen' | 'eraser' | 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'text' | 'select' | 'pan';

// WebSocket message types
export interface CursorMoveMessage {
    type: 'CursorMove';
    payload: { x: number; y: number };
}

export interface DrawMessage {
    type: 'Draw';
    payload: { operation: DrawOperation };
}

export type ClientMessage = CursorMoveMessage | DrawMessage;

export interface DrawOperation {
    op_type: 'PathStart' | 'PathPoint' | 'PathEnd' | 'Shape' | 'Erase' | 'Clear';
    [key: string]: any;
}

// Server message types
export interface UserJoinedMessage {
    type: 'UserJoined';
    payload: { user: UserPresence };
}

export interface UserLeftMessage {
    type: 'UserLeft';
    payload: { user_id: string };
}

export interface CursorUpdateMessage {
    type: 'CursorUpdate';
    payload: { user_id: string; x: number; y: number };
}

export interface DrawUpdateMessage {
    type: 'DrawUpdate';
    payload: { user_id: string; operation: DrawOperation };
}

export type ServerMessage = UserJoinedMessage | UserLeftMessage | CursorUpdateMessage | DrawUpdateMessage;
