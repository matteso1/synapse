// Main Canvas component for collaborative drawing

import { useRef, useEffect, useCallback, useState } from 'react';
import { useCanvasStore } from '../stores/canvasStore';
import { renderObject, renderGrid, renderCursors, generateId } from '../lib/renderer';
import type { Point, PathObject, AnyCanvasObject } from '../types';

interface CanvasProps {
    addObject: (obj: AnyCanvasObject) => void;
    updateObject: (id: string, updates: Partial<AnyCanvasObject>) => void;
    updateCursor: (x: number, y: number) => void;
}

export function Canvas({ addObject, updateObject: _updateObject, updateCursor }: CanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const {
        tool,
        color,
        strokeWidth,
        zoom,
        panOffset,
        objects,
        users,
        localUserId,
        setPanOffset,
        setZoom,
    } = useCanvasStore();

    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPath, setCurrentPath] = useState<PathObject | null>(null);
    const [lastPanPoint, setLastPanPoint] = useState<Point | null>(null);

    // Convert screen coordinates to canvas coordinates
    const screenToCanvas = useCallback((screenX: number, screenY: number): Point => {
        return {
            x: (screenX - panOffset.x) / zoom,
            y: (screenY - panOffset.y) / zoom,
        };
    }, [zoom, panOffset]);

    // Handle canvas resize
    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const resizeObserver = new ResizeObserver(() => {
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
        });

        resizeObserver.observe(container);
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;

        return () => resizeObserver.disconnect();
    }, []);

    // Main render loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationId: number;

        const render = () => {
            // Clear canvas with background color
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Apply zoom and pan transformations
            ctx.save();
            ctx.translate(panOffset.x, panOffset.y);
            ctx.scale(zoom, zoom);

            // Render all objects (including eraser strokes)
            objects.forEach((obj) => {
                renderObject(ctx, obj);
            });

            // Render current drawing path
            if (currentPath) {
                renderObject(ctx, currentPath);
            }

            ctx.restore();

            // Render grid ON TOP of objects so eraser doesn't cover it
            renderGrid(ctx, canvas.width, canvas.height, zoom, panOffset);

            // Render remote cursors (in screen space)
            renderCursors(ctx, users, localUserId, zoom, panOffset);

            animationId = requestAnimationFrame(render);
        };

        render();

        return () => cancelAnimationFrame(animationId);
    }, [objects, currentPath, zoom, panOffset, users, localUserId]);

    // Handle mouse down
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const point = screenToCanvas(screenX, screenY);

        if (tool === 'pan') {
            setLastPanPoint({ x: e.clientX, y: e.clientY });
            return;
        }

        if (tool === 'pen' || tool === 'eraser') {
            setIsDrawing(true);
            const pathId = generateId();
            const newPath: PathObject = {
                id: pathId,
                type: 'path',
                color: tool === 'eraser' ? '#1a1a2e' : color,
                strokeWidth: tool === 'eraser' ? strokeWidth * 3 : strokeWidth,
                createdBy: localUserId || 'unknown',
                createdAt: Date.now(),
                points: [point],
            };
            setCurrentPath(newPath);
        }
    }, [tool, color, strokeWidth, localUserId, screenToCanvas]);

    // Handle mouse move
    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const point = screenToCanvas(screenX, screenY);

        // Update cursor position for other users
        updateCursor(point.x, point.y);

        // Handle panning
        if (lastPanPoint && tool === 'pan') {
            const dx = e.clientX - lastPanPoint.x;
            const dy = e.clientY - lastPanPoint.y;
            setPanOffset({
                x: panOffset.x + dx,
                y: panOffset.y + dy,
            });
            setLastPanPoint({ x: e.clientX, y: e.clientY });
            return;
        }

        // Handle drawing
        if (isDrawing && currentPath) {
            setCurrentPath({
                ...currentPath,
                points: [...currentPath.points, point],
            });
        }
    }, [isDrawing, currentPath, tool, lastPanPoint, panOffset, screenToCanvas, updateCursor, setPanOffset]);

    // Handle mouse up
    const handleMouseUp = useCallback(() => {
        if (tool === 'pan') {
            setLastPanPoint(null);
            return;
        }

        if (isDrawing && currentPath && currentPath.points.length > 1) {
            // Finalize the path and sync to Yjs
            addObject(currentPath);
        }

        setIsDrawing(false);
        setCurrentPath(null);
    }, [isDrawing, currentPath, tool, addObject]);

    // Handle mouse leave
    const handleMouseLeave = useCallback(() => {
        if (isDrawing && currentPath && currentPath.points.length > 1) {
            addObject(currentPath);
        }
        setIsDrawing(false);
        setCurrentPath(null);
        setLastPanPoint(null);
    }, [isDrawing, currentPath, addObject]);

    // Handle wheel zoom
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.1, Math.min(5, zoom * zoomFactor));

        // Zoom toward mouse position
        const scale = newZoom / zoom;
        const newPanOffset = {
            x: mouseX - (mouseX - panOffset.x) * scale,
            y: mouseY - (mouseY - panOffset.y) * scale,
        };

        setZoom(newZoom);
        setPanOffset(newPanOffset);
    }, [zoom, panOffset, setZoom, setPanOffset]);

    return (
        <div
            ref={containerRef}
            className="canvas-container"
            style={{
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                cursor: tool === 'pan' ? 'grab' : 'crosshair',
            }}
        >
            <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onWheel={handleWheel}
                style={{
                    display: 'block',
                    touchAction: 'none',
                }}
            />
        </div>
    );
}
