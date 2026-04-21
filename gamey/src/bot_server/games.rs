use super::{
    error::ErrorResponse,
    state::{AppState, GameCompletionReason, GameSession},
    version::check_api_version,
};
use crate::{Coordinates, GameAction, GameStatus, GameY, Movement, PlayerId, YEN};
use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    time::{Duration, Instant},
};
use tracing::warn;

const ONLINE_PLAYER_INACTIVITY_TIMEOUT: Duration = Duration::from_secs(60);
const ONLINE_TURN_TIMEOUT: Duration = Duration::from_secs(60);
const ONLINE_GAME_TIMEOUT_CHECK_INTERVAL: Duration = Duration::from_secs(1);

/// Supported game modes for the HTTP API.
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum GameMode {
    HumanVsHuman,
    #[default]
    HumanVsBot,
}

/// Request payload for creating a new game.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CreateGameRequest {
    /// Board size (triangle side length). Must be >= 1.
    #[serde(default = "default_board_size")]
    pub size: u32,
    /// Game mode. Defaults to human_vs_bot.
    #[serde(default)]
    pub mode: GameMode,
    /// Optional bot identifier. Used only in human_vs_bot mode.
    pub bot_id: Option<String>,
}

/// Request payload for placing a move.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MoveRequest {
    /// Coordinates where the current player places a piece.
    pub coords: Coordinates,
    /// Authentication token for multiplayer matchmaking games.
    pub player_token: Option<String>,
}

/// Response payload containing full game state after each operation.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GameStateResponse {
    /// The API version used.
    pub api_version: String,
    /// Unique game identifier.
    pub game_id: String,
    /// Current game mode.
    pub mode: GameMode,
    /// Bot used for human-vs-bot games.
    pub bot_id: Option<String>,
    /// Current board state in YEN format.
    pub yen: YEN,
    /// Whether the game has finished.
    pub game_over: bool,
    /// Next player id if game is ongoing.
    pub next_player: Option<u32>,
    /// Winner player id if game is finished.
    pub winner: Option<u32>,
    /// Why the game finished, when available.
    pub completion_reason: Option<GameCompletionReason>,
    /// User id associated with player 0 (when available).
    pub player0_user_id: Option<String>,
    /// User id associated with player 1 (when available).
    pub player1_user_id: Option<String>,
    /// Remaining time before the opponent loses by inactivity, from the requesting player's perspective.
    pub opponent_inactivity_timeout_remaining_ms: Option<u64>,
    /// Remaining time before the current online turn is automatically passed.
    pub turn_timeout_remaining_ms: Option<u64>,
}

#[derive(Deserialize)]
pub struct ApiVersionParams {
    api_version: String,
}

#[derive(Deserialize)]
pub struct GameParams {
    api_version: String,
    game_id: String,
}

