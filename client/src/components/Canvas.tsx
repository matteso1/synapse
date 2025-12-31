// Main Canvas component for collaborative drawing

import { useRef, useEffect, useCallback, useState } from 'react';
import { useCanvasStore } from '../stores/canvasStore';
import { renderObject, renderGrid, renderCursors, generateId } from '../lib/renderer';
import type { Point, PathObject, AnyCanvasObject, RectangleObject, EllipseObject, LineObject, ArrowObject, TextObject } from '../types';

interface CanvasProps {
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    addObject: (obj: AnyCanvasObject) => void;
    updateObject: (id: string, updates: Partial<AnyCanvasObject>) => void;
    updateCursor: (x: number, y: number) => void;
}

export function Canvas({ canvasRef, addObject, updateObject: _updateObject, updateCursor }: CanvasProps) {
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
    const [currentShape, setCurrentShape] = useState<AnyCanvasObject | null>(null);
    const [shapeStart, setShapeStart] = useState<Point | null>(null);
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

            // Render current shape preview
            if (currentShape) {
                renderObject(ctx, currentShape);
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
    }, [objects, currentPath, currentShape, zoom, panOffset, users, localUserId]);

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

        // Shape tools
        if (['rectangle', 'ellipse', 'line', 'arrow'].includes(tool)) {
            setIsDrawing(true);
            setShapeStart(point);
        }

        // Text tool - prompt for text content
        if (tool === 'text') {
            const text = window.prompt('Enter text:');
            if (text && text.trim()) {
                const textObj: TextObject = {
                    id: generateId(),
                    type: 'text',
                    x: point.x,
                    y: point.y,
                    content: text.trim(),
                    fontSize: 20,
                    color,
                    strokeWidth: 1,
                    createdBy: localUserId || 'unknown',
                    createdAt: Date.now(),
                };
                addObject(textObj);
            }
        }
    }, [tool, color, strokeWidth, localUserId, screenToCanvas, addObject]);

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

        // Handle shape preview
        if (isDrawing && shapeStart && ['rectangle', 'ellipse', 'line', 'arrow'].includes(tool)) {
            const shapeId = 'preview';
            const baseShape = {
                id: shapeId,
                color,
                strokeWidth,
                createdBy: localUserId || 'unknown',
                createdAt: Date.now(),
            };

            if (tool === 'rectangle') {
                const newShape: RectangleObject = {
                    ...baseShape,
                    type: 'rectangle',
                    x: Math.min(shapeStart.x, point.x),
                    y: Math.min(shapeStart.y, point.y),
                    width: Math.abs(point.x - shapeStart.x),
                    height: Math.abs(point.y - shapeStart.y),
                };
                setCurrentShape(newShape);
            } else if (tool === 'ellipse') {
                const newShape: EllipseObject = {
                    ...baseShape,
                    type: 'ellipse',
                    cx: (shapeStart.x + point.x) / 2,
                    cy: (shapeStart.y + point.y) / 2,
                    rx: Math.abs(point.x - shapeStart.x) / 2,
                    ry: Math.abs(point.y - shapeStart.y) / 2,
                };
                setCurrentShape(newShape);
            } else if (tool === 'line') {
                const newShape: LineObject = {
                    ...baseShape,
                    type: 'line',
                    x1: shapeStart.x,
                    y1: shapeStart.y,
                    x2: point.x,
                    y2: point.y,
                };
                setCurrentShape(newShape);
            } else if (tool === 'arrow') {
                const newShape: ArrowObject = {
                    ...baseShape,
                    type: 'arrow',
                    x1: shapeStart.x,
                    y1: shapeStart.y,
                    x2: point.x,
                    y2: point.y,
                };
                setCurrentShape(newShape);
            }
        }
    }, [isDrawing, currentPath, tool, lastPanPoint, panOffset, screenToCanvas, updateCursor, setPanOffset, shapeStart, color, strokeWidth, localUserId]);

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

        // Finalize shape
        if (isDrawing && currentShape && currentShape.id !== 'preview') {
            addObject(currentShape);
        } else if (isDrawing && currentShape) {
            // Create final shape with real ID
            const finalShape = { ...currentShape, id: generateId() };
            addObject(finalShape);
        }

        setIsDrawing(false);
        setCurrentPath(null);
        setCurrentShape(null);
        setShapeStart(null);
    }, [isDrawing, currentPath, currentShape, tool, addObject]);

    // Handle mouse leave
    const handleMouseLeave = useCallback(() => {
        if (isDrawing && currentPath && currentPath.points.length > 1) {
            addObject(currentPath);
        }
        if (isDrawing && currentShape) {
            const finalShape = { ...currentShape, id: generateId() };
            addObject(finalShape);
        }
        setIsDrawing(false);
        setCurrentPath(null);
        setCurrentShape(null);
        setShapeStart(null);
        setLastPanPoint(null);
    }, [isDrawing, currentPath, currentShape, addObject]);

    // Touch event handlers for mobile support
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const screenX = touch.clientX - rect.left;
        const screenY = touch.clientY - rect.top;
        const point = screenToCanvas(screenX, screenY);

        if (tool === 'pan') {
            setLastPanPoint({ x: touch.clientX, y: touch.clientY });
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

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (e.touches.length !== 1) return;
        e.preventDefault(); // Prevent scrolling
        const touch = e.touches[0];
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const screenX = touch.clientX - rect.left;
        const screenY = touch.clientY - rect.top;
        const point = screenToCanvas(screenX, screenY);

        // Update cursor position
        updateCursor(point.x, point.y);

        // Handle panning
        if (lastPanPoint && tool === 'pan') {
            const dx = touch.clientX - lastPanPoint.x;
            const dy = touch.clientY - lastPanPoint.y;
            setPanOffset({
                x: panOffset.x + dx,
                y: panOffset.y + dy,
            });
            setLastPanPoint({ x: touch.clientX, y: touch.clientY });
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

    const handleTouchEnd = useCallback(() => {
        if (tool === 'pan') {
            setLastPanPoint(null);
            return;
        }

        if (isDrawing && currentPath && currentPath.points.length > 1) {
            addObject(currentPath);
        }

        setIsDrawing(false);
        setCurrentPath(null);
    }, [isDrawing, currentPath, tool, addObject]);

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
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onWheel={handleWheel}
                style={{
                    display: 'block',
                    touchAction: 'none',
                }}
            />
        </div>
    );
}
