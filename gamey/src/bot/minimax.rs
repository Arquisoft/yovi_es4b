//! A minimax bot implementation.
use crate::{Coordinates, GameY, PlayerId, YBot};
use std::collections::{BinaryHeap, HashMap, HashSet};
use std::cmp::Reverse;

pub struct MinimaxBot {
    max_depth: u32,
}

impl Default for MinimaxBot {
    fn default() -> Self {
        Self { max_depth: 5 }
    }
}

impl MinimaxBot {
    pub fn new(max_depth: u32) -> Self {
        Self { max_depth }
    }

    // ── Geometry ─────────────────────────────────────────────────────────────

    #[inline]
    fn xyz(idx: u32, n: u32) -> (u32, u32, u32) {
        let c = Coordinates::from_index(idx, n);
        (c.x(), c.y(), c.z())
    }

    #[inline]
    fn edge_mask(x: u32, y: u32, z: u32) -> u8 {
        ((x == 0) as u8) | (((y == 0) as u8) << 1) | (((z == 0) as u8) << 2)
    }

    /// Precomputes (x,y,z) → flat index for the whole board. Built once per turn.
    fn build_coord_map(n: u32) -> HashMap<(u32, u32, u32), u32> {
        let total = n * (n + 1) / 2;
        (0..total).map(|i| (Self::xyz(i, n), i)).collect()
    }

    fn neighbors(idx: u32, n: u32, c2i: &HashMap<(u32, u32, u32), u32>) -> Vec<u32> {
        const D: [(i32, i32, i32); 6] =
            [(1,-1,0),(-1,1,0),(1,0,-1),(-1,0,1),(0,1,-1),(0,-1,1)];
        let (x, y, z) = Self::xyz(idx, n);
        D.iter().filter_map(|&(dx, dy, dz)| {
            let (nx, ny, nz) = (x as i32 + dx, y as i32 + dy, z as i32 + dz);
            if nx >= 0 && ny >= 0 && nz >= 0 {
                c2i.get(&(nx as u32, ny as u32, nz as u32)).copied()
            } else {
                None
            }
        }).collect()
    }

    // ── Move relevance filter ─────────────────────────────────────────────────
    //
    // KEY SPEEDUP: on a board of side n there are n*(n+1)/2 cells. Without
    // filtering, the branching factor equals all free cells. With filtering we
    // only look at cells adjacent to any occupied cell, which is typically
    // 5-15 moves — a dramatic reduction for large boards.

    fn relevant_moves(
        available: &[u32],
        occupied: &HashSet<u32>,
        n: u32,
        c2i: &HashMap<(u32, u32, u32), u32>,
    ) -> Vec<u32> {
        let sort_central = |v: &mut Vec<u32>| {
            v.sort_by_key(|&i| {
                let (x, y, z) = Self::xyz(i, n);
                Reverse(x.min(y).min(z))
            });
        };

        if occupied.len() < 3 {
            let mut all = available.to_vec();
            sort_central(&mut all);
            return all;
        }

        let avail_set: HashSet<u32> = available.iter().copied().collect();
        let mut relevant: HashSet<u32> = HashSet::new();

        for &occ in occupied {
            for nb in Self::neighbors(occ, n, c2i) {
                if avail_set.contains(&nb) {
                    relevant.insert(nb);
                }
            }
        }

        let mut v: Vec<u32> = if relevant.is_empty() {
            available.to_vec()
        } else {
            relevant.into_iter().collect()
        };
        sort_central(&mut v);
        v
    }

    // ── Dijkstra connectivity heuristic ──────────────────────────────────────
    //
    // Minimum empty cells needed to connect two edges.
    // Own cells cost 0 (already placed), empty cells cost 1, opponent = wall.

    fn min_path_cost(
        from_edge: u8,
        to_edge: u8,
        my:  &HashSet<u32>,
        opp: &HashSet<u32>,
        n: u32,
        c2i: &HashMap<(u32, u32, u32), u32>,
    ) -> Option<u32> {
        let total = n * (n + 1) / 2;
        let mut dist = vec![u32::MAX; total as usize];
        let mut heap: BinaryHeap<Reverse<(u32, u32)>> = BinaryHeap::new();

        for i in 0..total {
            if opp.contains(&i) { continue; }
            let (x, y, z) = Self::xyz(i, n);
            if Self::edge_mask(x, y, z) & from_edge == 0 { continue; }
            let cost = if my.contains(&i) { 0 } else { 1 };
            if cost < dist[i as usize] {
                dist[i as usize] = cost;
                heap.push(Reverse((cost, i)));
            }
        }

        while let Some(Reverse((d, idx))) = heap.pop() {
            if dist[idx as usize] < d { continue; }
            let (x, y, z) = Self::xyz(idx, n);
            if Self::edge_mask(x, y, z) & to_edge != 0 { return Some(d); }
            for nb in Self::neighbors(idx, n, c2i) {
                if opp.contains(&nb) { continue; }
                let step = if my.contains(&nb) { 0 } else { 1 };
                let nd = d + step;
                if nd < dist[nb as usize] {
                    dist[nb as usize] = nd;
                    heap.push(Reverse((nd, nb)));
                }
            }
        }
        None
    }