pub fn start_inactive_online_game_monitor(state: AppState) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(ONLINE_GAME_TIMEOUT_CHECK_INTERVAL);
        loop {
            interval.tick().await;
            if let Err(error) = process_online_game_timeouts(&state).await {
                warn!("inactive online game monitor error: {}", error);
            }
        }
    });
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct FinishedMatchPlayer {
    user_id: String,
    result: String,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct FinishedMatchRequest {
    game_id: String,
    mode: Option<String>,
    bot_id: Option<String>,
    reason: Option<String>,
    winner_id: Option<String>,
    final_board: Option<YEN>,
    players: Vec<FinishedMatchPlayer>,
}

/// Creates a new game and stores it in server memory.
///
/// # Route
/// `POST /{api_version}/games`
///
/// # Request body
/// - `size`: board size
/// - `mode`: `human_vs_human` or `human_vs_bot`
/// - `bot_id`: optional bot id (human_vs_bot only, defaults to `random_bot`)
pub async fn create_game(
    State(state): State<AppState>,
    Path(params): Path<ApiVersionParams>,
    headers: HeaderMap,
    Json(request): Json<CreateGameRequest>,
) -> Result<Json<GameStateResponse>, Json<ErrorResponse>> {
    check_api_version(&params.api_version)?;

    if request.size == 0 {
        return Err(error_response(
            "Board size must be >= 1",
            Some(params.api_version),
        ));
    }

    let bot_id = resolve_bot_id(&state, request.mode, request.bot_id, &params.api_version)?;
    let player0_user_id = read_header_string(&headers, "x-user-id");
    let player1_user_id = read_header_string(&headers, "x-opponent-user-id");

    ensure_user_id_is_available_for_new_game(
        &state,
        player0_user_id.as_deref(),
        &params.api_version,
    )
    .await?;
    ensure_user_id_is_available_for_new_game(
        &state,
        player1_user_id.as_deref(),
        &params.api_version,
    )
    .await?;

    let session = GameSession {
        game: GameY::new(request.size),
        bot_id: bot_id.clone(),
        created_at: Instant::now(),
        turn_started_at: None,
        player_tokens: None,
        last_seen_at_by_player_id: None,
        player0_user_id,
        player1_user_id,
        stats_reported: false,
        completion_reason: None,
    };

    let game_id = state.new_game_id();
    let response = build_game_state_response(&params.api_version, &game_id, &session, None);

    let games = state.games();
    games.write().await.insert(game_id.clone(), session.clone());
    register_active_game_for_session_users(&state, &game_id, &session).await;
    state.metrics().inc_games_created();

    Ok(Json(response))
}

/// Returns the current state of a game.
///
/// # Route
/// `GET /{api_version}/games/{game_id}`
pub async fn get_game(
    State(state): State<AppState>,
    Path(params): Path<GameParams>,
    headers: HeaderMap,
) -> Result<Json<GameStateResponse>, Json<ErrorResponse>> {
    check_api_version(&params.api_version)?;

    let games = state.games();
    let mut guard = games.write().await;
    let session = require_game_session_mut(&mut guard, &params)?;
    let requesting_player_id = find_player_id_from_header_token(session, &headers);

    if let Some(requesting_player_id) = requesting_player_id {
        record_online_player_presence(session, requesting_player_id);
    }

    Ok(Json(build_game_state_response(
        &params.api_version,
        &params.game_id,
        session,
        requesting_player_id,
    )))
}

/// Applies a human move and, in bot mode, immediately applies the bot move.
///
/// # Route
/// `POST /{api_version}/games/{game_id}/moves`
pub async fn play_move(
    State(state): State<AppState>,
    Path(params): Path<GameParams>,
    Json(request): Json<MoveRequest>,
) -> Result<Json<GameStateResponse>, Json<ErrorResponse>> {
    check_api_version(&params.api_version)?;

    let bots = state.bots();
    let games = state.games();
    let mut guard = games.write().await;

    let pending_report: Option<FinishedMatchRequest>;
    let user_ids_to_release_from_active_game_index: Option<Vec<String>>;

    let response = {
        let session = require_game_session_mut(&mut guard, &params)?;
        ensure_game_not_finished(&session.game, &params.api_version)?;

        validate_coordinates(&request.coords, session.game.board_size()).map_err(|msg| {
            error_response(
                &format!("Invalid coordinates: {}", msg),
                Some(params.api_version.clone()),
            )
        })?;

        let current_player = current_player_or_finished(&session.game, &params.api_version)?;
        validate_player_token_for_turn(
            session,
            current_player,
            request.player_token.as_deref(),
            &params.api_version,
        )?;
        record_online_player_presence(session, current_player);

        if session.bot_id.is_some() && current_player != PlayerId::new(0) {
            return Err(error_response(
                "Human moves are only allowed on player 0 turn in human_vs_bot mode",
                Some(params.api_version.clone()),
            ));
        }

        session
            .game
            .add_move(Movement::Placement {
                player: current_player,
                coords: request.coords,
            })
            .map_err(|e| {
                error_response(
                    &format!("Could not apply move: {}", e),
                    Some(params.api_version.clone()),
                )
            })?;

        if let Some(bot_id) = &session.bot_id
            && !session.game.check_game_over()
        {
            let bot = match bots.find(bot_id) {
                Some(bot) => bot,
                None => {
                    let available_bots = bots.names().join(", ");
                    return Err(bot_not_found_error(
                        &params.api_version,
                        bot_id,
                        &available_bots,
                    ));
                }
            };

            let bot_coords = match bot.choose_move(&session.game) {
                Some(coords) => coords,
                None => {
                    return Err(error_response(
                        "No valid moves available for the bot",
                        Some(params.api_version.clone()),
                    ));
                }
            };

            if let Some(bot_player) = session.game.next_player() {
                session
                    .game
                    .add_move(Movement::Placement {
                        player: bot_player,
                        coords: bot_coords,
                    })
                    .map_err(|e| {
                        error_response(
                            &format!("Could not apply bot move: {}", e),
                            Some(params.api_version.clone()),
                        )
                    })?;
            }
        }

        reset_turn_timer(session);

        pending_report = prepare_stats_report_if_needed(&params.game_id, session);
        user_ids_to_release_from_active_game_index = build_finished_game_user_id_list(session);

        build_game_state_response(
            &params.api_version,
            &params.game_id,
            session,
            Some(current_player),
        )
    };

    drop(guard);
    clear_active_game_registration_if_needed(
        &state,
        &params.game_id,
        user_ids_to_release_from_active_game_index,
    )
    .await;
    state.metrics().inc_moves_played();
    report_finished_match_if_needed(&state, pending_report).await;

    Ok(Json(response))
}

/// Resigns the current game.
///
/// In `human_vs_bot`, player 0 resigns.
/// In `human_vs_human`, the current player resigns.
///
/// # Route
/// `POST /{api_version}/games/{game_id}/resign`
pub async fn resign_game(
    State(state): State<AppState>,
    Path(params): Path<GameParams>,
    headers: HeaderMap,
) -> Result<Json<GameStateResponse>, Json<ErrorResponse>> {
    check_api_version(&params.api_version)?;

    let games = state.games();
    let mut guard = games.write().await;

    let pending_report: Option<FinishedMatchRequest>;
    let user_ids_to_release_from_active_game_index: Option<Vec<String>>;

    let response = {
        let session = require_game_session_mut(&mut guard, &params)?;
        ensure_game_not_finished(&session.game, &params.api_version)?;

        let resigning_player = match &session.player_tokens {
            Some(_) => resolve_player_from_header_token(session, &headers, &params.api_version)?,
            None => match (&session.bot_id, session.game.next_player()) {
                (Some(_), _) => PlayerId::new(0),
                (None, Some(player)) => player,
                (None, None) => return Err(game_finished_error(&params.api_version)),
            },
        };
        record_online_player_presence(session, resigning_player);
        session.completion_reason = Some(GameCompletionReason::Resignation);

        session
            .game
            .add_move(Movement::Action {
                player: resigning_player,
                action: GameAction::Resign,
            })
            .map_err(|e| {
                error_response(
                    &format!("Could not resign game: {}", e),
                    Some(params.api_version.clone()),
                )
            })?;

        reset_turn_timer(session);

        pending_report = prepare_stats_report_if_needed(&params.game_id, session);
        user_ids_to_release_from_active_game_index = build_finished_game_user_id_list(session);

        build_game_state_response(
            &params.api_version,
            &params.game_id,
            session,
            Some(resigning_player),
        )
    };

    drop(guard);
    clear_active_game_registration_if_needed(
        &state,
        &params.game_id,
        user_ids_to_release_from_active_game_index,
    )
    .await;
    state.metrics().inc_resignations();
    report_finished_match_if_needed(&state, pending_report).await;

    Ok(Json(response))
}

/// Passes the current turn to the opponent.
///
/// In `human_vs_bot`, player 0 can pass and the bot immediately plays its turn.
/// In `human_vs_human`, the current player passes and the opponent becomes active.
///
/// # Route
/// `POST /{api_version}/games/{game_id}/pass`
pub async fn pass_turn(
    State(state): State<AppState>,
    Path(params): Path<GameParams>,
    headers: HeaderMap,
) -> Result<Json<GameStateResponse>, Json<ErrorResponse>> {
    check_api_version(&params.api_version)?;

    let bots = state.bots();
    let games = state.games();
    let mut guard = games.write().await;

    let pending_report: Option<FinishedMatchRequest>;
    let user_ids_to_release_from_active_game_index: Option<Vec<String>>;

    let response = {
        let session = require_game_session_mut(&mut guard, &params)?;
        ensure_game_not_finished(&session.game, &params.api_version)?;

        let current_player = current_player_or_finished(&session.game, &params.api_version)?;
        let passing_player = match &session.player_tokens {
            Some(_) => {
                validate_player_token_for_turn(
                    session,
                    current_player,
                    read_header_string(&headers, "x-player-token").as_deref(),
                    &params.api_version,
                )?;
                current_player
            }
            None => match &session.bot_id {
                Some(_) => {
                    if current_player != PlayerId::new(0) {
                        return Err(error_response(
                            "Human turn passing is only allowed on player 0 turn in human_vs_bot mode",
                            Some(params.api_version.clone()),
                        ));
                    }
                    current_player
                }
                None => current_player,
            },
        };

        record_online_player_presence(session, passing_player);

        session
            .game
            .add_move(Movement::Action {
                player: passing_player,
                action: GameAction::PassTurn,
            })
            .map_err(|e| {
                error_response(
                    &format!("Could not pass turn: {}", e),
                    Some(params.api_version.clone()),
                )
            })?;

        if let Some(bot_id) = &session.bot_id
            && !session.game.check_game_over()
        {
            let bot = match bots.find(bot_id) {
                Some(bot) => bot,
                None => {
                    let available_bots = bots.names().join(", ");
                    return Err(bot_not_found_error(
                        &params.api_version,
                        bot_id,
                        &available_bots,
                    ));
                }
            };

            let bot_coords = match bot.choose_move(&session.game) {
                Some(coords) => coords,
                None => {
                    return Err(error_response(
                        "No valid moves available for the bot",
                        Some(params.api_version.clone()),
                    ));
                }
            };

            if let Some(bot_player) = session.game.next_player() {
                session
                    .game
                    .add_move(Movement::Placement {
                        player: bot_player,
                        coords: bot_coords,
                    })
                    .map_err(|e| {
                        error_response(
                            &format!("Could not apply bot move after passing turn: {}", e),
                            Some(params.api_version.clone()),
                        )
                    })?;
            }
        }

        reset_turn_timer(session);

        pending_report = prepare_stats_report_if_needed(&params.game_id, session);
        user_ids_to_release_from_active_game_index = build_finished_game_user_id_list(session);

        build_game_state_response(
            &params.api_version,
            &params.game_id,
            session,
            Some(passing_player),
        )
    };

    drop(guard);
    clear_active_game_registration_if_needed(
        &state,
        &params.game_id,
        user_ids_to_release_from_active_game_index,
    )
    .await;
    state.metrics().inc_turn_passes();
    report_finished_match_if_needed(&state, pending_report).await;

    Ok(Json(response))
}

fn read_header_string(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn normalize_identifier(value: Option<String>) -> Option<String> {
    value
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn mode_name(session: &GameSession) -> String {
    match &session.bot_id {
        Some(_) => "human_vs_bot".to_string(),
        None => "human_vs_human".to_string(),
    }
}

fn player0_id(session: &GameSession) -> String {
    normalize_identifier(session.player0_user_id.clone()).unwrap_or_else(|| "player-0".to_string())
}

fn player1_id(session: &GameSession) -> String {
    if let Some(id) = normalize_identifier(session.player1_user_id.clone()) {
        return id;
    }

    if let Some(bot_id) = &session.bot_id {
        return format!("bot:{}", bot_id);
    }

    "player-1".to_string()
}

fn prepare_stats_report_if_needed(
    game_id: &str,
    session: &mut GameSession,
) -> Option<FinishedMatchRequest> {
    if session.stats_reported {
        return None;
    }

    let winner = match session.game.status() {
        GameStatus::Finished { winner } => winner.id(),
        GameStatus::Ongoing { .. } => return None,
    };
    if session.completion_reason.is_none() {
        session.completion_reason = Some(GameCompletionReason::WinCondition);
    }

    let completion_reason = session
        .completion_reason
        .unwrap_or(GameCompletionReason::WinCondition);

    let p0 = player0_id(session);
    let p1 = player1_id(session);

    let p0_result = if winner == 0 { "win" } else { "loss" };
    let p1_result = if winner == 1 { "win" } else { "loss" };

    let winner_user_id = if winner == 0 { p0.clone() } else { p1.clone() };
    let final_board: YEN = (&session.game).into();

    session.stats_reported = true;

    Some(FinishedMatchRequest {
        game_id: game_id.to_string(),
        mode: Some(mode_name(session)),
        bot_id: session.bot_id.clone(),
        reason: Some(game_completion_reason_to_stats_reason(completion_reason).to_string()),
        winner_id: Some(winner_user_id),
        final_board: Some(final_board),
        players: vec![
            FinishedMatchPlayer {
                user_id: p0,
                result: p0_result.to_string(),
            },
            FinishedMatchPlayer {
                user_id: p1,
                result: p1_result.to_string(),
            },
        ],
    })
}

async fn report_finished_match_if_needed(state: &AppState, pending_report: Option<FinishedMatchRequest>) {
    let Some(payload) = pending_report else {
        return;
    };

    let stats_url =
        std::env::var("STATS_SERVICE_URL").unwrap_or_else(|_| "http://stats:3001".to_string());
    let internal_token = std::env::var("STATS_INTERNAL_TOKEN")
        .unwrap_or_else(|_| "stats-internal-token".to_string());

    let endpoint = format!(
        "{}/internal/v1/matches/finished",
        stats_url.trim_end_matches('/')
    );

    let client = reqwest::Client::new();
    state.metrics().inc_stats_report_attempts();
    match client
        .post(&endpoint)
        .header("x-service-token", internal_token)
        .json(&payload)
        .send()
        .await
    {
        Ok(response) => {
            if !response.status().is_success() {
                let status = response.status();
                let body = response.text().await.unwrap_or_default();
                warn!(
                    "Failed to report finished game {} to stats. status={} body={}",
                    payload.game_id, status, body
                );
                state.metrics().inc_stats_report_failures();
            }
        }
        Err(error) => {
            warn!(
                "Could not report finished game {} to stats: {}",
                payload.game_id, error
            );
            state.metrics().inc_stats_report_failures();
        }
    }
}

async fn process_online_game_timeouts(state: &AppState) -> Result<(), String> {
    let mut pending_reports = Vec::new();
    let mut finished_games_to_unregister = Vec::new();
    let now = Instant::now();

    let games = state.games();
    let mut games_guard = games.write().await;

    for (game_id, session) in games_guard.iter_mut() {
        let Some(player_to_forfeit) =
            find_player_to_forfeit_for_inactivity(session, now, ONLINE_PLAYER_INACTIVITY_TIMEOUT)
        else {
            continue;
        };

        session.completion_reason = Some(GameCompletionReason::DisconnectTimeout);
        session
            .game
            .add_move(Movement::Action {
                player: player_to_forfeit,
                action: GameAction::Resign,
            })
            .map_err(|error| {
                format!(
                    "could not forfeit inactive player {} in game {}: {}",
                    player_to_forfeit.id(),
                    game_id,
                    error
                )
            })?;
        reset_turn_timer(session);
        state.metrics().inc_resignations();

        if let Some(pending_report) = prepare_stats_report_if_needed(game_id, session) {
            pending_reports.push(pending_report);
        }

        if let Some(user_ids_to_unregister) = build_finished_game_user_id_list(session) {
            finished_games_to_unregister.push((game_id.clone(), user_ids_to_unregister));
        }

        continue;
    }

    for (_game_id, session) in games_guard.iter_mut() {
        let Some(player_to_auto_pass) =
            find_player_to_auto_pass_for_turn_timeout(session, now, ONLINE_TURN_TIMEOUT)
        else {
            continue;
        };

        session
            .game
            .add_move(Movement::Action {
                player: player_to_auto_pass,
                action: GameAction::PassTurn,
            })
            .map_err(|error| {
                format!(
                    "could not auto-pass player {} after turn timeout: {}",
                    player_to_auto_pass.id(),
                    error
                )
            })?;
        reset_turn_timer(session);
        state.metrics().inc_turn_passes();
    }

    drop(games_guard);

    for (game_id, user_ids_to_unregister) in finished_games_to_unregister {
        unregister_active_game_for_user_ids(state, &game_id, &user_ids_to_unregister).await;
    }

    for pending_report in pending_reports {
        report_finished_match_if_needed(state, Some(pending_report)).await;
    }

    Ok(())
}

fn find_player_to_forfeit_for_inactivity(
    session: &GameSession,
    now: Instant,
    inactivity_timeout: Duration,
) -> Option<PlayerId> {
    if session.player_tokens.is_none() || session.game.check_game_over() {
        return None;
    }

    let last_seen_at_by_player_id = session.last_seen_at_by_player_id.as_ref()?;
    let player0_last_seen_at = last_seen_at_by_player_id
        .get(&0)
        .copied()
        .unwrap_or(session.created_at);
    let player1_last_seen_at = last_seen_at_by_player_id
        .get(&1)
        .copied()
        .unwrap_or(session.created_at);

    let player0_is_inactive =
        now.saturating_duration_since(player0_last_seen_at) > inactivity_timeout;
    let player1_is_inactive =
        now.saturating_duration_since(player1_last_seen_at) > inactivity_timeout;

    match (player0_is_inactive, player1_is_inactive) {
        (true, false) => Some(PlayerId::new(0)),
        (false, true) => Some(PlayerId::new(1)),
        _ => None,
    }
}

fn find_player_to_auto_pass_for_turn_timeout(
    session: &GameSession,
    now: Instant,
    turn_timeout: Duration,
) -> Option<PlayerId> {
    if session.player_tokens.is_none() || session.game.check_game_over() {
        return None;
    }

    let next_player = session.game.next_player()?;
    let turn_started_at = session.turn_started_at?;
    let elapsed = now.saturating_duration_since(turn_started_at);

    if elapsed > turn_timeout {
        Some(next_player)
    } else {
        None
    }
}

fn record_online_player_presence(session: &mut GameSession, player_id: PlayerId) {
    let Some(last_seen_at_by_player_id) = &mut session.last_seen_at_by_player_id else {
        return;
    };

    last_seen_at_by_player_id.insert(player_id.id(), Instant::now());
}

fn reset_turn_timer(session: &mut GameSession) {
    if session.player_tokens.is_none() {
        session.turn_started_at = None;
        return;
    }

    session.turn_started_at = if session.game.check_game_over() {
        None
    } else {
        Some(Instant::now())
    };
}

fn find_player_id_from_header_token(
    session: &GameSession,
    headers: &HeaderMap,
) -> Option<PlayerId> {
    let tokens = session.player_tokens.as_ref()?;
    let provided_token = headers.get("x-player-token")?.to_str().ok()?;

    tokens.iter().find_map(|(player_id, stored_token)| {
        if stored_token == provided_token {
            Some(PlayerId::new(*player_id))
        } else {
            None
        }
    })
}

pub(super) async fn ensure_user_id_is_available_for_new_game(
    state: &AppState,
    user_id: Option<&str>,
    api_version: &str,
) -> Result<(), Json<ErrorResponse>> {
    let Some(normalized_user_id) = normalize_user_id_for_tracking(user_id) else {
        return Ok(());
    };

    let active_game_id_by_user_id = state.active_game_id_by_user_id();
    let active_game_id_by_user_id_guard = active_game_id_by_user_id.read().await;

    if let Some(active_game_id) = active_game_id_by_user_id_guard.get(&normalized_user_id) {
        return Err(error_response(
            &format!(
                "User {} already has an active game: {}",
                normalized_user_id, active_game_id
            ),
            Some(api_version.to_string()),
        ));
    }

    Ok(())
}

pub(super) async fn register_active_game_for_session_users(
    state: &AppState,
    game_id: &str,
    session: &GameSession,
) {
    let tracked_user_ids = collect_tracked_user_ids(session);
    if tracked_user_ids.is_empty() {
        return;
    }

    let active_game_id_by_user_id = state.active_game_id_by_user_id();
    let mut active_game_id_by_user_id_guard = active_game_id_by_user_id.write().await;

    for tracked_user_id in tracked_user_ids {
        active_game_id_by_user_id_guard.insert(tracked_user_id, game_id.to_string());
    }
}

async fn clear_active_game_registration_if_needed(
    state: &AppState,
    game_id: &str,
    user_ids_to_unregister: Option<Vec<String>>,
) {
    let Some(user_ids_to_unregister) = user_ids_to_unregister else {
        return;
    };

    unregister_active_game_for_user_ids(state, game_id, &user_ids_to_unregister).await;
}

async fn unregister_active_game_for_user_ids(
    state: &AppState,
    game_id: &str,
    user_ids_to_unregister: &[String],
) {
    if user_ids_to_unregister.is_empty() {
        return;
    }

    let active_game_id_by_user_id = state.active_game_id_by_user_id();
    let mut active_game_id_by_user_id_guard = active_game_id_by_user_id.write().await;

    for user_id_to_unregister in user_ids_to_unregister {
        if active_game_id_by_user_id_guard
            .get(user_id_to_unregister)
            .is_some_and(|registered_game_id| registered_game_id == game_id)
        {
            active_game_id_by_user_id_guard.remove(user_id_to_unregister);
        }
    }
}

fn build_finished_game_user_id_list(session: &GameSession) -> Option<Vec<String>> {
    if !session.game.check_game_over() {
        return None;
    }

    let tracked_user_ids = collect_tracked_user_ids(session);
    if tracked_user_ids.is_empty() {
        return None;
    }

    Some(tracked_user_ids)
}

fn collect_tracked_user_ids(session: &GameSession) -> Vec<String> {
    let mut tracked_user_ids = Vec::new();

    if let Some(player0_user_id) =
        normalize_user_id_for_tracking(session.player0_user_id.as_deref())
    {
        tracked_user_ids.push(player0_user_id);
    }

    if let Some(player1_user_id) =
        normalize_user_id_for_tracking(session.player1_user_id.as_deref())
        && !tracked_user_ids.contains(&player1_user_id)
    {
        tracked_user_ids.push(player1_user_id);
    }

    tracked_user_ids
}

pub(super) fn normalize_user_id_for_tracking(user_id: Option<&str>) -> Option<String> {
    user_id
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_lowercase())
}

fn game_completion_reason_to_stats_reason(completion_reason: GameCompletionReason) -> &'static str {
    match completion_reason {
        GameCompletionReason::WinCondition => "win_condition",
        GameCompletionReason::Resignation => "resignation",
        GameCompletionReason::DisconnectTimeout => "disconnect_timeout",
    }
}

fn default_board_size() -> u32 {
    7
}

fn require_game_session_mut<'a>(
    games: &'a mut HashMap<String, GameSession>,
    params: &GameParams,
) -> Result<&'a mut GameSession, Json<ErrorResponse>> {
    games
        .get_mut(&params.game_id)
        .ok_or_else(|| game_not_found_error(&params.api_version, &params.game_id))
}

