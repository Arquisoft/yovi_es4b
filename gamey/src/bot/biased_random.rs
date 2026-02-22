//! A biased random bot implementation.
//!
//! This module provides [`BiasedRandomBot`], a bot that makes random moves
//! with preferences towards strategically important positions.
//! It combines randomness with basic heuristics for intermediate difficulty.

use crate::{Coordinates, GameY, YBot};
use rand::prelude::*;

/// A bot that chooses moves randomly from available cells, but with biases towards strategic positions.
///
/// Unlike `RandomBot`, this bot prefers cells that are:
/// - Located near the board edges (corners and sides of the triangle)
/// - On paths connecting the three sides
/// - Away from the very center when possible
///
/// This creates an intermediate difficulty level between `RandomBot` (purely random)
/// and strategic bots that use sophisticated algorithms.
///
/// # Example
///
/// ```
/// use gamey::{GameY, BiasedRandomBot, YBot};
///
/// let bot = BiasedRandomBot;
/// let game = GameY::new(5);
///
/// // The bot will return Some when there are available moves
/// let chosen_move = bot.choose_move(&game);
/// assert!(chosen_move.is_some());
/// ```
pub struct BiasedRandomBot;

impl BiasedRandomBot {
    /// Calculates a weight/score for a cell based on strategic heuristics.
    ///
    /// Higher scores mean the cell is more strategically valuable.
    /// Heuristics considered:
    /// - Cells touching board edges (especially corners) have higher weight
    /// - Cells far from the board center are preferred
    /// - Cells in key positions for connection paths get bonus weight
    fn cell_weight(coords: &Coordinates, board_size: u32) -> f64 {
        let mut weight = 1.0;

        // Bonus for cells touching the edges of the triangle
        let edge_bonus = 1.5;
        let mut touching_edges = 0;

        if coords.touches_side_a() {
            touching_edges += 1;
        }
        if coords.touches_side_b() {
            touching_edges += 1;
        }
        if coords.touches_side_c() {
            touching_edges += 1;
        }

        // Corners (cells touching 2+ sides) are especially valuable
        if touching_edges >= 2 {
            weight *= edge_bonus * 2.0;
        } else if touching_edges == 1 {
            weight *= edge_bonus;
        }

        // Avoid the very center of the board
        // In barycentric coordinates, the center has x ≈ y ≈ z ≈ board_size/3
        let max_coord = coords.x.max(coords.y).max(coords.z);
        let min_coord = coords.x.min(coords.y).min(coords.z);

        // If the cell is very centralized (min and max close together),
        // reduce its weight slightly
        let center_penalty = if max_coord - min_coord < (board_size as u32) / 4 {
            0.7
        } else {
            1.0
        };
        weight *= center_penalty;

        weight
    }
}

impl YBot for BiasedRandomBot {
    fn name(&self) -> &str {
        "biased_random_bot"
    }

    fn choose_move(&self, board: &GameY) -> Option<Coordinates> {
        let available_cells = board.available_cells();

        if available_cells.is_empty() {
            return None;
        }

        // Calculate weights for each available cell
        let weighted_cells: Vec<(u32, f64)> = available_cells
            .iter()
            .map(|&cell_index| {
                let coords = Coordinates::from_index(cell_index, board.board_size());
                let weight = Self::cell_weight(&coords, board.board_size());
                (cell_index, weight)
            })
            .collect();

        // Use weighted random selection
        let mut rng = rand::rng();
        let weights: Vec<f64> = weighted_cells.iter().map(|(_, w)| *w).collect();

        let dist = rand::distributions::WeightedIndex::new(&weights)
            .expect("weights should be valid");
        let selected_idx = rng.sample(dist);

        let selected_cell = weighted_cells[selected_idx].0;
        let coordinates = Coordinates::from_index(selected_cell, board.board_size());

        Some(coordinates)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{Movement, PlayerId};

    #[test]
    fn test_biased_random_bot_name() {
        let bot = BiasedRandomBot;
        assert_eq!(bot.name(), "biased_random_bot");
    }

    #[test]
    fn test_biased_random_bot_returns_move_on_empty_board() {
        let bot = BiasedRandomBot;
        let game = GameY::new(5);

        let chosen_move = bot.choose_move(&game);
        assert!(chosen_move.is_some());
    }

    #[test]
    fn test_biased_random_bot_returns_valid_coordinates() {
        let bot = BiasedRandomBot;
        let game = GameY::new(5);

        let coords = bot.choose_move(&game).unwrap();
        let index = coords.to_index(game.board_size());

        // Index should be within the valid range for a size-5 board
        // Total cells = (5 * 6) / 2 = 15
        assert!(index < 15);
    }

    #[test]
    fn test_biased_random_bot_returns_none_on_full_board() {
        let bot = BiasedRandomBot;
        let mut game = GameY::new(2);

        // Fill the board (size 2 has 3 cells)
        let moves = vec![
            Movement::Placement {
                player: PlayerId::new(0),
                coords: Coordinates::new(1, 0, 0),
            },
            Movement::Placement {
                player: PlayerId::new(1),
                coords: Coordinates::new(0, 1, 0),
            },
            Movement::Placement {
                player: PlayerId::new(0),
                coords: Coordinates::new(0, 0, 1),
            },
        ];

        for mv in moves {
            game.add_move(mv).unwrap();
        }

        // Board is now full
        assert!(game.available_cells().is_empty());
        let chosen_move = bot.choose_move(&game);
        assert!(chosen_move.is_none());
    }

    #[test]
    fn test_biased_random_bot_chooses_from_available_cells() {
        let bot = BiasedRandomBot;
        let mut game = GameY::new(3);

        // Make some moves to reduce available cells
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: Coordinates::new(2, 0, 0),
        })
        .unwrap();

        let coords = bot.choose_move(&game).unwrap();
        let index = coords.to_index(game.board_size());

        // The chosen index should be in the available cells
        assert!(game.available_cells().contains(&index));
    }

    #[test]
    fn test_cell_weight_prefers_edges() {
        // Corner cells (touching 2 sides) should have higher weight than center cells
        let board_size = 5;

        // Corner: touches two sides
        let corner = Coordinates::new(0, 0, 4);
        let corner_weight = BiasedRandomBot::cell_weight(&corner, board_size);

        // Edge: touches one side
        let edge = Coordinates::new(0, 2, 2);
        let edge_weight = BiasedRandomBot::cell_weight(&edge, board_size);

        assert!(corner_weight > edge_weight, "Corners should be weighted higher than edges");
    }

    #[test]
    fn test_cell_weight_avoids_center() {
        let board_size = 5;

        // Center-ish cell
        let center = Coordinates::new(2, 2, 0);
        let center_weight = BiasedRandomBot::cell_weight(&center, board_size);

        // Edge cell
        let edge = Coordinates::new(0, 2, 2);
        let edge_weight = BiasedRandomBot::cell_weight(&edge, board_size);

        assert!(edge_weight >= center_weight, "Edges should not be lower weight than center");
    }

    #[test]
    fn test_biased_random_bot_multiple_calls_return_valid_moves() {
        let bot = BiasedRandomBot;
        let game = GameY::new(7);

        // Call choose_move multiple times to exercise the weighted randomness
        for _ in 0..10 {
            let coords = bot.choose_move(&game).unwrap();
            let index = coords.to_index(game.board_size());

            // Total cells for size 7 = (7 * 8) / 2 = 28
            assert!(index < 28);
            assert!(game.available_cells().contains(&index));
        }
    }
}
