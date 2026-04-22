use super::{
    error::ErrorResponse,
    games::{
        ensure_user_id_is_available_for_new_game, normalize_user_id_for_tracking,
        register_active_game_for_session_users,
    },
    state::{
        AppState, GameSession, MatchmakingQueueEntry, MatchmakingState, MatchmakingTicketStatus,
    },
    version::check_api_version,
};
use crate::GameY;
use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, Instant};

const DEFAULT_BOARD_SIZE: u32 = 7;
const DEFAULT_POLL_AFTER_MS: u64 = 1_000;
const MATCHMAKING_TICK_MS: u64 = 300;

#[derive(Deserialize)]
pub struct ApiVersionParams {
    api_version: String,
}

#[derive(Deserialize)]
pub struct TicketParams {
    api_version: String,
    ticket_id: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EnqueueRequest {
    #[serde(default = "default_board_size")]
    pub size: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MatchmakingStatus {
    Waiting,
    Matched,
    Cancelled,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TicketResponse {
    pub api_version: String,
    pub ticket_id: String,
    pub status: MatchmakingStatus,
    pub poll_after_ms: Option<u64>,
    pub position: Option<usize>,
    pub game_id: Option<String>,
    pub player_id: Option<u32>,
    pub player_token: Option<String>,
}

pub fn start_matchmaking_worker(state: AppState) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_millis(MATCHMAKING_TICK_MS));
        loop {
            interval.tick().await;
            if let Err(err) = process_once(&state).await {
                tracing::warn!("matchmaking worker error: {}", err);
            }
        }
    });
}

pub async fn enqueue(
    State(state): State<AppState>,
    Path(params): Path<ApiVersionParams>,
    headers: HeaderMap,
    Json(request): Json<EnqueueRequest>,
) -> Result<Json<TicketResponse>, Json<ErrorResponse>> {
    check_api_version(&params.api_version)?;

    if request.size == 0 {
        return Err(error_response(
            "Board size must be >= 1",
            Some(params.api_version),
        ));
    }

    let ticket_id = state.new_ticket_id();
    let user_id = read_header_string(&headers, "x-user-id");
    let normalized_user_id = normalize_user_id_for_tracking(user_id.as_deref());

    ensure_user_id_is_available_for_new_game(&state, user_id.as_deref(), &params.api_version)
        .await?;

    let matchmaking = state.matchmaking();
    let mut guard = matchmaking.write().await;

    if let Some(normalized_user_id) = normalized_user_id.as_deref()
        && let Some(existing_ticket_id) =
            find_waiting_ticket_id_for_user_id(&guard, normalized_user_id)
    {
        return Err(error_response(
            &format!(
                "User already has an active matchmaking ticket: {}",
                existing_ticket_id
            ),
            Some(params.api_version),
        ));
    }

    guard.queue.push_back(MatchmakingQueueEntry {
        ticket_id: ticket_id.clone(),
        size: request.size,
        user_id: user_id.clone(),
    });
    guard.tickets.insert(
        ticket_id.clone(),
        MatchmakingTicketStatus::Waiting {
            size: request.size,
            user_id,
            enqueued_at: Instant::now(),
        },
    );

    let position = queue_position(&guard, &ticket_id);
    Ok(Json(TicketResponse {
        api_version: params.api_version,
        ticket_id,
        status: MatchmakingStatus::Waiting,
        poll_after_ms: Some(DEFAULT_POLL_AFTER_MS),
        position,
        game_id: None,
        player_id: None,
        player_token: None,
    }))
}

pub async fn get_ticket(
    State(state): State<AppState>,
    Path(params): Path<TicketParams>,
) -> Result<Json<TicketResponse>, Json<ErrorResponse>> {
    check_api_version(&params.api_version)?;

    let matchmaking = state.matchmaking();
    let guard = matchmaking.read().await;
    let ticket_status = guard.tickets.get(&params.ticket_id).ok_or_else(|| {
        error_response(
            &format!("Ticket not found: {}", params.ticket_id),
            Some(params.api_version.clone()),
        )
    })?;

    let response = match ticket_status {
        MatchmakingTicketStatus::Waiting { .. } => TicketResponse {
            api_version: params.api_version,
            ticket_id: params.ticket_id.clone(),
            status: MatchmakingStatus::Waiting,
            poll_after_ms: Some(DEFAULT_POLL_AFTER_MS),
            position: queue_position(&guard, &params.ticket_id),
            game_id: None,
            player_id: None,
            player_token: None,
        },
        MatchmakingTicketStatus::Matched {
            game_id,
            player_id,
            player_token,
        } => TicketResponse {
            api_version: params.api_version,
            ticket_id: params.ticket_id.clone(),
            status: MatchmakingStatus::Matched,
            poll_after_ms: None,
            position: None,
            game_id: Some(game_id.clone()),
            player_id: Some(*player_id),
            player_token: Some(player_token.clone()),
        },
        MatchmakingTicketStatus::Cancelled => TicketResponse {
            api_version: params.api_version,
            ticket_id: params.ticket_id.clone(),
            status: MatchmakingStatus::Cancelled,
            poll_after_ms: None,
            position: None,
            game_id: None,
            player_id: None,
            player_token: None,
        },
    };

    Ok(Json(response))
}