fn game_not_found_error(api_version: &str, game_id: &str) -> Json<ErrorResponse> {
    error_response(
        &format!("Game not found: {}", game_id),
        Some(api_version.to_string()),
    )
}

fn game_finished_error(api_version: &str) -> Json<ErrorResponse> {
    error_response("Game is already finished", Some(api_version.to_string()))
}

fn ensure_game_not_finished(game: &GameY, api_version: &str) -> Result<(), Json<ErrorResponse>> {
    if game.check_game_over() {
        Err(game_finished_error(api_version))
    } else {
        Ok(())
    }
}

fn current_player_or_finished(
    game: &GameY,
    api_version: &str,
) -> Result<PlayerId, Json<ErrorResponse>> {
    game.next_player()
        .ok_or_else(|| game_finished_error(api_version))
}

fn validate_player_token_for_turn(
    session: &GameSession,
    current_player: PlayerId,
    provided_token: Option<&str>,
    api_version: &str,
) -> Result<(), Json<ErrorResponse>> {
    let Some(tokens) = &session.player_tokens else {
        return Ok(());
    };

    let expected_token = tokens.get(&current_player.id()).ok_or_else(|| {
        error_response(
            "Player token configuration is invalid",
            Some(api_version.to_string()),
        )
    })?;
    let provided = provided_token.ok_or_else(|| {
        error_response(
            "player_token is required for this matchmaking game",
            Some(api_version.to_string()),
        )
    })?;

    if provided != expected_token {
        return Err(error_response(
            "Invalid player_token for current turn",
            Some(api_version.to_string()),
        ));
    }

    Ok(())
}

