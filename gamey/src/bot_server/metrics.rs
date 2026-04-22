use super::state::{AppState, MatchmakingTicketStatus};
use axum::{
    extract::{MatchedPath, Request, State},
    http::header,
    middleware::Next,
    response::{IntoResponse, Response},
};
use std::{
    collections::HashMap,
    fmt::Write,
    sync::{
        Mutex,
        atomic::{AtomicU64, Ordering},
    },
    time::{Duration, Instant},
};

const PROMETHEUS_CONTENT_TYPE: &str = "text/plain; version=0.0.4; charset=utf-8";
const SERVICE_NAME: &str = "gamey";

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
struct HttpMetricKey {
    method: String,
    route: String,
    status: u16,
}

#[derive(Clone, Debug, Default)]
struct HttpMetricValue {
    count: u64,
    duration_sum_seconds: f64,
}

pub struct AppMetrics {
    started_at: Instant,
    http_metrics: Mutex<HashMap<HttpMetricKey, HttpMetricValue>>,
    games_created_total: AtomicU64,
    moves_played_total: AtomicU64,
    resignations_total: AtomicU64,
    turn_passes_total: AtomicU64,
    matchmaking_enqueued_total: AtomicU64,
    matchmaking_cancelled_total: AtomicU64,
    stats_report_attempts_total: AtomicU64,
    stats_report_failures_total: AtomicU64,
}

impl AppMetrics {
    pub fn new() -> Self {
        Self {
            started_at: Instant::now(),
            http_metrics: Mutex::new(HashMap::new()),
            games_created_total: AtomicU64::new(0),
            moves_played_total: AtomicU64::new(0),
            resignations_total: AtomicU64::new(0),
            turn_passes_total: AtomicU64::new(0),
            matchmaking_enqueued_total: AtomicU64::new(0),
            matchmaking_cancelled_total: AtomicU64::new(0),
            stats_report_attempts_total: AtomicU64::new(0),
            stats_report_failures_total: AtomicU64::new(0),
        }
    }

    pub fn observe_http_request(
        &self,
        method: &str,
        route: &str,
        status: u16,
        duration: Duration,
    ) {
        let key = HttpMetricKey {
            method: method.to_string(),
            route: route.to_string(),
            status,
        };

        let mut guard = self
            .http_metrics
            .lock()
            .expect("http metrics mutex should not be poisoned");
        let entry = guard.entry(key).or_default();
        entry.count += 1;
        entry.duration_sum_seconds += duration.as_secs_f64();
    }

    pub fn inc_games_created(&self) {
        self.games_created_total.fetch_add(1, Ordering::Relaxed);
    }

    pub fn inc_moves_played(&self) {
        self.moves_played_total.fetch_add(1, Ordering::Relaxed);
    }

    pub fn inc_resignations(&self) {
        self.resignations_total.fetch_add(1, Ordering::Relaxed);
    }

    pub fn inc_turn_passes(&self) {
        self.turn_passes_total.fetch_add(1, Ordering::Relaxed);
    }

    pub fn inc_matchmaking_enqueued(&self) {
        self.matchmaking_enqueued_total.fetch_add(1, Ordering::Relaxed);
    }

    pub fn inc_matchmaking_cancelled(&self) {
        self.matchmaking_cancelled_total
            .fetch_add(1, Ordering::Relaxed);
    }

    pub fn inc_stats_report_attempts(&self) {
        self.stats_report_attempts_total
            .fetch_add(1, Ordering::Relaxed);
    }

    pub fn inc_stats_report_failures(&self) {
        self.stats_report_failures_total
            .fetch_add(1, Ordering::Relaxed);
    }

