use crate::core::SetIdx;
use crate::core::player_set::PlayerSet;
use crate::{Coordinates, GameAction, GameYError, Movement, PlayerId, RenderOptions, YEN};
use std::collections::HashMap;
use std::fmt::Write;
use std::path::Path;

/// A Result type alias for game operations that may fail with a `GameYError`.
pub type Result<T> = std::result::Result<T, crate::GameYError>;

/// The main game state for a Y game.
///
/// Y is a connection game played on a triangular board where players
/// take turns placing pieces. The goal is to connect all three sides
/// of the triangle with a single chain of connected pieces.
#[derive(Debug, Clone)]
pub struct GameY {
    // Size of the board (length of one side of the triangular board).
    board_size: u32,

    // Mapping from coordinates to identifiers of players who placed stones there.
    board_map: HashMap<Coordinates, (SetIdx, PlayerId)>,

    status: GameStatus,

    // History of moves made in the game.
    history: Vec<Movement>,

    // Union-Find data structure to track connected components for each player
    sets: Vec<PlayerSet>,

    available_cells: Vec<u32>,
}

/// Represents the state of a single cell on the board.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Cell {
    /// The cell has no piece.
    Empty,
    /// The cell is occupied by a piece belonging to the specified player.
    Occupied(PlayerId),
}

impl GameY {
    /// Creates a new game with the specified board size and number of players.
    pub fn new(board_size: u32) -> Self {
        let total_cells = (board_size * (board_size + 1)) / 2;
        Self {
            board_size,
            board_map: HashMap::new(),
            history: Vec::new(),
            sets: Vec::new(),
            status: GameStatus::Ongoing {
                next_player: PlayerId::new(0),
            },
            available_cells: (0..total_cells).collect(),
        }
    }

    /// Returns the current game status.
    pub fn status(&self) -> &GameStatus {
        &self.status
    }

    /// Returns true if the game has ended (has a winner).
    pub fn check_game_over(&self) -> bool {
        matches!(self.status, GameStatus::Finished { .. })
    }

    /// Returns the list of available cell indices where pieces can be placed.
    pub fn available_cells(&self) -> &Vec<u32> {
        &self.available_cells
    }

    /// Returns the total number of cells on the board.
    pub fn total_cells(&self) -> u32 {
        (self.board_size * (self.board_size + 1)) / 2
    }

    /// Checks if the movement is made by the correct player.
    ///
    /// Returns an error if it's not the specified player's turn.
    pub fn check_player_turn(&self, movement: &Movement) -> Result<()> {
        if let GameStatus::Ongoing { next_player } = self.status {
            let player = match movement {
                Movement::Placement { player, .. } => *player,
                Movement::Action { player, .. } => *player,
            };
            if player != next_player {
                return Err(GameYError::InvalidPlayerTurn {
                    expected: next_player,
                    found: player,
                });
            }
        }
        Ok(())
    }

    /// Returns the player who should make the next move, or None if the game is over.
    pub fn next_player(&self) -> Option<PlayerId> {
        if let GameStatus::Ongoing { next_player } = self.status {
            Some(next_player)
        } else {
            None
        }
    }

    /// Loads a game state from a YEN format file.
    pub fn load_from_file<P: AsRef<Path>>(path: P) -> Result<Self> {
        let filename = path.as_ref().display().to_string();
        let file_content = std::fs::read_to_string(path).map_err(|e| GameYError::IoError {
            message: format!("Failed to read file: {}", filename),
            error: e.to_string(),
        })?;
        let yen: YEN =
            serde_json::from_str(&file_content).map_err(|e| GameYError::SerdeError { error: e })?;
        GameY::try_from(yen)
    }

    /// Saves the game state to a file in YEN format.
    pub fn save_to_file<P: AsRef<Path>>(&self, path: P) -> Result<()> {
        let yen: YEN = self.into();
        let json_content =
            serde_json::to_string_pretty(&yen).map_err(|e| GameYError::SerdeError { error: e })?;
        let filename = path.as_ref().display().to_string();
        std::fs::write(path, json_content).map_err(|e| GameYError::IoError {
            message: format!("Failed to write file: {}", filename),
            error: e.to_string(),
        })?;
        Ok(())
    }