fn resolve_player_from_header_token(
    session: &GameSession,
    headers: &HeaderMap,
    api_version: &str,
) -> Result<PlayerId, Json<ErrorResponse>> {
    let tokens = session.player_tokens.as_ref().ok_or_else(|| {
        error_response(
            "This game does not use player tokens",
            Some(api_version.to_string()),
        )
    })?;

    let provided = headers
        .get("x-player-token")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| {
            error_response(
                "x-player-token header is required for this matchmaking game",
                Some(api_version.to_string()),
            )
        })?;

    tokens
        .iter()
        .find_map(|(player_id, token)| {
            if token == provided {
                Some(PlayerId::new(*player_id))
            } else {
                None
            }
        })
        .ok_or_else(|| {
            error_response(
                "Invalid x-player-token for this game",
                Some(api_version.to_string()),
            )
        })
}

fn bot_not_found_error(
    api_version: &str,
    bot_id: &str,
    available_bots: &str,
) -> Json<ErrorResponse> {
    error_response(
        &format!(
            "Bot not found: {}, available bots: [{}]",
            bot_id, available_bots
        ),
        Some(api_version.to_string()),
    )
}

fn resolve_bot_id(
    state: &AppState,
    mode: GameMode,
    requested_bot_id: Option<String>,
    api_version: &str,
) -> Result<Option<String>, Json<ErrorResponse>> {
    match mode {
        GameMode::HumanVsHuman => {
            if requested_bot_id.is_some() {
                return Err(error_response(
                    "bot_id is only valid in human_vs_bot mode",
                    Some(api_version.to_string()),
                ));
            }
            Ok(None)
        }
        GameMode::HumanVsBot => {
            let bot_id = requested_bot_id.unwrap_or_else(|| "random_bot".to_string());
            let bots = state.bots();
            if bots.find(&bot_id).is_none() {
                let available_bots = bots.names().join(", ");
                return Err(bot_not_found_error(api_version, &bot_id, &available_bots));
            }
            Ok(Some(bot_id))
        }
    }
}