    fn connectivity(
        my: &HashSet<u32>,
        opp: &HashSet<u32>,
        n: u32,
        c2i: &HashMap<(u32, u32, u32), u32>,
    ) -> f64 {
        let p01 = Self::min_path_cost(0b001, 0b010, my, opp, n, c2i);
        let p12 = Self::min_path_cost(0b010, 0b100, my, opp, n, c2i);
        let p02 = Self::min_path_cost(0b001, 0b100, my, opp, n, c2i);
        match (p01, p12, p02) {
            (Some(c01), Some(c12), Some(c02)) => 300.0 / (c01 + c12 + c02 + 1) as f64,
            _ => 0.0, // fully blocked on at least one axis → no winning path
        }
    }

    // ── Evaluation ───────────────────────────────────────────────────────────

    fn evaluate_board(board: &GameY, player: PlayerId) -> f64 {
        match board.status() {
            crate::GameStatus::Finished { winner } => {
                if *winner == player { 1000.0 } else { -1000.0 }
            }
            crate::GameStatus::Ongoing { .. } => 0.0,
        }
    }

    fn evaluate(
        board: &GameY,
        player: PlayerId,
        pc: &HashSet<u32>,
        oc: &HashSet<u32>,
        c2i: &HashMap<(u32, u32, u32), u32>,
    ) -> f64 {
        match board.status() {
            crate::GameStatus::Finished { winner } => {
                if *winner == player { 1000.0 } else { -1000.0 }
            }
            crate::GameStatus::Ongoing { .. } => {
                let n = board.board_size();
                Self::connectivity(pc, oc, n, c2i) - Self::connectivity(oc, pc, n, c2i)
            }
        }
    }

    // ── Alpha-beta minimax ────────────────────────────────────────────────────

    fn minimax(
        &self,
        board: &GameY,
        depth: u32,
        maximizing: bool,
        player: PlayerId,
        opponent: PlayerId,
        mut alpha: f64,
        mut beta: f64,
        pc:       &mut HashSet<u32>, // cells placed by `player`  in this branch
        oc:       &mut HashSet<u32>, // cells placed by `opponent` in this branch
        occupied: &mut HashSet<u32>, // all occupied cells (any player)
        c2i: &HashMap<(u32, u32, u32), u32>,
    ) -> f64 {
        if depth == 0 || matches!(board.status(), crate::GameStatus::Finished { .. }) {
            return Self::evaluate(board, player, pc, oc, c2i);
        }

        let current = if maximizing { player } else { opponent };
        let n = board.board_size();
        let available = board.available_cells();
        let moves = Self::relevant_moves(available, occupied, n, c2i);

        if maximizing {
            let mut max_eval = f64::NEG_INFINITY;
            for cell in moves {
                let coords = Coordinates::from_index(cell, n);
                let mut nb = board.clone();
                if nb.add_move(crate::Movement::Placement { player: current, coords }).is_ok() {
                    pc.insert(cell); occupied.insert(cell);
                    let eval = self.minimax(
                        &nb, depth - 1, false, player, opponent,
                        alpha, beta, pc, oc, occupied, c2i,
                    );
                    pc.remove(&cell); occupied.remove(&cell);
                    if eval > max_eval { max_eval = eval; }
                    alpha = alpha.max(eval);
                    if beta <= alpha { break; }
                }
            }
            max_eval
        } else {
            let mut min_eval = f64::INFINITY;
            for cell in moves {
                let coords = Coordinates::from_index(cell, n);
                let mut nb = board.clone();
                if nb.add_move(crate::Movement::Placement { player: current, coords }).is_ok() {
                    oc.insert(cell); occupied.insert(cell);
                    let eval = self.minimax(
                        &nb, depth - 1, true, player, opponent,
                        alpha, beta, pc, oc, occupied, c2i,
                    );
                    oc.remove(&cell); occupied.remove(&cell);
                    if eval < min_eval { min_eval = eval; }
                    beta = beta.min(eval);
                    if beta <= alpha { break; }
                }
            }
            min_eval
        }
    }
}