    /// Adds a move to the game.
    pub fn add_move(&mut self, movement: Movement) -> Result<()> {
        match &movement {
            Movement::Placement { player, coords } => {
                self.handle_placement(*player, *coords)?;
            }
            Movement::Action { player, action } => {
                self.handle_action(*player, action);
            }
        }
        self.history.push(movement);
        Ok(())
    }

    /// Orchestrates the placement logic
    fn handle_placement(&mut self, player: PlayerId, coords: Coordinates) -> Result<()> {
        self.validate_placement(player, coords)?;

        // Update board state (available cells, sets, board_map)
        let set_idx = self.register_piece(player, coords);

        // Connect neighbors and determine if this move won the game
        let won = self.connect_neighbors_and_check_win(coords, player, set_idx);

        self.update_status_after_placement(player, won);
        Ok(())
    }

    /// Iterates over neighbors to union sets and checks for a win condition
    fn connect_neighbors_and_check_win(
        &mut self,
        coords: Coordinates,
        player: PlayerId,
        current_set_idx: usize,
    ) -> bool {
        // Base win condition: The piece itself touches all required sides
        let mut won = self.sets[current_set_idx].is_winning_configuration();

        //
        let neighbors = self.get_neighbors(&coords);

        for neighbor in neighbors {
            if let Some((neighbor_idx, neighbor_player)) = self.board_map.get(&neighbor) {
                if *neighbor_player == player {
                    // Union returns true if the merge resulted in a winning connection
                    //
                    let connection_won = self.union(current_set_idx, *neighbor_idx);
                    won = won || connection_won;
                }
            }
        }
        won
    }

    /// Updates the game status (Finished vs Ongoing)
    fn update_status_after_placement(&mut self, player: PlayerId, won: bool) {
        if self.check_game_over() {
            tracing::info!("Game was already over. Move ignored for status update.");
        } else if won {
            tracing::debug!("Player {} wins the game!", player);
            self.finish_with_winner(player);
        } else {
            self.advance_to_other_player(player);
        }
    }

    /// Handles non-placement actions (Resign, Swap, etc.)
    fn handle_action(&mut self, player: PlayerId, action: &GameAction) {
        match action {
            GameAction::Resign => self.finish_with_winner(other_player(player)),
            GameAction::Swap | GameAction::PassTurn => self.advance_to_other_player(player),
        }
    }

    /// Handles validation logic (Game Over checks and Occupancy)
    fn validate_placement(&self, player: PlayerId, coords: Coordinates) -> Result<()> {
        if self.check_game_over() {
            tracing::info!("Game is already over. Move at {} could be ignored", coords);
        }

        if self.board_map.contains_key(&coords) {
            return Err(GameYError::Occupied {
                coordinates: coords,
                player,
            });
        }
        Ok(())
    }

    /// Updates internal data structures (Available cells, Sets, Map)
    /// Returns the index of the newly created set.
    fn register_piece(&mut self, player: PlayerId, coords: Coordinates) -> usize {
        let cell_idx = coords.to_index(self.board_size);
        self.available_cells.retain(|&x| x != cell_idx);

        let set_idx = self.sets.len();
        let new_set = PlayerSet {
            parent: set_idx,
            touches_side_a: coords.touches_side_a(),
            touches_side_b: coords.touches_side_b(),
            touches_side_c: coords.touches_side_c(),
        };
        self.sets.push(new_set);
        self.board_map.insert(coords, (set_idx, player));

        set_idx
    }

    fn finish_with_winner(&mut self, winner: PlayerId) {
        self.status = GameStatus::Finished { winner };
    }

    fn advance_to_other_player(&mut self, current_player: PlayerId) {
        self.status = GameStatus::Ongoing {
            next_player: other_player(current_player),
        };
    }

    /// Returns the size of the board (length of one side of the triangle).
    pub fn board_size(&self) -> u32 {
        self.board_size
    }

