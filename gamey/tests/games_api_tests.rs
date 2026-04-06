use axum::{
    body::Body,
    http::{Method, Request, StatusCode},
};
use gamey::{create_default_state, create_router};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use tower::ServiceExt;

fn test_app() -> axum::Router {
    create_router(create_default_state())
}

async fn request_json(
    app: &axum::Router,
    method: Method,
    uri: &str,
    body: Option<Value>,
) -> (StatusCode, Value) {
    request_json_with_headers(app, method, uri, body, &[]).await
}

async fn request_json_with_headers(
    app: &axum::Router,
    method: Method,
    uri: &str,
    body: Option<Value>,
    headers: &[(&str, &str)],
) -> (StatusCode, Value) {
    let mut builder = Request::builder().method(method).uri(uri);
    for (name, value) in headers {
        builder = builder.header(*name, *value);
    }

    let request = match body {
        Some(payload) => {
            builder = builder.header("content-type", "application/json");
            builder
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap()
        }
        None => builder.body(Body::empty()).unwrap(),
    };

    let response = app.clone().oneshot(request).await.unwrap();
    let status = response.status();

    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    let body = if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice(&bytes).unwrap()
    };

    (status, body)
}

// Test: create and get human vs human game.
#[tokio::test]
async fn create_and_get_human_vs_human_game() {
    let app = test_app();

    let (create_status, created) = request_json(
        &app,
        Method::POST,
        "/v1/games",
        Some(json!({
            "size": 3,
            "mode": "human_vs_human"
        })),
    )
    .await;

    assert_eq!(create_status, StatusCode::OK);
    assert_eq!(created["api_version"], "v1");
    assert_eq!(created["mode"], "human_vs_human");
    assert_eq!(created["bot_id"], Value::Null);
    assert_eq!(created["game_over"], false);
    assert_eq!(created["next_player"], 0);

    let game_id = created["game_id"].as_str().unwrap().to_string();

    let (get_status, fetched) =
        request_json(&app, Method::GET, &format!("/v1/games/{game_id}"), None).await;

    assert_eq!(get_status, StatusCode::OK);
    assert_eq!(fetched["game_id"].as_str(), Some(game_id.as_str()));
    assert_eq!(fetched["mode"], "human_vs_human");
    assert_eq!(fetched["next_player"], 0);
}

#[tokio::test]
async fn create_game_exposes_player_user_ids_from_headers() {
    let app = test_app();

    let (create_status, created) = request_json_with_headers(
        &app,
        Method::POST,
        "/v1/games",
        Some(json!({
            "size": 3,
            "mode": "human_vs_human"
        })),
        &[("x-user-id", "fernando"), ("x-opponent-user-id", "jose")],
    )
    .await;

    assert_eq!(create_status, StatusCode::OK);
    assert_eq!(created["player0_user_id"], "fernando");
    assert_eq!(created["player1_user_id"], "jose");

    let game_id = created["game_id"].as_str().unwrap().to_string();
    let (get_status, fetched) =
        request_json(&app, Method::GET, &format!("/v1/games/{game_id}"), None).await;

    assert_eq!(get_status, StatusCode::OK);
    assert_eq!(fetched["player0_user_id"], "fernando");
    assert_eq!(fetched["player1_user_id"], "jose");
}

#[tokio::test]
async fn create_game_rejects_second_active_game_for_same_user() {
    let app = test_app();

    let (first_status, _) = request_json_with_headers(
        &app,
        Method::POST,
        "/v1/games",
        Some(json!({
            "size": 3,
            "mode": "human_vs_bot"
        })),
        &[("x-user-id", "fernando")],
    )
    .await;

    assert_eq!(first_status, StatusCode::OK);

    let (second_status, second_body) = request_json_with_headers(
        &app,
        Method::POST,
        "/v1/games",
        Some(json!({
            "size": 3,
            "mode": "human_vs_bot"
        })),
        &[("x-user-id", "fernando")],
    )
    .await;

    assert_eq!(second_status, StatusCode::OK);
    assert!(
        second_body["message"]
            .as_str()
            .unwrap()
            .contains("already has an active game")
    );
}

