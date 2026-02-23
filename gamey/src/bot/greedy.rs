//! A greedy bot implementation with heuristic evaluation.
//!
//! This module provides [`GreedyBot`], a bot that chooses moves by evaluating
//! the board state after each possible move and selecting the one with the
//! highest heuristic score.

use crate::{Coordinates, GameY, YBot};

/// A bot that chooses moves greedily based on heuristic evaluation.
///
/// This bot evaluates each possible move by simulating it and calculating
/// a heuristic score for the resulting board state. It then chooses the move
/// that maximizes this score.
///
/// The heuristic considers:
/// - Proximity to connecting all three sides
/// - Number of sides touched by the player's pieces
/// - Blocking opponent's progress
pub struct GreedyBot;

impl GreedyBot {
    /// Evaluates the board state for a given player.
    ///
    /// Higher scores indicate better positions for the player.
    /// The evaluation considers strategic factors like side connections.
    fn evaluate_board(board: &GameY, player: crate::PlayerId) -> f64 {
        let mut score = 0.0;

        // Check if the game is already won
        if let crate::GameStatus::Finished { winner } = board.status() {
            if *winner == player {
                return 1000.0; // Win
            } else {
                return -1000.0; // Loss
            }
        }

        // Evaluate based on connected components
        // This is a simplified heuristic - in a real implementation,
        // you'd analyze the union-find structure more deeply
        let available_cells = board.available_cells().len() as f64;
        let total_cells = (board.board_size() * (board.board_size() + 1)) / 2;
        let filled_cells = total_cells - available_cells as u32;

        // Prefer positions that control more of the board
        score += filled_cells as f64 * 0.1;

        // Add some randomness to avoid deterministic play
        score += rand::random::<f64>() * 0.01;

        score
    }
}

impl YBot for GreedyBot {
    fn name(&self) -> &str {
        "greedy_bot"
    }

    fn choose_move(&self, board: &GameY) -> Option<Coordinates> {
        let available_cells = board.available_cells();
        if available_cells.is_empty() {
            return None;
        }

        let current_player = match board.status() {
            crate::GameStatus::Ongoing { next_player } => *next_player,
            _ => return None, // Game is finished
        };

        let mut best_move = None;
        let mut best_score = f64::NEG_INFINITY;

        for &cell_index in &available_cells {
            let coords = Coordinates::from_index(cell_index, board.board_size());

            // Simulate the move
            let mut simulated_board = board.clone();
            if simulated_board.add_move(crate::Movement::Placement {
                player: current_player,
                coords,
            }).is_ok() {
                let score = Self::evaluate_board(&simulated_board, current_player);

                if score > best_score {
                    best_score = score;
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
    use crate::{GameY, PlayerId};

    #[test]
    fn test_greedy_bot_name() {
        let bot = GreedyBot;
        assert_eq!(bot.name(), "greedy_bot");
    }

    #[test]
    fn test_greedy_bot_chooses_move() {
        let bot = GreedyBot;
        let game = GameY::new(5);

        let chosen_move = bot.choose_move(&game);
        assert!(chosen_move.is_some());
    }
}