    /// Returns the neighboring coordinates for a given cell.
    fn get_neighbors(&self, coords: &Coordinates) -> Vec<Coordinates> {
        let mut neighbors = Vec::new();
        let x = coords.x();
        let y = coords.y();
        let z = coords.z();

        if x > 0 {
            neighbors.push(Coordinates::new(x - 1, y + 1, z));
            neighbors.push(Coordinates::new(x - 1, y, z + 1));
        }
        if y > 0 {
            neighbors.push(Coordinates::new(x + 1, y - 1, z));
            neighbors.push(Coordinates::new(x, y - 1, z + 1));
        }
        if z > 0 {
            neighbors.push(Coordinates::new(x + 1, y, z - 1));
            neighbors.push(Coordinates::new(x, y + 1, z - 1));
        }
        neighbors
    }

    /// Renders the current state of the board as a text string.
    /// If `show_coordinates` is true, the coordinates of each cell will be displayed.
    pub fn render(&self, options: &RenderOptions) -> String {
        let mut result = String::new();
        let coords_size = self.board_size.to_string().len();
        let _ = writeln!(result, "--- Game of Y (Size {}) ---", self.board_size);

        let indent_multiplier = self.get_indent_multiplier(options);

        for row in 0..self.board_size {
            let x = self.board_size - 1 - row;
            indent(&mut result, x * indent_multiplier);

            for y in 0..=row {
                let z = row - y;
                let coords = Coordinates::new(x, y, z);
                let cell_str = self.format_cell(coords, options, coords_size);
                let _ = write!(result, "{}   ", cell_str);
            }

            result.push('\n');
            if options.show_idx || options.show_3d_coords {
                result.push('\n');
            }
        }
        result
    }

    fn get_indent_multiplier(&self, options: &RenderOptions) -> u32 {
        match (options.show_3d_coords, options.show_idx) {
            (true, true) => 8,
            (true, false) => 4,
            (false, true) => 4,
            (false, false) => 2,
        }
    }

    fn format_cell(&self, coords: Coordinates, options: &RenderOptions, width: usize) -> String {
        let player = self.board_map.get(&coords).map(|(_, p)| *p);

        // 1. Base symbol
        let mut symbol = match player {
            Some(p) => format!("{}", p),
            None => ".".to_string(),
        };

        // 2. Append metadata (3D Coords / Index)
        if options.show_3d_coords {
            symbol.push_str(&format!(
                "({:0w$},{:0w$},{:0w$})",
                coords.x(),
                coords.y(),
                coords.z(),
                w = width
            ));
        }
        if options.show_idx {
            let idx = coords.to_index(self.board_size);
            symbol.push_str(&format!("({}) ", idx));
        }

        // 3. Apply colors
        if options.show_colors {
            symbol = apply_player_color(symbol, player);
        }

        symbol
    }

    /// Disjoint Set Union 'Find' with path compression
    fn find(&mut self, i: SetIdx) -> SetIdx {
        if self.sets[i].parent == i {
            i
        } else {
            self.sets[i].parent = self.find(self.sets[i].parent);
            self.sets[i].parent
        }
    }

    /// Disjoint Set Union 'Union' operation
    fn union(&mut self, i: SetIdx, j: SetIdx) -> bool {
        let root_i = self.find(i);
        let root_j = self.find(j);

        if root_i != root_j {
            self.sets[root_i].parent = root_j;
            // Merge side properties
            self.sets[root_j].touches_side_a |= self.sets[root_i].touches_side_a;
            self.sets[root_j].touches_side_b |= self.sets[root_i].touches_side_b;
            self.sets[root_j].touches_side_c |= self.sets[root_i].touches_side_c;
            return self.sets[root_j].touches_side_a
                && self.sets[root_j].touches_side_b
                && self.sets[root_j].touches_side_c;
        }
        false
    }
}

fn indent(str: &mut String, level: u32) {
    str.push_str(&" ".repeat(level as usize));
}

impl TryFrom<YEN> for GameY {
    type Error = GameYError;