// Test: create game rejects size zero.
#[tokio::test]
async fn create_game_rejects_size_zero() {
    let app = test_app();

    let (status, body) = request_json(
        &app,
        Method::POST,
        "/v1/games",
        Some(json!({
            "size": 0,
            "mode": "human_vs_human"
        })),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert!(
        body["message"]
            .as_str()
            .unwrap()
            .contains("Board size must be >= 1")
    );
}

// Test: create human vs human rejects bot id.
#[tokio::test]
async fn create_human_vs_human_rejects_bot_id() {
    let app = test_app();

    let (status, body) = request_json(
        &app,
        Method::POST,
        "/v1/games",
        Some(json!({
            "size": 3,
            "mode": "human_vs_human",
            "bot_id": "random_bot"
        })),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert!(
        body["message"]
            .as_str()
            .unwrap()
            .contains("bot_id is only valid in human_vs_bot mode")
    );
}

// Test: play move updates turn in human vs human game.
#[tokio::test]
async fn play_move_updates_turn_in_human_vs_human_game() {
    let app = test_app();

    let (_, created) = request_json(
        &app,
        Method::POST,
        "/v1/games",
        Some(json!({
            "size": 3,
            "mode": "human_vs_human"
        })),
    )
    .await;

    let game_id = created["game_id"].as_str().unwrap();

    let (move_status, moved) = request_json(
        &app,
        Method::POST,
        &format!("/v1/games/{game_id}/moves"),
        Some(json!({
            "coords": { "x": 2, "y": 0, "z": 0 }
        })),
    )
    .await;

    assert_eq!(move_status, StatusCode::OK);
    assert_eq!(moved["game_over"], false);
    assert_eq!(moved["next_player"], 1);

    let (_, fetched) = request_json(&app, Method::GET, &format!("/v1/games/{game_id}"), None).await;

    assert_eq!(fetched["next_player"], 1);
}

// Test: play move rejects invalid coordinates.
#[tokio::test]
async fn play_move_rejects_invalid_coordinates() {
    let app = test_app();

    let (_, created) = request_json(
        &app,
        Method::POST,
        "/v1/games",
        Some(json!({
            "size": 3,
            "mode": "human_vs_human"
        })),
    )
    .await;

    let game_id = created["game_id"].as_str().unwrap();

    let (status, body) = request_json(
        &app,
        Method::POST,
        &format!("/v1/games/{game_id}/moves"),
        Some(json!({
            "coords": { "x": 2, "y": 1, "z": 0 }
        })),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert!(
        body["message"]
            .as_str()
            .unwrap()
            .contains("Invalid coordinates")
    );
}

// Test: play move returns error when game does not exist.
#[tokio::test]
async fn play_move_returns_error_when_game_does_not_exist() {
    let app = test_app();

    let (status, body) = request_json(
        &app,
        Method::POST,
        "/v1/games/game-404/moves",
        Some(json!({
            "coords": { "x": 2, "y": 0, "z": 0 }
        })),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert!(body["message"].as_str().unwrap().contains("Game not found"));
}

#[tokio::test]
async fn hint_game_returns_suggestion_for_human_turn() {
    let app = test_app();

    let (_, created) = request_json(
        &app,
        Method::POST,
        "/v1/games",
        Some(json!({
            "size": 3,
            "mode": "human_vs_bot",
            "bot_id": "random_bot"
        })),
    )
    .await;

    let game_id = created["game_id"].as_str().unwrap();
    let (status, body) = request_json(
        &app,
        Method::POST,
        &format!("/v1/games/{game_id}/hint"),
        None,
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["game_id"].as_str(), Some(game_id));
    assert!(body["coords"].get("x").is_some());
    assert!(body["coords"].get("y").is_some());
    assert!(body["coords"].get("z").is_some());
}

#[tokio::test]
async fn pass_turn_updates_turn_in_human_vs_human_game() {
    let app = test_app();

    let (_, created) = request_json(
        &app,
        Method::POST,
        "/v1/games",
        Some(json!({
            "size": 3,
            "mode": "human_vs_human"
        })),
    )
    .await;

    let game_id = created["game_id"].as_str().unwrap();
    let (status, passed) = request_json(
        &app,
        Method::POST,
        &format!("/v1/games/{game_id}/pass"),
        None,
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(passed["game_over"], false);
    assert_eq!(passed["next_player"], 1);
}

#[tokio::test]
async fn hint_game_rejects_hint_when_bot_turn_in_human_vs_bot() {
    let app = test_app();

    let (_, created) = request_json(
        &app,
        Method::POST,
        "/v1/games",
        Some(json!({
            "size": 3,
            "mode": "human_vs_bot",
            "bot_id": "random_bot"
        })),
    )
    .await;

    let game_id = created["game_id"].as_str().unwrap();

    // Force a bot move by making a human move first.
    let (_, _) = request_json(
        &app,
        Method::POST,
        &format!("/v1/games/{game_id}/moves"),
        Some(json!({
            "coords": { "x": 2, "y": 0, "z": 0 }
        })),
    )
    .await;

    let (status, body) = request_json(
        &app,
        Method::POST,
        &format!("/v1/games/{game_id}/hint"),
        None,
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert!(body["message"]
        .as_str()
        .unwrap()
        .contains("Hint is only available"));
}