    pub async fn render(&self, state: &AppState) -> String {
        let http_metrics_snapshot = {
            let guard = self
                .http_metrics
                .lock()
                .expect("http metrics mutex should not be poisoned");
            guard
                .iter()
                .map(|(key, value)| (key.clone(), value.clone()))
                .collect::<Vec<_>>()
        };

        let (ongoing_games, finished_games_in_memory) = {
            let games = state.games();
            let guard = games.read().await;
            guard.values().fold((0_u64, 0_u64), |(ongoing, finished), session| {
                if session.game.check_game_over() {
                    (ongoing, finished + 1)
                } else {
                    (ongoing + 1, finished)
                }
            })
        };

        let (matchmaking_queue_size, waiting_tickets, matched_tickets, cancelled_tickets) = {
            let matchmaking = state.matchmaking();
            let guard = matchmaking.read().await;
            let mut waiting = 0_u64;
            let mut matched = 0_u64;
            let mut cancelled = 0_u64;

            for ticket in guard.tickets.values() {
                match ticket {
                    MatchmakingTicketStatus::Waiting { .. } => waiting += 1,
                    MatchmakingTicketStatus::Matched { .. } => matched += 1,
                    MatchmakingTicketStatus::Cancelled => cancelled += 1,
                }
            }

            (guard.queue.len() as u64, waiting, matched, cancelled)
        };

        let mut lines = Vec::new();

        append_metric_header(
            &mut lines,
            "yovi_process_uptime_seconds",
            "gauge",
            "Process uptime in seconds",
        );
        append_sample(
            &mut lines,
            "yovi_process_uptime_seconds",
            &[("service", SERVICE_NAME)],
            self.started_at.elapsed().as_secs_f64(),
        );

        append_metric_header(
            &mut lines,
            "yovi_http_requests_total",
            "counter",
            "HTTP requests handled by the service",
        );
        append_metric_header(
            &mut lines,
            "yovi_http_request_duration_seconds_sum",
            "counter",
            "Total HTTP request duration in seconds",
        );
        append_metric_header(
            &mut lines,
            "yovi_http_request_duration_seconds_count",
            "counter",
            "Number of HTTP requests observed for duration aggregation",
        );

        let mut http_metrics_snapshot = http_metrics_snapshot;
        http_metrics_snapshot.sort_by(|(left_key, _), (right_key, _)| {
            left_key
                .route
                .cmp(&right_key.route)
                .then_with(|| left_key.method.cmp(&right_key.method))
                .then_with(|| left_key.status.cmp(&right_key.status))
        });

        for (key, value) in http_metrics_snapshot {
            let status = key.status.to_string();
            let labels = [
                ("service", SERVICE_NAME),
                ("method", key.method.as_str()),
                ("route", key.route.as_str()),
                ("status", status.as_str()),
            ];

            append_sample(
                &mut lines,
                "yovi_http_requests_total",
                &labels,
                value.count,
            );
            append_sample(
                &mut lines,
                "yovi_http_request_duration_seconds_sum",
                &labels,
                value.duration_sum_seconds,
            );
            append_sample(
                &mut lines,
                "yovi_http_request_duration_seconds_count",
                &labels,
                value.count,
            );
        }

        append_metric_header(
            &mut lines,
            "yovi_gamey_ongoing_games",
            "gauge",
            "Number of ongoing games currently stored in memory",
        );
        append_sample(
            &mut lines,
            "yovi_gamey_ongoing_games",
            &[("service", SERVICE_NAME)],
            ongoing_games,
        );

        append_metric_header(
            &mut lines,
            "yovi_gamey_finished_games_in_memory",
            "gauge",
            "Number of finished games still present in memory",
        );
        append_sample(
            &mut lines,
            "yovi_gamey_finished_games_in_memory",
            &[("service", SERVICE_NAME)],
            finished_games_in_memory,
        );

        append_metric_header(
            &mut lines,
            "yovi_gamey_matchmaking_queue_size",
            "gauge",
            "Number of tickets waiting in the matchmaking queue",
        );
        append_sample(
            &mut lines,
            "yovi_gamey_matchmaking_queue_size",
            &[("service", SERVICE_NAME)],
            matchmaking_queue_size,
        );

        append_metric_header(
            &mut lines,
            "yovi_gamey_matchmaking_tickets",
            "gauge",
            "Matchmaking tickets by status",
        );
        append_sample(
            &mut lines,
            "yovi_gamey_matchmaking_tickets",
            &[("service", SERVICE_NAME), ("status", "waiting")],
            waiting_tickets,
        );
        append_sample(
            &mut lines,
            "yovi_gamey_matchmaking_tickets",
            &[("service", SERVICE_NAME), ("status", "matched")],
            matched_tickets,
        );
        append_sample(
            &mut lines,
            "yovi_gamey_matchmaking_tickets",
            &[("service", SERVICE_NAME), ("status", "cancelled")],
            cancelled_tickets,
        );

        append_counter_sample(
            &mut lines,
            "yovi_gamey_games_created_total",
            "Games created through the HTTP API",
            self.games_created_total.load(Ordering::Relaxed),
        );
        append_counter_sample(
            &mut lines,
            "yovi_gamey_moves_played_total",
            "Move requests applied through the HTTP API",
            self.moves_played_total.load(Ordering::Relaxed),
        );
        append_counter_sample(
            &mut lines,
            "yovi_gamey_resignations_total",
            "Resign actions applied to games",
            self.resignations_total.load(Ordering::Relaxed),
        );
        append_counter_sample(
            &mut lines,
            "yovi_gamey_turn_passes_total",
            "Turn pass actions applied to games",
            self.turn_passes_total.load(Ordering::Relaxed),
        );
        append_counter_sample(
            &mut lines,
            "yovi_gamey_matchmaking_enqueued_total",
            "Matchmaking enqueue requests accepted",
            self.matchmaking_enqueued_total.load(Ordering::Relaxed),
        );
        append_counter_sample(
            &mut lines,
            "yovi_gamey_matchmaking_cancelled_total",
            "Matchmaking tickets cancelled by clients",
            self.matchmaking_cancelled_total.load(Ordering::Relaxed),
        );
        append_counter_sample(
            &mut lines,
            "yovi_gamey_stats_report_attempts_total",
            "Attempts to notify the stats service about finished matches",
            self.stats_report_attempts_total.load(Ordering::Relaxed),
        );
        append_counter_sample(
            &mut lines,
            "yovi_gamey_stats_report_failures_total",
            "Failed attempts to notify the stats service about finished matches",
            self.stats_report_failures_total.load(Ordering::Relaxed),
        );

        format!("{}\n", lines.join("\n"))
    }
}