    fn try_from(game: YEN) -> Result<Self> {
        let mut ygame = GameY::new(game.size());
        let rows: Vec<&str> = game.layout().split('/').collect();
        if rows.len() as u32 != game.size() {
            return Err(GameYError::InvalidYENLayout {
                expected: game.size(),
                found: rows.len() as u32,
            });
        }
        for (row, row_str) in rows.iter().enumerate() {
            let cells: Vec<char> = row_str.chars().collect();
            if cells.len() as u32 != row as u32 + 1 {
                return Err(GameYError::InvalidYENLayoutLine {
                    expected: row as u32 + 1,
                    found: cells.len() as u32,
                    line: row as u32,
                });
            }
            for (col, cell) in cells.iter().enumerate() {
                let x = game.size() - 1 - (row as u32);
                let y = col as u32;
                let z = game.size() - 1 - x - y;
                let coords = Coordinates::new(x, y, z);
                if let Some(player) = player_from_layout_cell(*cell) {
                    ygame.add_move(Movement::Placement { player, coords })?;
                } else if *cell != '.' {
                    return Err(GameYError::InvalidCharInLayout {
                        char: *cell,
                        row,
                        col,
                    });
                }
            }
        }
        Ok(ygame)
    }
}

impl From<&GameY> for YEN {
    fn from(game: &GameY) -> Self {
        let size = game.board_size;
        let turn = match game.status {
            GameStatus::Finished { winner } => other_player(winner).id() as u32,
            GameStatus::Ongoing { next_player } => next_player.id(),
        };
        let mut layout = String::new();
        let total_cells = (game.board_size * (game.board_size + 1)) / 2;
        let players = vec!['B', 'R'];
        for idx in 0..total_cells {
            let coords = Coordinates::from_index(idx, game.board_size);
            let cell_char = match game.board_map.get(&coords) {
                Some((_, player)) if player.id() == 0 => 'B',
                Some((_, player)) if player.id() == 1 => 'R',
                _ => '.',
            };
            layout.push(cell_char);
            if coords.z() == 0 && coords.x() > 0 {
                layout.push('/');
            }
        }
        YEN::new(size, turn, players, layout)
    }
}

pub fn other_player(player: PlayerId) -> PlayerId {
    // Assuming two players with IDs 0 and 1
    if player.id() == 0 {
        PlayerId::new(1)
    } else {
        PlayerId::new(0)
    }
}

fn player_from_layout_cell(cell: char) -> Option<PlayerId> {
    match cell {
        'B' => Some(PlayerId::new(0)),
        'R' => Some(PlayerId::new(1)),
        _ => None,
    }
}

fn apply_player_color(symbol: String, player: Option<PlayerId>) -> String {
    match player {
        Some(p) if p.id() == 0 => format!("\x1b[34m{}\x1b[0m", symbol), // Blue
        Some(p) if p.id() == 1 => format!("\x1b[31m{}\x1b[0m", symbol), // Red
        _ => symbol,
    }
}

/// Represents the current status of a game.
#[derive(Debug, Clone)]
pub enum GameStatus {
    /// The game is still in progress with the specified player to move next.
    Ongoing { next_player: PlayerId },
    /// The game has ended with a winner.
    Finished { winner: PlayerId },
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn placement(player: u32, x: u32, y: u32, z: u32) -> Movement {
        Movement::Placement {
            player: PlayerId::new(player),
            coords: Coordinates::new(x, y, z),
        }
    }

    fn assert_winner(game: &GameY, expected_winner: PlayerId) {
        match game.status() {
            GameStatus::Finished { winner } => {
                assert_eq!(*winner, expected_winner);
            }
            other => panic!("Game should be finished with a winner. Found: {:?}", other),
        }
    }

    fn assert_next_player(game: &GameY, expected_next_player: PlayerId) {
        match game.status() {
            GameStatus::Ongoing { next_player } => {
                assert_eq!(*next_player, expected_next_player);
            }
            other => panic!("Game should be ongoing. Found: {:?}", other),
        }
    }

    fn apply_moves(game: &mut GameY, moves: impl IntoIterator<Item = Movement>) {
        for movement in moves {
            game.add_move(movement).unwrap();
        }
    }