impl YBot for MinimaxBot {
    fn name(&self) -> &str { "minimax_bot" }

    fn choose_move(&self, board: &GameY) -> Option<Coordinates> {
        let available = board.available_cells();
        if available.is_empty() { return None; }

        let current_player = match board.status() {
            crate::GameStatus::Ongoing { next_player } => *next_player,
            _ => return None,
        };
        let opponent = crate::other_player(current_player);
        let n = board.board_size();
        let c2i = Self::build_coord_map(n);

        // ── 1. Ganar inmediatamente si es posible ────────────────────────────
        for &cell in available {
            let coords = Coordinates::from_index(cell, n);
            let mut test = board.clone();
            if test.add_move(crate::Movement::Placement {
                player: current_player, coords,
            }).is_ok() {
                if matches!(test.status(),
                    crate::GameStatus::Finished { winner } if *winner == current_player)
                {
                    return Some(coords);
                }
            }
        }

        // ── 2. Bloquear victoria inmediata del rival ─────────────────────────
        for &cell in available {
            let coords = Coordinates::from_index(cell, n);
            let mut test = board.clone();
            if test.add_move(crate::Movement::Placement {
                player: opponent, coords,
            }).is_ok() {
                if matches!(test.status(),
                    crate::GameStatus::Finished { winner } if *winner == opponent)
                {
                    return Some(coords);
                }
            }
        }

        // ── 3. Búsqueda alpha-beta ───────────────────────────────────────────
        let avail_set: HashSet<u32> = available.iter().copied().collect();
        let total = n * (n + 1) / 2;

        // All currently-occupied cells (regardless of owner), used by
        // relevant_moves to focus the search on the active zone of the board.
        let mut occupied: HashSet<u32> = (0..total)
            .filter(|i| !avail_set.contains(i))
            .collect();

        let moves = Self::relevant_moves(available, &occupied, n, &c2i);

        let mut pc: HashSet<u32> = HashSet::new();
        let mut oc: HashSet<u32> = HashSet::new();
        let mut best_move  = None;
        let mut best_value = f64::NEG_INFINITY;

        for cell in moves {
            let coords = Coordinates::from_index(cell, n);
            let mut new_board = board.clone();
            if new_board.add_move(crate::Movement::Placement {
                player: current_player, coords,
            }).is_ok() {
                pc.insert(cell); occupied.insert(cell);
                let value = self.minimax(
                    &new_board, self.max_depth - 1, false,
                    current_player, opponent,
                    f64::NEG_INFINITY, f64::INFINITY,
                    &mut pc, &mut oc, &mut occupied, &c2i,
                );
                pc.remove(&cell); occupied.remove(&cell);

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
        let game = GameY::new(3);
        let chosen_move = bot.choose_move(&game);
        assert!(chosen_move.is_some());
    }

    #[test]
    fn test_minimax_bot_evaluate_win_and_loss() {
        let mut game = GameY::new(3);
        let moves = vec![
            crate::Movement::Placement { player: crate::PlayerId::new(0), coords: Coordinates::new(0, 0, 2) },
            crate::Movement::Placement { player: crate::PlayerId::new(1), coords: Coordinates::new(2, 0, 0) },
            crate::Movement::Placement { player: crate::PlayerId::new(0), coords: Coordinates::new(0, 1, 1) },
            crate::Movement::Placement { player: crate::PlayerId::new(1), coords: Coordinates::new(1, 1, 0) },
            crate::Movement::Placement { player: crate::PlayerId::new(0), coords: Coordinates::new(0, 2, 0) },
        ];
        for mv in moves { game.add_move(mv).unwrap(); }
        assert!(matches!(game.status(),
            crate::GameStatus::Finished { winner } if *winner == crate::PlayerId::new(0)));

        let win_score  = MinimaxBot::evaluate_board(&game, crate::PlayerId::new(0));
        let lose_score = MinimaxBot::evaluate_board(&game, crate::PlayerId::new(1));
        assert!(win_score  >= 1000.0);
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
        for mv in fills { game.add_move(mv).unwrap(); }
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
        for mv in moves { game.add_move(mv).unwrap(); }
        let chosen = bot.choose_move(&game).unwrap();
        assert_eq!(chosen, Coordinates::new(0, 2, 0));
    }
}