pub async fn cancel_ticket(
    State(state): State<AppState>,
    Path(params): Path<TicketParams>,
) -> Result<Json<TicketResponse>, Json<ErrorResponse>> {
    check_api_version(&params.api_version)?;

    let matchmaking = state.matchmaking();
    let mut guard = matchmaking.write().await;
    let ticket_status = guard.tickets.get_mut(&params.ticket_id).ok_or_else(|| {
        error_response(
            &format!("Ticket not found: {}", params.ticket_id),
            Some(params.api_version.clone()),
        )
    })?;

    match ticket_status {
        MatchmakingTicketStatus::Waiting { .. } => {
            *ticket_status = MatchmakingTicketStatus::Cancelled;
            guard
                .queue
                .retain(|entry| entry.ticket_id != params.ticket_id);
        }
        MatchmakingTicketStatus::Matched { .. } => {
            return Err(error_response(
                "Ticket is already matched and cannot be cancelled",
                Some(params.api_version),
            ));
        }
        MatchmakingTicketStatus::Cancelled => {}
    }

    Ok(Json(TicketResponse {
        api_version: params.api_version,
        ticket_id: params.ticket_id,
        status: MatchmakingStatus::Cancelled,
        poll_after_ms: None,
        position: None,
        game_id: None,
        player_id: None,
        player_token: None,
    }))
}

async fn process_once(state: &AppState) -> Result<(), String> {
    loop {
        let pair = {
            let matchmaking = state.matchmaking();
            let mut guard = matchmaking.write().await;
            take_next_pair(&mut guard)
        };

        let Some((a, b)) = pair else {
            break;
        };

        let game_id = state.new_game_id();
        let player_a_token = state.new_player_token();
        let player_b_token = state.new_player_token();
        let player_tokens = HashMap::from([
            (0_u32, player_a_token.clone()),
            (1_u32, player_b_token.clone()),
        ]);

        let games = state.games();
        let mut games_guard = games.write().await;
        let session = GameSession {
            game: GameY::new(a.size),
            bot_id: None,
            created_at: Instant::now(),
            turn_started_at: Some(Instant::now()),
            player_tokens: Some(player_tokens),
            last_seen_at_by_player_id: Some(HashMap::new()),
            player0_user_id: a.user_id.clone(),
            player1_user_id: b.user_id.clone(),
            stats_reported: false,
            completion_reason: None,
        };
        games_guard.insert(game_id.clone(), session.clone());
        drop(games_guard);
        register_active_game_for_session_users(state, &game_id, &session).await;

        let matchmaking = state.matchmaking();
        let mut mm_guard = matchmaking.write().await;
        mm_guard.tickets.insert(
            a.ticket_id,
            MatchmakingTicketStatus::Matched {
                game_id: game_id.clone(),
                player_id: 0,
                player_token: player_a_token,
            },
        );
        mm_guard.tickets.insert(
            b.ticket_id,
            MatchmakingTicketStatus::Matched {
                game_id,
                player_id: 1,
                player_token: player_b_token,
            },
        );
    }

    Ok(())
}

fn take_next_pair(
    state: &mut MatchmakingState,
) -> Option<(MatchmakingQueueEntry, MatchmakingQueueEntry)> {
    while let Some(first) = state.queue.pop_front() {
        if !is_waiting_ticket(&state.tickets, &first.ticket_id) {
            continue;
        }

        let second_idx = state.queue.iter().position(|candidate| {
            candidate.size == first.size
                && is_waiting_ticket(&state.tickets, &candidate.ticket_id)
                && !share_matchmaking_identity(&first, candidate)
        });

        if let Some(idx) = second_idx
            && let Some(second) = state.queue.remove(idx)
        {
            return Some((first, second));
        }

        state.queue.push_front(first);
        return None;
    }
    None
}

fn is_waiting_ticket(tickets: &HashMap<String, MatchmakingTicketStatus>, ticket_id: &str) -> bool {
    matches!(
        tickets.get(ticket_id),
        Some(MatchmakingTicketStatus::Waiting { .. })
    )
}