    fn load_game_from_yen_str(yen_str: &str) -> GameY {
        let yen: YEN = serde_json::from_str(yen_str).unwrap();
        GameY::try_from(yen).unwrap()
    }

    fn unique_temp_file_path(name: &str) -> std::path::PathBuf {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("{}_{}_{}.json", name, std::process::id(), timestamp))
    }

    #[test]
    fn test_other_player() {
        assert_eq!(other_player(PlayerId::new(0)), PlayerId::new(1));
        assert_eq!(other_player(PlayerId::new(1)), PlayerId::new(0));
    }

    #[test]
    fn test_game_initialization() {
        let game = GameY::new(7);
        assert_eq!(game.board_size, 7);
        assert_eq!(game.history.len(), 0);
        assert_eq!(game.total_cells(), 28);
        assert_eq!(game.available_cells().len(), 28);
        assert_eq!(game.board_size(), 7);
        assert_eq!(game.next_player(), Some(PlayerId::new(0)));
        assert!(!game.check_game_over());
        assert_next_player(&game, PlayerId::new(0));
    }

    #[test]
    fn test_check_player_turn_accepts_correct_player_for_placement_and_action() {
        let game = GameY::new(3);

        assert!(game
            .check_player_turn(&placement(0, 2, 0, 0))
            .is_ok());
        assert!(game
            .check_player_turn(&Movement::Action {
                player: PlayerId::new(0),
                action: GameAction::PassTurn,
            })
            .is_ok());
    }

    #[test]
    fn test_check_player_turn_rejects_wrong_player() {
        let game = GameY::new(3);

        let error = game
            .check_player_turn(&placement(1, 2, 0, 0))
            .unwrap_err();

        match error {
            GameYError::InvalidPlayerTurn { expected, found } => {
                assert_eq!(expected, PlayerId::new(0));
                assert_eq!(found, PlayerId::new(1));
            }
            other => panic!("Expected InvalidPlayerTurn, found {:?}", other),
        }
    }

    // Helper function to compare neighbor sets
    fn assert_neighbors_match(actual: Vec<Coordinates>, expected: Vec<Coordinates>) {
        let actual_set: HashSet<_> = actual.into_iter().collect();
        let expected_set: HashSet<_> = expected.into_iter().collect();
        assert_eq!(actual_set, expected_set);
    }

    #[test]
    fn test_interior_cell_has_six_neighbors() {
        let board = GameY::new(5);
        let cell = Coordinates::new(2, 1, 1);

        let neighbors = board.get_neighbors(&cell);

        let expected = vec![
            Coordinates::new(1, 2, 1),
            Coordinates::new(1, 1, 2),
            Coordinates::new(3, 0, 1),
            Coordinates::new(2, 0, 2),
            Coordinates::new(3, 1, 0),
            Coordinates::new(2, 2, 0),
        ];

        assert_eq!(neighbors.len(), 6);
        assert_neighbors_match(neighbors, expected);
    }

    #[test]
    fn test_corner_cell_has_two_neighbors() {
        let board = GameY::new(5);
        let top_corner = Coordinates::new(4, 0, 0);

        let neighbors = board.get_neighbors(&top_corner);

        let expected = vec![Coordinates::new(3, 1, 0), Coordinates::new(3, 0, 1)];

        assert_eq!(neighbors.len(), 2);
        assert_neighbors_match(neighbors, expected);
    }

    #[test]
    fn test_edge_cell_has_four_neighbors() {
        let board = GameY::new(5);
        let edge_cell = Coordinates::new(0, 2, 2);

        let neighbors = board.get_neighbors(&edge_cell);

        let expected = vec![
            Coordinates::new(1, 1, 2),
            Coordinates::new(0, 1, 3),
            Coordinates::new(1, 2, 1),
            Coordinates::new(0, 3, 1),
        ];

        assert_eq!(neighbors.len(), 4);
        assert_neighbors_match(neighbors, expected);
    }

    #[test]
    fn test_winning_condition() {
        let mut game = GameY::new(3);

        apply_moves(&mut game, [
            placement(0, 0, 2, 0),
            placement(1, 2, 0, 0),
            placement(0, 0, 1, 1),
            placement(1, 1, 1, 0),
            placement(0, 0, 0, 2),
        ]);

        assert_winner(&game, PlayerId::new(0));
        assert!(game.check_game_over());
        assert_eq!(game.next_player(), None);
    }

    #[test]
    fn test_pass_turn_and_swap_advance_to_other_player() {
        let mut game = GameY::new(3);

        game.add_move(Movement::Action {
            player: PlayerId::new(0),
            action: GameAction::PassTurn,
        })
        .unwrap();
        assert_next_player(&game, PlayerId::new(1));

        game.add_move(Movement::Action {
            player: PlayerId::new(1),
            action: GameAction::Swap,
        })
        .unwrap();
        assert_next_player(&game, PlayerId::new(0));
    }

    #[test]
    fn test_resign_finishes_game_with_other_player_as_winner() {
        let mut game = GameY::new(3);

        game.add_move(Movement::Action {
            player: PlayerId::new(0),
            action: GameAction::Resign,
        })
        .unwrap();

        assert_winner(&game, PlayerId::new(1));
    }

    #[test]
    fn test_placing_on_occupied_cell_returns_error() {
        let mut game = GameY::new(3);
        let coords = Coordinates::new(2, 0, 0);

        game.add_move(placement(0, 2, 0, 0)).unwrap();

        let error = game
            .add_move(placement(1, 2, 0, 0))
            .unwrap_err();

        match error {
            GameYError::Occupied { coordinates, player } => {
                assert_eq!(coordinates, coords);
                assert_eq!(player, PlayerId::new(1));
            }
            other => panic!("Expected Occupied error, found {:?}", other),
        }
    }

    #[test]
    fn test_yen_conversion() {
        let mut game = GameY::new(3);

        apply_moves(&mut game, [
            placement(0, 0, 2, 0),
            placement(1, 2, 0, 0),
            placement(0, 0, 1, 1),
        ]);

        let yen: YEN = (&game).into();
        let loaded_game = GameY::try_from(yen.clone()).unwrap();

        assert_eq!(game.board_size, loaded_game.board_size);
        let yen_loaded: YEN = (&loaded_game).into();
        assert_eq!(yen.layout(), yen_loaded.layout());
    }

    #[test]
    fn test_save_and_load_from_file_roundtrip() {
        let mut game = GameY::new(3);
        let file_path = unique_temp_file_path("gamey_roundtrip");

        apply_moves(&mut game, [
            placement(0, 2, 0, 0),
            placement(1, 1, 1, 0),
        ]);

        game.save_to_file(&file_path).unwrap();
        let loaded_game = GameY::load_from_file(&file_path).unwrap();
        std::fs::remove_file(&file_path).unwrap();

        let original_yen: YEN = (&game).into();
        let loaded_yen: YEN = (&loaded_game).into();
        assert_eq!(original_yen.layout(), loaded_yen.layout());
        assert_eq!(original_yen.turn(), loaded_yen.turn());
    }

    #[test]
    fn test_load_from_file_missing_path_returns_io_error() {
        let file_path = unique_temp_file_path("gamey_missing");
        let error = GameY::load_from_file(&file_path).unwrap_err();

        match error {
            GameYError::IoError { message, .. } => {
                assert!(message.contains("Failed to read file"));
            }
            other => panic!("Expected IoError, found {:?}", other),
        }
    }

    #[test]
    fn test_load_from_file_invalid_json_returns_serde_error() {
        let file_path = unique_temp_file_path("gamey_bad_json");
        std::fs::write(&file_path, "{ invalid json").unwrap();

        let error = GameY::load_from_file(&file_path).unwrap_err();
        std::fs::remove_file(&file_path).unwrap();

        match error {
            GameYError::SerdeError { .. } => {}
            other => panic!("Expected SerdeError, found {:?}", other),
        }
    }

    #[test]
    fn test_render_includes_coordinates_indices_and_colors() {
        let mut game = GameY::new(2);
        game.add_move(placement(0, 1, 0, 0)).unwrap();

        let rendered = game.render(&RenderOptions {
            show_3d_coords: true,
            show_idx: true,
            show_colors: true,
        });

        assert!(rendered.contains("--- Game of Y (Size 2) ---"));
        assert!(rendered.contains("(1,0,0)"));
        assert!(rendered.contains("(0) "));
        assert!(rendered.contains("\x1b[34m"));
    }

    #[test]
    fn test_render_without_metadata_keeps_plain_board_symbols() {
        let game = GameY::new(2);
        let rendered = game.render(&RenderOptions {
            show_3d_coords: false,
            show_idx: false,
            show_colors: false,
        });

        assert!(rendered.contains("."));
        assert!(!rendered.contains("\x1b["));
    }

    #[test]
    fn test_load_yen_status_cases() {
        let cases = [
            (
                r#"{
                    "size": 2,
                    "turn": 0,
                    "players": ["B","R"],
                    "layout": "B/BB"
                }"#,
                Some(PlayerId::new(0)),
                None,
            ),
            (
                r#"{
                    "size": 3,
                    "turn": 0,
                    "players": ["B","R"],
                    "layout": "B/BB/BBR"
                }"#,
                Some(PlayerId::new(0)),
                None,
            ),
            (
                r#"{
                    "size": 1,
                    "turn": 0,
                    "players": ["B","R"],
                    "layout": "B"
                }"#,
                Some(PlayerId::new(0)),
                None,
            ),
            (
                r#"{
                    "size": 1,
                    "turn": 0,
                    "players": ["B","R"],
                    "layout": "."
                }"#,
                None,
                Some(PlayerId::new(0)),
            ),
        ];

        for (yen_str, winner, next_player) in cases {
            let game = load_game_from_yen_str(yen_str);
            if let Some(expected_winner) = winner {
                assert_winner(&game, expected_winner);
            }
            if let Some(expected_next_player) = next_player {
                assert_next_player(&game, expected_next_player);
            }
        }
    }

    #[test]
    fn test_try_from_rejects_invalid_yen_cases() {
        let cases = [
            (
                YEN::new(3, 0, vec!['B', 'R'], "B/BB".to_string()),
                GameYError::InvalidYENLayout {
                    expected: 3,
                    found: 2,
                },
            ),
            (
                YEN::new(3, 0, vec!['B', 'R'], "B/B/BBB".to_string()),
                GameYError::InvalidYENLayoutLine {
                    expected: 2,
                    found: 1,
                    line: 1,
                },
            ),
            (
                YEN::new(2, 0, vec!['B', 'R'], "B/XB".to_string()),
                GameYError::InvalidCharInLayout {
                    char: 'X',
                    row: 1,
                    col: 0,
                },
            ),
        ];

        for (yen, expected_error) in cases {
            let error = GameY::try_from(yen).unwrap_err();
            match (error, expected_error) {
                (
                    GameYError::InvalidYENLayout { expected, found },
                    GameYError::InvalidYENLayout {
                        expected: expected_rows,
                        found: found_rows,
                    },
                ) => {
                    assert_eq!(expected, expected_rows);
                    assert_eq!(found, found_rows);
                }
                (
                    GameYError::InvalidYENLayoutLine {
                        expected,
                        found,
                        line,
                    },
                    GameYError::InvalidYENLayoutLine {
                        expected: expected_cells,
                        found: found_cells,
                        line: expected_line,
                    },
                ) => {
                    assert_eq!(expected, expected_cells);
                    assert_eq!(found, found_cells);
                    assert_eq!(line, expected_line);
                }
                (
                    GameYError::InvalidCharInLayout { char, row, col },
                    GameYError::InvalidCharInLayout {
                        char: expected_char,
                        row: expected_row,
                        col: expected_col,
                    },
                ) => {
                    assert_eq!(char, expected_char);
                    assert_eq!(row, expected_row);
                    assert_eq!(col, expected_col);
                }
                (found, expected) => {
                    panic!("Expected {:?}, found {:?}", expected, found);
                }
            }
        }
    }
}
