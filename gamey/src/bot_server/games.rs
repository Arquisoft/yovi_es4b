use super::{
    error::ErrorResponse,
    state::{AppState, GameSession},
    version::check_api_version,
};
use crate::{Coordinates, GameAction, GameStatus, GameY, Movement, PlayerId, YEN};
use axum::{
    Json,
    extract::{Path, State},
};
use serde::{Deserialize, Serialize};

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
    let session = GameSession {
        game: GameY::new(request.size),
        bot_id: bot_id.clone(),
    };

    let game_id = state.new_game_id();
    let response = build_game_state_response(&params.api_version, &game_id, &session);

    let games = state.games();
    games.write().await.insert(game_id, session);

    Ok(Json(response))
}

/// Returns the current state of a game.
///
/// # Route
/// `GET /{api_version}/games/{game_id}`
pub async fn get_game(
    State(state): State<AppState>,
    Path(params): Path<GameParams>,
) -> Result<Json<GameStateResponse>, Json<ErrorResponse>> {
    check_api_version(&params.api_version)?;

    let games = state.games();
    let guard = games.read().await;
    let session = match guard.get(&params.game_id) {
        Some(session) => session,
        None => {
            return Err(error_response(
                &format!("Game not found: {}", params.game_id),
                Some(params.api_version),
            ));
        }
    };

    Ok(Json(build_game_state_response(
        &params.api_version,
        &params.game_id,
        session,
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

    let session = match guard.get_mut(&params.game_id) {
        Some(session) => session,
        None => {
            return Err(error_response(
                &format!("Game not found: {}", params.game_id),
                Some(params.api_version),
            ));
        }
    };

    if session.game.check_game_over() {
        return Err(error_response(
            "Game is already finished",
            Some(params.api_version),
        ));
    }

    validate_coordinates(&request.coords, session.game.board_size()).map_err(|msg| {
        error_response(
            &format!("Invalid coordinates: {}", msg),
            Some(params.api_version.clone()),
        )
    })?;

    let current_player = match session.game.next_player() {
        Some(player) => player,
        None => {
            return Err(error_response(
                "Game is already finished",
                Some(params.api_version),
            ));
        }
    };

    if session.bot_id.is_some() && current_player != PlayerId::new(0) {
        return Err(error_response(
            "Human moves are only allowed on player 0 turn in human_vs_bot mode",
            Some(params.api_version),
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
                return Err(error_response(
                    &format!(
                        "Bot not found: {}, available bots: [{}]",
                        bot_id, available_bots
                    ),
                    Some(params.api_version),
                ));
            }
        };

        let bot_coords = match bot.choose_move(&session.game) {
            Some(coords) => coords,
            None => {
                return Err(error_response(
                    "No valid moves available for the bot",
                    Some(params.api_version),
                ));
            }
        };

        let bot_player = match session.game.next_player() {
            Some(player) => player,
            None => {
                return Ok(Json(build_game_state_response(
                    &params.api_version,
                    &params.game_id,
                    session,
                )));
            }
        };

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

    Ok(Json(build_game_state_response(
        &params.api_version,
        &params.game_id,
        session,
    )))
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
) -> Result<Json<GameStateResponse>, Json<ErrorResponse>> {
    check_api_version(&params.api_version)?;

    let games = state.games();
    let mut guard = games.write().await;

    let session = match guard.get_mut(&params.game_id) {
        Some(session) => session,
        None => {
            return Err(error_response(
                &format!("Game not found: {}", params.game_id),
                Some(params.api_version),
            ));
        }
    };

    if session.game.check_game_over() {
        return Err(error_response(
            "Game is already finished",
            Some(params.api_version),
        ));
    }

    let resigning_player = match (&session.bot_id, session.game.next_player()) {
        (Some(_), _) => PlayerId::new(0),
        (None, Some(player)) => player,
        (None, None) => {
            return Err(error_response(
                "Game is already finished",
                Some(params.api_version),
            ));
        }
    };

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

    Ok(Json(build_game_state_response(
        &params.api_version,
        &params.game_id,
        session,
    )))
}

fn default_board_size() -> u32 {
    7
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
                return Err(error_response(
                    &format!(
                        "Bot not found: {}, available bots: [{}]",
                        bot_id, available_bots
                    ),
                    Some(api_version.to_string()),
                ));
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
    }
}

fn error_response(message: &str, api_version: Option<String>) -> Json<ErrorResponse> {
    Json(ErrorResponse::error(message, api_version, None))
}

#[cfg(test)]
mod tests {
    use super::*;

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
}
