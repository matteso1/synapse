//! Synapse WebSocket Server
//! High-performance collaborative whiteboard backend built with Actix-web

use actix_cors::Cors;
use actix_web::{web, App, HttpRequest, HttpResponse, HttpServer};
use actix_ws::Message;
use futures_util::StreamExt;
use log::info;
use uuid::Uuid;

mod room;
mod protocol;

use room::RoomManager;
use protocol::{ClientMessage, ServerMessage, UserInfo};

/// Application state shared across all handlers
pub struct AppState {
    pub room_manager: RoomManager,
}

/// Health check endpoint
async fn health_check() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "synapse-server",
        "version": env!("CARGO_PKG_VERSION")
    }))
}

/// WebSocket upgrade handler for room connections
async fn ws_handler(
    req: HttpRequest,
    body: web::Payload,
    path: web::Path<String>,
    state: web::Data<AppState>,
) -> Result<HttpResponse, actix_web::Error> {
    let room_id = path.into_inner();
    let user_id = Uuid::new_v4().to_string();
    
    info!("New WebSocket connection: user={} room={}", user_id, room_id);
    
    let (response, mut session, mut msg_stream) = actix_ws::handle(&req, body)?;
    
    // Join the room and get a broadcast receiver
    let (tx, mut rx) = state.room_manager.join_room(&room_id, &user_id).await;
    
    // Clone session for the receiver task before moving into async blocks
    let mut session_for_receiver = session.clone();
    
    // Spawn task to handle incoming messages from this client
    let room_id_clone = room_id.clone();
    let user_id_clone = user_id.clone();
    let tx_clone = tx.clone();
    
    actix_rt::spawn(async move {
        while let Some(Ok(msg)) = msg_stream.next().await {
            match msg {
                Message::Text(text) => {
                    // Parse and broadcast the message
                    if let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) {
                        let server_msg = ServerMessage::from_client_message(
                            client_msg,
                            &user_id_clone,
                        );
                        let _ = tx_clone.send(server_msg);
                    }
                }
                Message::Binary(bin) => {
                    // For Yjs binary sync messages - relay directly
                    let server_msg = ServerMessage::YjsSync {
                        user_id: user_id_clone.clone(),
                        data: bin.to_vec(),
                    };
                    let _ = tx_clone.send(server_msg);
                }
                Message::Ping(bytes) => {
                    if session.pong(&bytes).await.is_err() {
                        break;
                    }
                }
                Message::Close(_) => {
                    info!("Client {} disconnected from room {}", user_id_clone, room_id_clone);
                    break;
                }
                _ => {}
            }
        }
    });
    
    // Spawn task to send broadcast messages to this client
    actix_rt::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            let json = serde_json::to_string(&msg).unwrap_or_default();
            if session_for_receiver.text(json).await.is_err() {
                break;
            }
        }
    });
    
    Ok(response)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Initialize logging
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));
    
    let port = std::env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let addr = format!("0.0.0.0:{}", port);
    
    info!("🚀 Synapse server starting on {}", addr);
    
    // Create shared application state
    let app_state = web::Data::new(AppState {
        room_manager: RoomManager::new(),
    });
    
    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);
        
        App::new()
            .wrap(cors)
            .app_data(app_state.clone())
            .route("/health", web::get().to(health_check))
            .route("/ws/{room_id}", web::get().to(ws_handler))
    })
    .bind(&addr)?
    .run()
    .await
}
