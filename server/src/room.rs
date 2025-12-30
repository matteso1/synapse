//! Room management for collaborative sessions

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use log::info;

use crate::protocol::{ServerMessage, UserInfo};

/// Manages all active rooms and their participants
pub struct RoomManager {
    rooms: Arc<RwLock<HashMap<String, Room>>>,
}

/// A single collaborative room
struct Room {
    /// Broadcast channel for sending messages to all room participants
    tx: broadcast::Sender<ServerMessage>,
    /// Connected users in this room
    users: HashMap<String, UserInfo>,
}

impl Room {
    fn new() -> Self {
        let (tx, _) = broadcast::channel(1000);
        Self {
            tx,
            users: HashMap::new(),
        }
    }
}

impl RoomManager {
    pub fn new() -> Self {
        Self {
            rooms: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    /// Join a room, creating it if it doesn't exist
    /// Returns the broadcast sender and receiver for the room
    pub async fn join_room(
        &self,
        room_id: &str,
        user_id: &str,
    ) -> (broadcast::Sender<ServerMessage>, broadcast::Receiver<ServerMessage>) {
        let mut rooms = self.rooms.write().await;
        
        let room = rooms.entry(room_id.to_string()).or_insert_with(|| {
            info!("Creating new room: {}", room_id);
            Room::new()
        });
        
        // Add user to room
        let user_info = UserInfo {
            id: user_id.to_string(),
            name: format!("User {}", &user_id[..8]),
            color: generate_user_color(user_id),
        };
        room.users.insert(user_id.to_string(), user_info.clone());
        
        // Broadcast user joined
        let _ = room.tx.send(ServerMessage::UserJoined { user: user_info });
        
        let tx = room.tx.clone();
        let rx = room.tx.subscribe();
        
        (tx, rx)
    }
    
    /// Remove a user from a room
    pub async fn leave_room(&self, room_id: &str, user_id: &str) {
        let mut rooms = self.rooms.write().await;
        
        if let Some(room) = rooms.get_mut(room_id) {
            room.users.remove(user_id);
            
            // Broadcast user left
            let _ = room.tx.send(ServerMessage::UserLeft {
                user_id: user_id.to_string(),
            });
            
            // Clean up empty rooms
            if room.users.is_empty() {
                info!("Removing empty room: {}", room_id);
                rooms.remove(room_id);
            }
        }
    }
    
    /// Get all users in a room
    pub async fn get_room_users(&self, room_id: &str) -> Vec<UserInfo> {
        let rooms = self.rooms.read().await;
        rooms
            .get(room_id)
            .map(|r| r.users.values().cloned().collect())
            .unwrap_or_default()
    }
}

/// Generate a consistent color for a user based on their ID
fn generate_user_color(user_id: &str) -> String {
    let colors = [
        "#FF6B6B", // Red
        "#4ECDC4", // Teal
        "#45B7D1", // Blue
        "#96CEB4", // Green
        "#FFEAA7", // Yellow
        "#DDA0DD", // Plum
        "#98D8C8", // Mint
        "#F7DC6F", // Gold
        "#BB8FCE", // Purple
        "#85C1E9", // Sky Blue
    ];
    
    let hash: usize = user_id.bytes().map(|b| b as usize).sum();
    colors[hash % colors.len()].to_string()
}

impl Default for RoomManager {
    fn default() -> Self {
        Self::new()
    }
}
