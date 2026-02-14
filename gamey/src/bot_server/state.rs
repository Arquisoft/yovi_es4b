use crate::{GameY, YBotRegistry};
use std::{
    collections::HashMap,
    sync::{
        Arc,
        atomic::{AtomicU64, Ordering},
    },
};
use tokio::sync::RwLock;

/// In-memory state for a running game session.
#[derive(Clone)]
pub struct GameSession {
    pub game: GameY,
    pub bot_id: Option<String>,
}

/// Shared application state for the bot server.
///
/// This struct holds the bot registry and is shared across all request handlers
/// via Axum's state extraction. It uses `Arc` internally to allow cheap cloning
/// for concurrent request handling.
#[derive(Clone)]
pub struct AppState {
    /// The registry of available bots, wrapped in Arc for thread-safe sharing.
    bots: Arc<YBotRegistry>,
    /// In-memory game sessions indexed by game id.
    games: Arc<RwLock<HashMap<String, GameSession>>>,
    /// Counter used to generate unique game identifiers.
    next_game_id: Arc<AtomicU64>,
}

impl AppState {
    /// Creates a new application state with the given bot registry.
    pub fn new(bots: YBotRegistry) -> Self {
        Self {
            bots: Arc::new(bots),
            games: Arc::new(RwLock::new(HashMap::new())),
            next_game_id: Arc::new(AtomicU64::new(1)),
        }
    }

    /// Returns a clone of the Arc-wrapped bot registry.
    pub fn bots(&self) -> Arc<YBotRegistry> {
        Arc::clone(&self.bots)
    }

    /// Returns the in-memory game storage.
    pub fn games(&self) -> Arc<RwLock<HashMap<String, GameSession>>> {
        Arc::clone(&self.games)
    }

    /// Returns a new unique game identifier.
    pub fn new_game_id(&self) -> String {
        let id = self.next_game_id.fetch_add(1, Ordering::Relaxed);
        format!("game-{}", id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::RandomBot;

    #[test]
    fn test_new_state() {
        let registry = YBotRegistry::new();
        let state = AppState::new(registry);
        assert!(state.bots().names().is_empty());
    }

    #[test]
    fn test_state_with_bot() {
        let registry = YBotRegistry::new().with_bot(Arc::new(RandomBot));
        let state = AppState::new(registry);
        assert!(state.bots().names().contains(&"random_bot".to_string()));
    }

    #[test]
    fn test_state_clone() {
        let registry = YBotRegistry::new().with_bot(Arc::new(RandomBot));
        let state = AppState::new(registry);
        let cloned = state.clone();
        // Both should reference the same underlying data
        assert_eq!(state.bots().names(), cloned.bots().names());
    }

    #[test]
    fn test_bots_arc_clone() {
        let registry = YBotRegistry::new().with_bot(Arc::new(RandomBot));
        let state = AppState::new(registry);
        let bots1 = state.bots();
        let bots2 = state.bots();
        // Both Arcs should point to the same registry
        assert_eq!(bots1.names(), bots2.names());
    }
}
