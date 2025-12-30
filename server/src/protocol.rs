//! Message protocol definitions for client-server communication

use serde::{Deserialize, Serialize};

/// Information about a connected user
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    pub id: String,
    pub name: String,
    pub color: String,
}

/// Cursor position for a user
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CursorPosition {
    pub x: f64,
    pub y: f64,
}

/// Messages sent from client to server
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum ClientMessage {
    /// Update cursor position
    CursorMove { x: f64, y: f64 },
    
    /// Drawing operation (strokes, shapes, etc.)
    Draw { operation: DrawOperation },
    
    /// Request current room state
    SyncRequest,
    
    /// User updated their name
    UpdateName { name: String },
}

/// Drawing operations on the canvas
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "op_type")]
pub enum DrawOperation {
    /// Start a new path
    PathStart {
        id: String,
        x: f64,
        y: f64,
        color: String,
        stroke_width: f64,
    },
    
    /// Add point to current path
    PathPoint {
        id: String,
        x: f64,
        y: f64,
    },
    
    /// Complete a path
    PathEnd {
        id: String,
    },
    
    /// Add a shape
    Shape {
        id: String,
        shape_type: ShapeType,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
        color: String,
        stroke_width: f64,
    },
    
    /// Erase an object
    Erase {
        id: String,
    },
    
    /// Clear entire canvas
    Clear,
}

/// Types of shapes that can be drawn
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ShapeType {
    Rectangle,
    Ellipse,
    Line,
    Arrow,
}

/// Messages sent from server to clients
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum ServerMessage {
    /// A user joined the room
    UserJoined { user: UserInfo },
    
    /// A user left the room
    UserLeft { user_id: String },
    
    /// Cursor position update from another user
    CursorUpdate {
        user_id: String,
        x: f64,
        y: f64,
    },
    
    /// Drawing operation from another user
    DrawUpdate {
        user_id: String,
        operation: DrawOperation,
    },
    
    /// Full room state sync
    RoomState {
        users: Vec<UserInfo>,
        // Canvas state would be included here
    },
    
    /// Yjs binary sync data (for CRDT state)
    YjsSync {
        user_id: String,
        data: Vec<u8>,
    },
    
    /// Error message
    Error { message: String },
}

impl ServerMessage {
    /// Convert a client message to a server broadcast message
    pub fn from_client_message(msg: ClientMessage, user_id: &str) -> Self {
        match msg {
            ClientMessage::CursorMove { x, y } => ServerMessage::CursorUpdate {
                user_id: user_id.to_string(),
                x,
                y,
            },
            ClientMessage::Draw { operation } => ServerMessage::DrawUpdate {
                user_id: user_id.to_string(),
                operation,
            },
            ClientMessage::SyncRequest => ServerMessage::RoomState {
                users: vec![], // Would be populated with actual users
            },
            ClientMessage::UpdateName { name } => ServerMessage::UserJoined {
                user: UserInfo {
                    id: user_id.to_string(),
                    name,
                    color: String::new(), // Would use actual color
                },
            },
        }
    }
}