fn validate_coordinates(coords: &Coordinates, board_size: u32) -> Result<(), String> {
    if board_size == 0 {
        return Err("board size must be >= 1".to_string());
    }

    let max = board_size - 1;
    if coords.x() > max || coords.y() > max || coords.z() > max {
        return Err(format!(
            "components must be between 0 and {} for this board",
            max
        ));
    }

    let sum = coords.x() as u64 + coords.y() as u64 + coords.z() as u64;
    if sum != max as u64 {
        return Err(format!("x + y + z must equal {}", max));
    }

    Ok(())
}

fn build_game_state_response(
    api_version: &str,
    game_id: &str,
    session: &GameSession,
    requesting_player_id: Option<PlayerId>,
) -> GameStateResponse {
    let (game_over, next_player, winner) = match session.game.status() {
        GameStatus::Ongoing { next_player } => (false, Some(next_player.id()), None),
        GameStatus::Finished { winner } => (true, None, Some(winner.id())),
    };

    GameStateResponse {
        api_version: api_version.to_string(),
        game_id: game_id.to_string(),
        mode: match &session.bot_id {
            Some(_) => GameMode::HumanVsBot,
            None => GameMode::HumanVsHuman,
        },
        bot_id: session.bot_id.clone(),
        yen: (&session.game).into(),
        game_over,
        next_player,
        winner,
        completion_reason: session.completion_reason,
        player0_user_id: session.player0_user_id.clone(),
        player1_user_id: session.player1_user_id.clone(),
        opponent_inactivity_timeout_remaining_ms:
            calculate_opponent_inactivity_timeout_remaining_ms(
                session,
                requesting_player_id,
                Instant::now(),
            ),
        turn_timeout_remaining_ms: calculate_turn_timeout_remaining_ms(session, Instant::now()),
    }
}

