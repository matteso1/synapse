// Toolbar component for drawing tools

import { useState } from 'react';
import {
    Pencil,
    Eraser,
    Hand,
    Trash2,
    Users,
    LogOut,
    Copy,
    Check,
    Download,
    Link,
    Undo2,
    Redo2,
    Square,
    Circle,
    Minus,
    ArrowRight,
    Type
} from 'lucide-react';
import { useCanvasStore, COLOR_PALETTE, STROKE_WIDTHS } from '../stores/canvasStore';
import type { Tool } from '../types';

interface ToolbarProps {
    onClear: () => void;
    onLeave: () => void;
    onDownload: () => void;
    onUndo: () => void;
    onRedo: () => void;
    roomId: string;
    userCount: number;
    isConnected: boolean;
}

export function Toolbar({ onClear, onLeave, onDownload, onUndo, onRedo, roomId, userCount, isConnected }: ToolbarProps) {
    const { tool, setTool, color, setColor, strokeWidth, setStrokeWidth, zoom } = useCanvasStore();
    const [copied, setCopied] = useState(false);

    const copyInviteLink = async () => {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const tools: { id: Tool; icon: React.ReactNode; label: string }[] = [
        { id: 'pen', icon: <Pencil size={20} />, label: 'Pen' },
        { id: 'eraser', icon: <Eraser size={20} />, label: 'Eraser' },
        { id: 'rectangle', icon: <Square size={20} />, label: 'Rectangle' },
        { id: 'ellipse', icon: <Circle size={20} />, label: 'Ellipse' },
        { id: 'line', icon: <Minus size={20} />, label: 'Line' },
        { id: 'arrow', icon: <ArrowRight size={20} />, label: 'Arrow' },
        { id: 'text', icon: <Type size={20} />, label: 'Text' },
        { id: 'pan', icon: <Hand size={20} />, label: 'Pan' },
    ];

    return (
        <div className="toolbar">
            {/* Leave Room */}
            <div className="toolbar-section">
                <button className="tool-button leave" onClick={onLeave} title="Leave Room">
                    <LogOut size={20} />
                </button>
            </div>

            {/* Undo/Redo */}
            <div className="toolbar-section">
                <button className="tool-button" onClick={onUndo} title="Undo (Ctrl+Z)">
                    <Undo2 size={20} />
                </button>
                <button className="tool-button" onClick={onRedo} title="Redo (Ctrl+Y)">
                    <Redo2 size={20} />
                </button>
            </div>

            {/* Connection Status & Room Code */}
            <div className="toolbar-section">
                <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
                    <span className="status-dot"></span>
                    <span className="status-text">{isConnected ? 'Connected' : 'Connecting...'}</span>
                </div>
                <div className="room-code" onClick={copyInviteLink} title="Click to copy invite link">
                    <span className="room-label">Room:</span>
                    <span className="room-id">{roomId}</span>
                    {copied ? <Check size={14} className="copy-icon" /> : <Copy size={14} className="copy-icon" />}
                </div>
            </div>

            {/* Tools */}
            <div className="toolbar-section">
                <div className="toolbar-group">
                    {tools.map((t) => (
                        <button
                            key={t.id}
                            className={`tool-button ${tool === t.id ? 'active' : ''}`}
                            onClick={() => setTool(t.id)}
                            title={t.label}
                        >
                            {t.icon}
                        </button>
                    ))}
                </div>
            </div>

            {/* Colors */}
            <div className="toolbar-section">
                <div className="color-palette">
                    {COLOR_PALETTE.map((c) => (
                        <button
                            key={c}
                            className={`color-button ${color === c ? 'active' : ''}`}
                            style={{ backgroundColor: c }}
                            onClick={() => setColor(c)}
                            title={c}
                        />
                    ))}
                </div>
            </div>

            {/* Stroke Width */}
            <div className="toolbar-section">
                <div className="stroke-widths">
                    {STROKE_WIDTHS.map((w) => (
                        <button
                            key={w}
                            className={`stroke-button ${strokeWidth === w ? 'active' : ''}`}
                            onClick={() => setStrokeWidth(w)}
                            title={`${w}px`}
                        >
                            <div
                                className="stroke-preview"
                                style={{ width: w * 2, height: w * 2 }}
                            />
                        </button>
                    ))}
                </div>
            </div>

            {/* Actions */}
            <div className="toolbar-section">
                <button className="tool-button" onClick={onDownload} title="Download as PNG">
                    <Download size={20} />
                </button>
                <button className="tool-button" onClick={copyInviteLink} title="Copy Invite Link">
                    {copied ? <Check size={20} /> : <Link size={20} />}
                </button>
                <button className="tool-button danger" onClick={onClear} title="Clear Canvas">
                    <Trash2 size={20} />
                </button>
            </div>

            {/* Users */}
            <div className="toolbar-section user-section">
                <div className="user-count">
                    <Users size={18} />
                    <span>{userCount}</span>
                </div>
                <div className="zoom-level">
                    {Math.round(zoom * 100)}%
                </div>
            </div>
        </div>
    );
}
