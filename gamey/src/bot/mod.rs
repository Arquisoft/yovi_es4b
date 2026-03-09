//! Bot module for the Game of Y.
//!
//! This module provides the infrastructure for creating and managing AI bots
//! that can play the Game of Y. It includes:
//!
//! - [`YBot`] - A trait that defines the interface for all bots
//! - [`YBotRegistry`] - A registry for managing multiple bot implementations
//! - [`RandomBot`] - A simple bot that makes random valid moves
//! - [`BiasedRandomBot`] - A bot that prefers strategically important positions
//! - [`GreedyBot`] - A bot that chooses moves greedily based on heuristic evaluation
//! - [`MinimaxBot`] - A bot that uses the minimax algorithm

pub mod biased_random;
pub mod greedy;
pub mod minimax;
pub mod random;
pub mod ybot;
pub mod ybot_registry;
pub use biased_random::*;
pub use greedy::*;
pub use minimax::*;
pub use random::*;
pub use ybot::*;
pub use ybot_registry::*;