fn calculate_opponent_inactivity_timeout_remaining_ms(
    session: &GameSession,
    requesting_player_id: Option<PlayerId>,
    now: Instant,
) -> Option<u64> {
    if session.game.check_game_over() {
        return None;
    }

    let requesting_player_id = requesting_player_id?;
    let last_seen_at_by_player_id = session.last_seen_at_by_player_id.as_ref()?;
    let opponent_player_id = if requesting_player_id.id() == 0 { 1 } else { 0 };
    let opponent_last_seen_at = last_seen_at_by_player_id
        .get(&opponent_player_id)
        .copied()
        .unwrap_or(session.created_at);
    let elapsed = now.saturating_duration_since(opponent_last_seen_at);
    let remaining = ONLINE_PLAYER_INACTIVITY_TIMEOUT.saturating_sub(elapsed);

    Some(remaining.as_millis().min(u128::from(u64::MAX)) as u64)
}

fn calculate_turn_timeout_remaining_ms(session: &GameSession, now: Instant) -> Option<u64> {
    if session.game.check_game_over() || session.player_tokens.is_none() {
        return None;
    }

    let turn_started_at = session.turn_started_at?;
    let elapsed = now.saturating_duration_since(turn_started_at);
    let remaining = ONLINE_TURN_TIMEOUT.saturating_sub(elapsed);

    Some(remaining.as_millis().min(u128::from(u64::MAX)) as u64)
}

