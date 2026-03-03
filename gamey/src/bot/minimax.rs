//! A minimax bot implementation.
//!
//! This module provides [`MinimaxBot`], a bot that uses the minimax algorithm
//! with alpha-beta pruning to choose optimal moves.

use crate::{Coordinates, GameY, YBot};

/// A bot that uses the minimax algorithm to choose moves.
///
/// This bot evaluates positions using a heuristic and searches ahead
/// to find the best move, assuming optimal play by both sides.
pub struct MinimaxBot {
    max_depth: u32,
}

impl Default for MinimaxBot {
    fn default() -> Self {
        Self { max_depth: 3 } // Default depth
    }
}

impl MinimaxBot {
    /// Creates a new MinimaxBot with the specified search depth.
    pub fn new(max_depth: u32) -> Self {
        Self { max_depth }
    }

    /// Evaluates the board state for the current player.
    ///
    /// Positive scores favor the maximizing player, negative scores favor the minimizing player.
    fn evaluate_board(board: &GameY, player: crate::PlayerId) -> f64 {
        match board.status() {
            crate::GameStatus::Finished { winner } => {
                if *winner == player {
                    1000.0
                } else {
                    -1000.0
                }
            }
            crate::GameStatus::Ongoing { .. } => {
                // Simple heuristic: prefer positions with more available moves
                // and consider board control
                let available = board.available_cells().len() as f64;
                let total = (board.board_size() * (board.board_size() + 1) / 2) as f64;
                available / total * 100.0
            }
        }
    }

    /// Performs minimax search with alpha-beta pruning.
    fn minimax(
        &self,
        board: &GameY,
        depth: u32,
        maximizing: bool,
        player: crate::PlayerId,
        opponent: crate::PlayerId,
        mut alpha: f64,
        mut beta: f64,
    ) -> f64 {
        // Base case: max depth reached or game over
        if depth == 0 || matches!(board.status(), crate::GameStatus::Finished { .. }) {
            return Self::evaluate_board(board, player);
        }

        let current_player = if maximizing { player } else { opponent };
        let available_cells = board.available_cells();

        if maximizing {
            let mut max_eval = f64::NEG_INFINITY;
            for &cell_index in available_cells {
                let coords = Coordinates::from_index(cell_index, board.board_size());
                let mut new_board = board.clone();
                if new_board.add_move(crate::Movement::Placement {
                    player: current_player,
                    coords,
                }).is_ok() {
                    let eval = self.minimax(&new_board, depth - 1, false, player, opponent, alpha, beta);
                    max_eval = max_eval.max(eval);
                    alpha = alpha.max(eval);
                    if beta <= alpha {
                        break; // Beta cutoff
                    }
                }
            }
            max_eval
        } else {
            let mut min_eval = f64::INFINITY;
            for &cell_index in available_cells {
                let coords = Coordinates::from_index(cell_index, board.board_size());
                let mut new_board = board.clone();
                if new_board.add_move(crate::Movement::Placement {
                    player: current_player,
                    coords,
                }).is_ok() {
                    let eval = self.minimax(&new_board, depth - 1, true, player, opponent, alpha, beta);
                    min_eval = min_eval.min(eval);
                    beta = beta.min(eval);
                    if beta <= alpha {
                        break; // Alpha cutoff
                    }
                }
            }
            min_eval
        }
    }
}

impl YBot for MinimaxBot {
    fn name(&self) -> &str {
        "minimax_bot"
    }

    fn choose_move(&self, board: &GameY) -> Option<Coordinates> {
        let available_cells = board.available_cells();
        if available_cells.is_empty() {
            return None;
        }

        let current_player = match board.status() {
            crate::GameStatus::Ongoing { next_player } => *next_player,
            _ => return None,
        };

        let opponent = crate::other_player(current_player);

        let mut best_move = None;
        let mut best_value = f64::NEG_INFINITY;

        for &cell_index in available_cells {
            let coords = Coordinates::from_index(cell_index, board.board_size());
            let mut new_board = board.clone();
            if new_board.add_move(crate::Movement::Placement {
                player: current_player,
                coords,
            }).is_ok() {
                let value = self.minimax(&new_board, self.max_depth - 1, false, current_player, opponent, f64::NEG_INFINITY, f64::INFINITY);
                if value > best_value {
                    best_value = value;
                    best_move = Some(coords);
                }
            }
        }

        best_move
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::GameY;

    #[test]
    fn test_minimax_bot_name() {
        let bot = MinimaxBot::default();
        assert_eq!(bot.name(), "minimax_bot");
    }

    #[test]
    fn test_minimax_bot_chooses_move() {
        let bot = MinimaxBot::default();
        let game = GameY::new(3); // Small board for testing

        let chosen_move = bot.choose_move(&game);
        assert!(chosen_move.is_some());
    }

    #[test]
    fn test_minimax_bot_evaluate_win_and_loss() {
        let mut game = GameY::new(3);
        // create finished position where player 0 wins
        let moves = vec![
            crate::Movement::Placement { player: crate::PlayerId::new(0), coords: Coordinates::new(0, 0, 2) },
            crate::Movement::Placement { player: crate::PlayerId::new(1), coords: Coordinates::new(2, 0, 0) },
            crate::Movement::Placement { player: crate::PlayerId::new(0), coords: Coordinates::new(0, 1, 1) },
            crate::Movement::Placement { player: crate::PlayerId::new(1), coords: Coordinates::new(1, 1, 0) },
            crate::Movement::Placement { player: crate::PlayerId::new(0), coords: Coordinates::new(0, 2, 0) },
        ];
        for mv in moves {
            game.add_move(mv).unwrap();
        }
        assert!(matches!(game.status(), crate::GameStatus::Finished { winner } if *winner == crate::PlayerId::new(0)));

        let win_score = MinimaxBot::evaluate_board(&game, crate::PlayerId::new(0));
        let lose_score = MinimaxBot::evaluate_board(&game, crate::PlayerId::new(1));
        assert!(win_score >= 1000.0);
        assert!(lose_score <= -1000.0);
    }

    #[test]
    fn test_minimax_bot_returns_none_on_full_board() {
        let bot = MinimaxBot::default();
        let mut game = GameY::new(2);
        let fills = vec![
            crate::Movement::Placement { player: crate::PlayerId::new(0), coords: Coordinates::new(1, 0, 0) },
            crate::Movement::Placement { player: crate::PlayerId::new(1), coords: Coordinates::new(0, 1, 0) },
            crate::Movement::Placement { player: crate::PlayerId::new(0), coords: Coordinates::new(0, 0, 1) },
        ];
        for mv in fills {
            game.add_move(mv).unwrap();
        }
        assert!(game.available_cells().is_empty());
        assert!(bot.choose_move(&game).is_none());
    }

    #[test]
    fn test_minimax_bot_prefers_winning_move() {
        let bot = MinimaxBot::default();
        let mut game = GameY::new(3);
        let moves = vec![
            crate::Movement::Placement { player: crate::PlayerId::new(0), coords: Coordinates::new(0, 0, 2) },
            crate::Movement::Placement { player: crate::PlayerId::new(1), coords: Coordinates::new(2, 0, 0) },
            crate::Movement::Placement { player: crate::PlayerId::new(0), coords: Coordinates::new(0, 1, 1) },
            crate::Movement::Placement { player: crate::PlayerId::new(1), coords: Coordinates::new(1, 1, 0) },
        ];
        for mv in moves {
            game.add_move(mv).unwrap();
        }

        let chosen = bot.choose_move(&game).unwrap();
        assert_eq!(chosen, Coordinates::new(0, 2, 0));
    }
}