pub async fn track_http_metrics(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Response {
    let method = request.method().clone();
    let route = request
        .extensions()
        .get::<MatchedPath>()
        .map(MatchedPath::as_str)
        .map(str::to_string)
        .unwrap_or_else(|| normalize_path(request.uri().path()));

    if route == "/metrics" {
        return next.run(request).await;
    }

    let started_at = Instant::now();
    let response = next.run(request).await;

    state.metrics().observe_http_request(
        method.as_str(),
        &route,
        response.status().as_u16(),
        started_at.elapsed(),
    );

    response
}

pub async fn render_metrics(State(state): State<AppState>) -> impl IntoResponse {
    let body = state.metrics().render(&state).await;
    ([(header::CONTENT_TYPE, PROMETHEUS_CONTENT_TYPE)], body)
}

fn normalize_path(path: &str) -> String {
    let normalized_segments = path
        .split('/')
        .filter(|segment| !segment.is_empty())
        .map(normalize_segment)
        .collect::<Vec<_>>();

    if normalized_segments.is_empty() {
        "/".to_string()
    } else {
        format!("/{}", normalized_segments.join("/"))
    }
}

fn normalize_segment(segment: &str) -> String {
    if segment.chars().all(|ch| ch.is_ascii_digit()) {
        return ":id".to_string();
    }

    if matches_identifier_pattern(segment) {
        return ":id".to_string();
    }

    segment.to_string()
}

fn matches_identifier_pattern(segment: &str) -> bool {
    let lower = segment.to_ascii_lowercase();
    lower.starts_with("game-")
        || lower.starts_with("ticket-")
        || lower.starts_with("ptk-")
        || (segment.len() >= 8
            && segment
                .chars()
                .all(|ch| ch.is_ascii_hexdigit() || ch == '-'))
}

fn append_counter_sample(lines: &mut Vec<String>, name: &str, help: &str, value: u64) {
    append_metric_header(lines, name, "counter", help);
    append_sample(lines, name, &[("service", SERVICE_NAME)], value);
}

fn append_metric_header(lines: &mut Vec<String>, name: &str, kind: &str, help: &str) {
    lines.push(format!("# HELP {} {}", name, help));
    lines.push(format!("# TYPE {} {}", name, kind));
}

fn append_sample<T>(lines: &mut Vec<String>, name: &str, labels: &[(&str, &str)], value: T)
where
    T: std::fmt::Display,
{
    lines.push(format!("{}{} {}", name, format_labels(labels), value));
}

fn format_labels(labels: &[(&str, &str)]) -> String {
    if labels.is_empty() {
        return String::new();
    }

    let mut rendered = String::from("{");
    for (index, (key, value)) in labels.iter().enumerate() {
        if index > 0 {
            rendered.push(',');
        }
        let _ = write!(rendered, r#"{}="{}""#, key, escape_label_value(value));
    }
    rendered.push('}');
    rendered
}

fn escape_label_value(value: &str) -> String {
    value
        .replace('\\', r"\\")
        .replace('\n', r"\n")
        .replace('"', r#"\""#)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_path_replaces_dynamic_identifiers() {
        assert_eq!(
            normalize_path("/v1/games/game-42/moves"),
            "/v1/games/:id/moves"
        );
        assert_eq!(
            normalize_path("/v1/matchmaking/tickets/ticket-7/cancel"),
            "/v1/matchmaking/tickets/:id/cancel"
        );
    }

    #[test]
    fn test_escape_label_value_escapes_prometheus_special_characters() {
        assert_eq!(escape_label_value("line\"one\\two"), "line\\\"one\\\\two");
    }
}
