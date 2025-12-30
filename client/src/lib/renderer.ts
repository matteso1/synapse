// Canvas rendering utilities

import type { AnyCanvasObject, PathObject, RectangleObject, EllipseObject, LineObject } from '../types';

export function renderObject(ctx: CanvasRenderingContext2D, obj: AnyCanvasObject) {
    ctx.strokeStyle = obj.color;
    ctx.lineWidth = obj.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (obj.type) {
        case 'path':
            renderPath(ctx, obj as PathObject);
            break;
        case 'rectangle':
            renderRectangle(ctx, obj as RectangleObject);
            break;
        case 'ellipse':
            renderEllipse(ctx, obj as EllipseObject);
            break;
        case 'line':
        case 'arrow':
            renderLine(ctx, obj as LineObject);
            break;
    }
}

function renderPath(ctx: CanvasRenderingContext2D, path: PathObject) {
    if (path.points.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(path.points[0].x, path.points[0].y);

    // Use quadratic curves for smooth lines
    for (let i = 1; i < path.points.length - 1; i++) {
        const xc = (path.points[i].x + path.points[i + 1].x) / 2;
        const yc = (path.points[i].y + path.points[i + 1].y) / 2;
        ctx.quadraticCurveTo(path.points[i].x, path.points[i].y, xc, yc);
    }

    // Last point
    const lastPoint = path.points[path.points.length - 1];
    ctx.lineTo(lastPoint.x, lastPoint.y);

    ctx.stroke();
}

function renderRectangle(ctx: CanvasRenderingContext2D, rect: RectangleObject) {
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.width, rect.height);
    if (rect.fill) {
        ctx.fillStyle = rect.fill;
        ctx.fill();
    }
    ctx.stroke();
}

function renderEllipse(ctx: CanvasRenderingContext2D, ellipse: EllipseObject) {
    ctx.beginPath();
    ctx.ellipse(ellipse.cx, ellipse.cy, Math.abs(ellipse.rx), Math.abs(ellipse.ry), 0, 0, Math.PI * 2);
    if (ellipse.fill) {
        ctx.fillStyle = ellipse.fill;
        ctx.fill();
    }
    ctx.stroke();
}

function renderLine(ctx: CanvasRenderingContext2D, line: LineObject | import('../types').ArrowObject) {
    ctx.beginPath();
    ctx.moveTo(line.x1, line.y1);
    ctx.lineTo(line.x2, line.y2);
    ctx.stroke();

    // Draw arrow head if it's an arrow
    if (line.type === 'arrow') {
        const angle = Math.atan2(line.y2 - line.y1, line.x2 - line.x1);
        const headLength = 15;

        ctx.beginPath();
        ctx.moveTo(line.x2, line.y2);
        ctx.lineTo(
            line.x2 - headLength * Math.cos(angle - Math.PI / 6),
            line.y2 - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(line.x2, line.y2);
        ctx.lineTo(
            line.x2 - headLength * Math.cos(angle + Math.PI / 6),
            line.y2 - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
    }
}

// Render grid background
export function renderGrid(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    zoom: number,
    panOffset: { x: number; y: number }
) {
    const gridSize = 50 * zoom;
    const offsetX = panOffset.x % gridSize;
    const offsetY = panOffset.y % gridSize;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;

    // Vertical lines
    for (let x = offsetX; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }

    // Horizontal lines
    for (let y = offsetY; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
}

// Render all cursors
export function renderCursors(
    ctx: CanvasRenderingContext2D,
    users: Map<string, { id: string; name: string; color: string; cursor?: { x: number; y: number } }>,
    localUserId: string | null,
    zoom: number,
    panOffset: { x: number; y: number }
) {
    users.forEach((user) => {
        // Don't render local user's cursor
        if (user.id === localUserId || !user.cursor) return;

        const x = user.cursor.x * zoom + panOffset.x;
        const y = user.cursor.y * zoom + panOffset.y;

        // Draw cursor
        ctx.fillStyle = user.color;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 12, y + 10);
        ctx.lineTo(x + 5, y + 10);
        ctx.lineTo(x, y + 16);
        ctx.closePath();
        ctx.fill();

        // Draw name label
        ctx.font = '12px Inter, system-ui, sans-serif';
        ctx.fillStyle = user.color;
        const textWidth = ctx.measureText(user.name).width;

        // Background for label
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.roundRect(x + 14, y + 8, textWidth + 8, 20, 4);
        ctx.fill();

        // Text
        ctx.fillStyle = user.color;
        ctx.fillText(user.name, x + 18, y + 22);
    });
}

// Generate unique ID
export function generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}