fn find_waiting_ticket_id_for_user_id<'a>(
    state: &'a MatchmakingState,
    normalized_user_id: &str,
) -> Option<&'a str> {
    state.tickets.iter().find_map(|(ticket_id, status)| {
        let MatchmakingTicketStatus::Waiting { user_id, .. } = status else {
            return None;
        };

        (normalize_user_id_for_tracking(user_id.as_deref()).as_deref() == Some(normalized_user_id))
            .then_some(ticket_id.as_str())
    })
}

fn share_matchmaking_identity(
    first: &MatchmakingQueueEntry,
    second: &MatchmakingQueueEntry,
) -> bool {
    let first_user_id = normalize_user_id_for_tracking(first.user_id.as_deref());
    let second_user_id = normalize_user_id_for_tracking(second.user_id.as_deref());

    matches!(
        (first_user_id.as_deref(), second_user_id.as_deref()),
        (Some(first_user_id), Some(second_user_id)) if first_user_id == second_user_id
    )
}

fn queue_position(state: &MatchmakingState, ticket_id: &str) -> Option<usize> {
    state
        .queue
        .iter()
        .position(|entry| entry.ticket_id == ticket_id)
        .map(|idx| idx + 1)
}

fn default_board_size() -> u32 {
    DEFAULT_BOARD_SIZE
}

fn read_header_string(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn error_response(message: &str, api_version: Option<String>) -> Json<ErrorResponse> {
    Json(ErrorResponse::error(message, api_version, None))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_take_next_pair_fifo_same_size() {
        let mut state = MatchmakingState::default();
        state.queue.push_back(MatchmakingQueueEntry {
            ticket_id: "ticket-1".to_string(),
            size: 7,
            user_id: None,
        });
        state.queue.push_back(MatchmakingQueueEntry {
            ticket_id: "ticket-2".to_string(),
            size: 7,
            user_id: None,
        });
        state.tickets.insert(
            "ticket-1".to_string(),
            MatchmakingTicketStatus::Waiting {
                size: 7,
                user_id: None,
                enqueued_at: Instant::now(),
            },
        );
        state.tickets.insert(
            "ticket-2".to_string(),
            MatchmakingTicketStatus::Waiting {
                size: 7,
                user_id: None,
                enqueued_at: Instant::now(),
            },
        );

        let pair = take_next_pair(&mut state).unwrap();
        assert_eq!(pair.0.ticket_id, "ticket-1");
        assert_eq!(pair.1.ticket_id, "ticket-2");
    }

    #[test]
    fn test_take_next_pair_skips_same_identity_and_uses_next_distinct_ticket() {
        let mut state = MatchmakingState::default();
        state.queue.push_back(MatchmakingQueueEntry {
            ticket_id: "ticket-1".to_string(),
            size: 7,
            user_id: Some("guest-a".to_string()),
        });
        state.queue.push_back(MatchmakingQueueEntry {
            ticket_id: "ticket-2".to_string(),
            size: 7,
            user_id: Some("guest-a".to_string()),
        });
        state.queue.push_back(MatchmakingQueueEntry {
            ticket_id: "ticket-3".to_string(),
            size: 7,
            user_id: Some("guest-b".to_string()),
        });
        state.tickets.insert(
            "ticket-1".to_string(),
            MatchmakingTicketStatus::Waiting {
                size: 7,
                user_id: Some("guest-a".to_string()),
                enqueued_at: Instant::now(),
            },
        );
        state.tickets.insert(
            "ticket-2".to_string(),
            MatchmakingTicketStatus::Waiting {
                size: 7,
                user_id: Some("guest-a".to_string()),
                enqueued_at: Instant::now(),
            },
        );
        state.tickets.insert(
            "ticket-3".to_string(),
            MatchmakingTicketStatus::Waiting {
                size: 7,
                user_id: Some("guest-b".to_string()),
                enqueued_at: Instant::now(),
            },
        );

        let pair = take_next_pair(&mut state).unwrap();
        assert_eq!(pair.0.ticket_id, "ticket-1");
        assert_eq!(pair.1.ticket_id, "ticket-3");
    }

    #[test]
    fn test_find_waiting_ticket_id_for_user_id_returns_existing_ticket() {
        let mut state = MatchmakingState::default();
        state.tickets.insert(
            "ticket-2".to_string(),
            MatchmakingTicketStatus::Waiting {
                size: 7,
                user_id: Some("Guest-A".to_string()),
                enqueued_at: Instant::now(),
            },
        );

        let existing_ticket_id = find_waiting_ticket_id_for_user_id(&state, "guest-a");
        assert_eq!(existing_ticket_id, Some("ticket-2"));
    }
}
