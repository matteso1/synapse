// Synapse - Real-time Collaborative Whiteboard

import { useState, useEffect } from 'react';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { UserPresence } from './components/UserPresence';
import { useYjs } from './hooks/useYjs';
import { useCanvasStore } from './stores/canvasStore';
import './App.css';

function App() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomInput, setRoomInput] = useState('');


  // Get room from URL or show join screen
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
      setRoomId(room);
    }
  }, []);

  // Generate a short, memorable room code
  const generateRoomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars like 0, O, 1, I
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  };

  const handleJoinRoom = () => {
    const room = roomInput.trim().toUpperCase() || generateRoomCode();
    setRoomId(room);
    window.history.pushState({}, '', `?room=${room}`);
  };

  const handleCreateRoom = () => {
    const room = generateRoomCode();
    setRoomId(room);
    window.history.pushState({}, '', `?room=${room}`);
  };

  const handleLeaveRoom = () => {
    setRoomId(null);
    setRoomInput('');
    // Clear URL
    window.history.pushState({}, '', window.location.pathname);
    // Clear local canvas state
    const store = useCanvasStore.getState();
    store.setObjects(new Map());
    store.clearUsers();
    store.setLocalUserId(null);
  };

  if (!roomId) {
    return <JoinScreen
      roomInput={roomInput}
      setRoomInput={setRoomInput}
      onJoin={handleJoinRoom}
      onCreate={handleCreateRoom}
    />;
  }

  return <WhiteboardRoom roomId={roomId} onLeave={handleLeaveRoom} />;
}

// Join/Create room screen
interface JoinScreenProps {
  roomInput: string;
  setRoomInput: (value: string) => void;
  onJoin: () => void;
  onCreate: () => void;
}

function JoinScreen({ roomInput, setRoomInput, onJoin, onCreate }: JoinScreenProps) {
  return (
    <div className="join-screen">
      <div className="join-container">
        <div className="logo">
          <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
            <circle cx="30" cy="30" r="28" stroke="url(#gradient)" strokeWidth="4" />
            <circle cx="30" cy="30" r="10" fill="url(#gradient)" />
            <defs>
              <linearGradient id="gradient" x1="0" y1="0" x2="60" y2="60">
                <stop stopColor="#4ECDC4" />
                <stop offset="1" stopColor="#556270" />
              </linearGradient>
            </defs>
          </svg>
          <h1>Synapse</h1>
        </div>
        <p className="tagline">Real-time Collaborative Whiteboard</p>

        <div className="join-form">
          <input
            type="text"
            placeholder="Enter room code..."
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onJoin()}
          />
          <div className="button-group">
            <button className="btn-secondary" onClick={onJoin}>
              Join Room
            </button>
            <button className="btn-primary" onClick={onCreate}>
              Create New Room
            </button>
          </div>
        </div>

        <div className="features">
          <div className="feature">
            <span className="feature-icon">🎨</span>
            <span>Freehand Drawing</span>
          </div>
          <div className="feature">
            <span className="feature-icon">👥</span>
            <span>Real-time Cursors</span>
          </div>
          <div className="feature">
            <span className="feature-icon">⚡</span>
            <span>Instant Sync</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main whiteboard room
interface WhiteboardRoomProps {
  roomId: string;
  onLeave: () => void;
}

function WhiteboardRoom({ roomId, onLeave }: WhiteboardRoomProps) {
  const { users } = useCanvasStore();

  // Connect to Yjs
  const {
    isConnected,
    addObject,
    updateObject,
    clearObjects,
    updateCursor
  } = useYjs({
    roomId,
    serverUrl: import.meta.env.VITE_WS_URL || 'ws://localhost:1234'
  });

  const handleClear = () => {
    if (confirm('Clear the entire canvas? This cannot be undone.')) {
      clearObjects();
    }
  };

  return (
    <div className="whiteboard-container">
      <Toolbar
        onClear={handleClear}
        onLeave={onLeave}
        roomId={roomId}
        userCount={users.size}
        isConnected={isConnected}
      />
      <div className="whiteboard-main">
        <Canvas
          addObject={addObject}
          updateObject={updateObject}
          updateCursor={updateCursor}
        />
        <UserPresence />
      </div>
    </div>
  );
}

export default App;