fn error_response(message: &str, api_version: Option<String>) -> Json<ErrorResponse> {
    Json(ErrorResponse::error(message, api_version, None))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::YBotRegistry;
    use crate::bot_server::state::AppState;
    use std::collections::HashMap;
    use std::time::Duration;

    #[test]
    fn test_validate_coordinates_ok() {
        let coords = Coordinates::new(2, 0, 0);
        assert!(validate_coordinates(&coords, 3).is_ok());
    }

    #[test]
    fn test_validate_coordinates_wrong_sum() {
        let coords = Coordinates::new(1, 1, 1);
        assert!(validate_coordinates(&coords, 3).is_err());
    }

    #[test]
    fn test_validate_coordinates_out_of_range() {
        let coords = Coordinates::new(3, 0, 0);
        assert!(validate_coordinates(&coords, 3).is_err());
    }

    #[test]
    fn test_find_player_to_forfeit_for_inactivity_returns_inactive_player_only_when_opponent_is_recent()
     {
        let now = Instant::now();
        let mut last_seen_at_by_player_id = HashMap::new();
        last_seen_at_by_player_id.insert(1, now);

        let session = GameSession {
            game: GameY::new(3),
            bot_id: None,
            created_at: now
                .checked_sub(Duration::from_secs(61))
                .expect("instant subtraction should succeed"),
            turn_started_at: Some(now),
            player_tokens: Some(HashMap::from([
                (0, "player-0-token".to_string()),
                (1, "player-1-token".to_string()),
            ])),
            last_seen_at_by_player_id: Some(last_seen_at_by_player_id),
            player0_user_id: Some("fernando".to_string()),
            player1_user_id: Some("jose".to_string()),
            stats_reported: false,
            completion_reason: None,
        };

        let forfeiting_player =
            find_player_to_forfeit_for_inactivity(&session, now, Duration::from_secs(60));

        assert_eq!(forfeiting_player, Some(PlayerId::new(0)));
    }

    #[test]
    fn test_find_player_to_auto_pass_for_turn_timeout_returns_current_turn_player() {
        let now = Instant::now();
        let session = GameSession {
            game: GameY::new(3),
            bot_id: None,
            created_at: now,
            turn_started_at: Some(
                now.checked_sub(Duration::from_secs(61))
                    .expect("instant subtraction should succeed"),
            ),
            player_tokens: Some(HashMap::from([
                (0, "player-0-token".to_string()),
                (1, "player-1-token".to_string()),
            ])),
            last_seen_at_by_player_id: Some(HashMap::from([(0, now), (1, now)])),
            player0_user_id: Some("fernando".to_string()),
            player1_user_id: Some("jose".to_string()),
            stats_reported: false,
            completion_reason: None,
        };

        let timed_out_player =
            find_player_to_auto_pass_for_turn_timeout(&session, now, Duration::from_secs(60));

        assert_eq!(timed_out_player, Some(PlayerId::new(0)));
    }

    #[tokio::test]
    async fn test_ensure_user_id_is_available_for_new_game_rejects_existing_active_game() {
        let state = AppState::new(YBotRegistry::new());
        let active_game_id_by_user_id = state.active_game_id_by_user_id();
        active_game_id_by_user_id
            .write()
            .await
            .insert("fernando".to_string(), "game-7".to_string());

        let result = ensure_user_id_is_available_for_new_game(&state, Some("Fernando"), "v1").await;

        assert!(result.is_err());
    }
}
