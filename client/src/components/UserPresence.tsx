// User presence panel showing connected users

import { useCanvasStore } from '../stores/canvasStore';

export function UserPresence() {
    const { users, localUserId } = useCanvasStore();

    const sortedUsers = Array.from(users.values()).sort((a, b) => {
        // Local user first
        if (a.id === localUserId) return -1;
        if (b.id === localUserId) return 1;
        return a.name.localeCompare(b.name);
    });

    return (
        <div className="user-presence">
            <h3 className="presence-title">Users ({users.size})</h3>
            <div className="user-list">
                {sortedUsers.map((user) => (
                    <div
                        key={user.id}
                        className={`user-item ${user.id === localUserId ? 'local' : ''}`}
                    >
                        <div
                            className="user-avatar"
                            style={{ backgroundColor: user.color }}
                        >
                            {user.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="user-name">
                            {user.name}
                            {user.id === localUserId && ' (You)'}
                        </span>
                        {user.isDrawing && (
                            <span className="drawing-indicator">✏️</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
