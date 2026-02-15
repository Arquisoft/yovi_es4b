use crate::{GameY, YBotRegistry};
use std::{
    collections::{HashMap, VecDeque},
    sync::{
        Arc,
        atomic::{AtomicU64, Ordering},
    },
    time::Instant,
};
use tokio::sync::RwLock;

/// In-memory state for a running game session.
#[derive(Clone)]
pub struct GameSession {
    pub game: GameY,
    pub bot_id: Option<String>,
    /// Token by player id for authenticated multiplayer games.
    pub player_tokens: Option<HashMap<u32, String>>,
}

/// Queue entry for matchmaking.
#[derive(Clone, Debug)]
pub struct MatchmakingQueueEntry {
    pub ticket_id: String,
    pub size: u32,
}

/// Internal state for a matchmaking ticket.
#[derive(Clone, Debug)]
pub enum MatchmakingTicketStatus {
    Waiting {
        size: u32,
        enqueued_at: Instant,
    },
    Matched {
        game_id: String,
        player_id: u32,
        player_token: String,
    },
    Cancelled,
}

/// Shared in-memory matchmaking structures.
#[derive(Clone, Debug, Default)]
pub struct MatchmakingState {
    pub queue: VecDeque<MatchmakingQueueEntry>,
    pub tickets: HashMap<String, MatchmakingTicketStatus>,
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
    /// In-memory matchmaking queue and ticket statuses.
    matchmaking: Arc<RwLock<MatchmakingState>>,
    /// Counter used to generate unique game identifiers.
    next_game_id: Arc<AtomicU64>,
    /// Counter used to generate unique ticket identifiers.
    next_ticket_id: Arc<AtomicU64>,
    /// Counter used to generate unique player tokens.
    next_player_token_id: Arc<AtomicU64>,
}

impl AppState {
    /// Creates a new application state with the given bot registry.
    pub fn new(bots: YBotRegistry) -> Self {
        Self {
            bots: Arc::new(bots),
            games: Arc::new(RwLock::new(HashMap::new())),
            matchmaking: Arc::new(RwLock::new(MatchmakingState::default())),
            next_game_id: Arc::new(AtomicU64::new(1)),
            next_ticket_id: Arc::new(AtomicU64::new(1)),
            next_player_token_id: Arc::new(AtomicU64::new(1)),
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

    /// Returns the in-memory matchmaking storage.
    pub fn matchmaking(&self) -> Arc<RwLock<MatchmakingState>> {
        Arc::clone(&self.matchmaking)
    }

    /// Returns a new unique game identifier.
    pub fn new_game_id(&self) -> String {
        let id = self.next_game_id.fetch_add(1, Ordering::Relaxed);
        format!("game-{}", id)
    }

    /// Returns a new unique ticket identifier.
    pub fn new_ticket_id(&self) -> String {
        let id = self.next_ticket_id.fetch_add(1, Ordering::Relaxed);
        format!("ticket-{}", id)
    }

    /// Returns a new unique player token.
    pub fn new_player_token(&self) -> String {
        let id = self.next_player_token_id.fetch_add(1, Ordering::Relaxed);
        format!("ptk-{}", id)
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
        assert_eq!(state.new_ticket_id(), "ticket-1");
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
