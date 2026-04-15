//! A minimax bot implementation — improved version.
use crate::{Coordinates, GameY, PlayerId, YBot};
use std::cmp::Reverse;
use std::collections::{BTreeSet, BinaryHeap, HashMap, HashSet};

pub struct MinimaxBot {
    max_depth: u32,
}

impl Default for MinimaxBot {
    fn default() -> Self {
        Self { max_depth: 6 }
    }
}

impl MinimaxBot {
    pub fn new(max_depth: u32) -> Self {
        Self { max_depth }
    }

    // ── Geometry ──────────────────────────────────────────────────────────────

    #[inline]
    fn xyz(idx: u32, n: u32) -> (u32, u32, u32) {
        let c = Coordinates::from_index(idx, n);
        (c.x(), c.y(), c.z())
    }

    #[inline]
    fn edge_mask(x: u32, y: u32, z: u32) -> u8 {
        ((x == 0) as u8) | (((y == 0) as u8) << 1) | (((z == 0) as u8) << 2)
    }

    fn build_neighbor_map(n: u32) -> HashMap<u32, Vec<u32>> {
        const D: [(i32, i32, i32); 6] = [
            (1, -1, 0),
            (-1, 1, 0),
            (1, 0, -1),
            (-1, 0, 1),
            (0, 1, -1),
            (0, -1, 1),
        ];
        let total = n * (n + 1) / 2;
        let c2i: HashMap<(u32, u32, u32), u32> = (0..total).map(|i| (Self::xyz(i, n), i)).collect();
        (0..total)
            .map(|idx| {
                let (x, y, z) = Self::xyz(idx, n);
                let nbs = D
                    .iter()
                    .filter_map(|&(dx, dy, dz)| {
                        let (nx, ny, nz) = (x as i32 + dx, y as i32 + dy, z as i32 + dz);
                        if nx >= 0 && ny >= 0 && nz >= 0 {
                            c2i.get(&(nx as u32, ny as u32, nz as u32)).copied()
                        } else {
                            None
                        }
                    })
                    .collect();
                (idx, nbs)
            })
            .collect()
    }

    // ── Dijkstra — devuelve (distancia, conjunto de celdas en el camino óptimo)
    //
    // FIX 1: ahora también reconstruimos el camino para poder marcar sus celdas
    // como "amenaza" en el filtro de movimientos relevantes.

    fn min_path_with_cells(
        from_edge: u8,
        to_edge: u8,
        my: &BTreeSet<u32>,
        opp: &BTreeSet<u32>,
        root_occupied: &BTreeSet<u32>,
        n: u32,
        nbrs: &HashMap<u32, Vec<u32>>,
    ) -> Option<(u32, Vec<u32>)> {
        let total = n * (n + 1) / 2;
        let mut dist = vec![u32::MAX; total as usize];
        let mut prev = vec![u32::MAX; total as usize];
        let mut heap: BinaryHeap<Reverse<(u32, u32)>> = BinaryHeap::new();

        let is_wall = |i: u32| -> bool {
            opp.contains(&i) || (root_occupied.contains(&i) && !my.contains(&i))
        };

        for i in 0..total {
            if is_wall(i) {
                continue;
            }

            let (x, y, z) = Self::xyz(i, n);
            if Self::edge_mask(x, y, z) & from_edge == 0 {
                continue;
            }

            let cost = if my.contains(&i) { 0 } else { 1 };
            if cost < dist[i as usize] {
                dist[i as usize] = cost;
                heap.push(Reverse((cost, i)));
            }
        }

        let mut goal = None;
        'outer: while let Some(Reverse((d, idx))) = heap.pop() {
            if dist[idx as usize] < d {
                continue;
            }

            let (x, y, z) = Self::xyz(idx, n);
            if Self::edge_mask(x, y, z) & to_edge != 0 {
                goal = Some((d, idx));
                break 'outer;
            }

            if let Some(nbs) = nbrs.get(&idx) {
                for &nb in nbs {
                    if is_wall(nb) {
                        continue;
                    }

                    let step = if my.contains(&nb) { 0 } else { 1 };
                    let nd = d + step;
                    if nd < dist[nb as usize] {
                        dist[nb as usize] = nd;
                        prev[nb as usize] = idx;
                        heap.push(Reverse((nd, nb)));
                    }
                }
            }
        }

        let (cost, end) = goal?;
        let mut path = Vec::new();
        let mut cur = end;
        while cur != u32::MAX {
            if !my.contains(&cur) {
                path.push(cur);
            }
            cur = prev[cur as usize];
        }

        Some((cost, path))
    }

    #[inline]
    fn min_path_cost(
        from_edge: u8,
        to_edge: u8,
        my: &BTreeSet<u32>,
        opp: &BTreeSet<u32>,
        root_occupied: &BTreeSet<u32>,
        n: u32,
        nbrs: &HashMap<u32, Vec<u32>>,
    ) -> Option<u32> {
        Self::min_path_with_cells(from_edge, to_edge, my, opp, root_occupied, n, nbrs)
            .map(|(c, _)| c)
    }

    // ── Move relevance filter ─────────────────────────────────────────────────
    //
    // FIX 2: además de vecinos de celdas ocupadas (hasta 2 saltos), incluimos
    // las celdas del camino más corto del RIVAL, para garantizar que el bot
    // siempre pueda bloquear amenazas concretas.

    fn relevant_moves(
        available: &[u32],
        my: &BTreeSet<u32>,
        opp: &BTreeSet<u32>,
        occupied: &BTreeSet<u32>,
        root_occupied: &BTreeSet<u32>,
        n: u32,
        nbrs: &HashMap<u32, Vec<u32>>,
    ) -> Vec<u32> {
        let avail_set: HashSet<u32> = available.iter().copied().collect();

        let centrality = |i: u32| -> u32 {
            let (x, y, z) = Self::xyz(i, n);
            x.min(y).min(z)
        };

        if occupied.len() < 2 {
            let mut all = available.to_vec();
            all.sort_by_key(|&i| Reverse(centrality(i)));
            return all;
        }

        let mut relevant: HashSet<u32> = HashSet::new();

        for &occ in occupied {
            if let Some(nbs) = nbrs.get(&occ) {
                for &nb in nbs {
                    if avail_set.contains(&nb) {
                        relevant.insert(nb);
                        if let Some(nbs2) = nbrs.get(&nb) {
                            for &nb2 in nbs2 {
                                if avail_set.contains(&nb2) {
                                    relevant.insert(nb2);
                                }
                            }
                        }
                    }
                }
            }
        }

        if !opp.is_empty() {
            for (fe, te) in [(0b001u8, 0b010u8), (0b010, 0b100), (0b001, 0b100)] {
                if let Some((cost, path)) =
                    Self::min_path_with_cells(fe, te, opp, my, root_occupied, n, nbrs)
                {
                    if cost <= 4 {
                        for c in path {
                            if avail_set.contains(&c) {
                                relevant.insert(c);
                            }
                        }
                    }
                }
            }
        }

        let mut v: Vec<u32> = if relevant.is_empty() {
            available.to_vec()
        } else {
            relevant.into_iter().collect()
        };
        v.sort_by_key(|&i| Reverse(centrality(i)));
        v
    }

    // ── Heurística de conectividad ────────────────────────────────────────────

    fn score_paths(p01: u32, p12: u32, p02: u32) -> f64 {
        let s = |c: u32| 1000.0 * (0.5_f64).powi(c as i32);
        let base = s(p01) + s(p12) + s(p02);

        let min_path = p01.min(p12).min(p02);
        let threat_bonus = match min_path {
            0 => 8000.0,
            1 => 1500.0,
            2 => 400.0,
            _ => 0.0,
        };

        let low_paths = (p01 <= 2) as u32 + (p12 <= 2) as u32 + (p02 <= 2) as u32;
        let fork_bonus = if low_paths >= 2 { 600.0 } else { 0.0 };

        base + threat_bonus + fork_bonus
    }

    fn connectivity(
        my: &BTreeSet<u32>,
        opp: &BTreeSet<u32>,
        root_occupied: &BTreeSet<u32>,
        n: u32,
        nbrs: &HashMap<u32, Vec<u32>>,
    ) -> f64 {
        let p01 = Self::min_path_cost(0b001, 0b010, my, opp, root_occupied, n, nbrs);
        let p12 = Self::min_path_cost(0b010, 0b100, my, opp, root_occupied, n, nbrs);
        let p02 = Self::min_path_cost(0b001, 0b100, my, opp, root_occupied, n, nbrs);
        match (p01, p12, p02) {
            (Some(c01), Some(c12), Some(c02)) => Self::score_paths(c01, c12, c02),
            _ => 0.0,
        }
    }

    // ── Ordenación de movimientos (barata, O(6) por celda) ────────────────────

    fn fast_score(
        cell: u32,
        my: &BTreeSet<u32>,
        opp: &BTreeSet<u32>,
        n: u32,
        nbrs: &HashMap<u32, Vec<u32>>,
    ) -> i32 {
        let (x, y, z) = Self::xyz(cell, n);
        let edge_count = Self::edge_mask(x, y, z).count_ones() as i32;
        let centrality = x.min(y).min(z) as i32;
        let (my_nb, opp_nb) = nbrs
            .get(&cell)
            .map(|nbs| {
                nbs.iter().fold((0i32, 0i32), |(m, o), &nb| {
                    (m + my.contains(&nb) as i32, o + opp.contains(&nb) as i32)
                })
            })
            .unwrap_or((0, 0));

        my_nb * 4 + opp_nb * 3 + edge_count * 2 + centrality
    }

    // ── Evaluación ───────────────────────────────────────────────────────────

    fn evaluate_board(board: &GameY, player: PlayerId) -> f64 {
        match board.status() {
            crate::GameStatus::Finished { winner } => {
                if *winner == player {
                    10000.0
                } else {
                    -10000.0
                }
            }
            crate::GameStatus::Ongoing { .. } => 0.0,
        }
    }

    fn evaluate(
        board: &GameY,
        player: PlayerId,
        pc: &BTreeSet<u32>,
        oc: &BTreeSet<u32>,
        root_occupied: &BTreeSet<u32>,
        n: u32,
        nbrs: &HashMap<u32, Vec<u32>>,
    ) -> f64 {
        match board.status() {
            crate::GameStatus::Finished { .. } => Self::evaluate_board(board, player),
            crate::GameStatus::Ongoing { .. } => {
                Self::connectivity(pc, oc, root_occupied, n, nbrs)
                    - Self::connectivity(oc, pc, root_occupied, n, nbrs)
            }
        }
    }

    // ── Alpha-beta minimax ────────────────────────────────────────────────────

    #[allow(clippy::too_many_arguments)]
    fn minimax(
        &self,
        board: &GameY,
        depth: u32,
        maximizing: bool,
        player: PlayerId,
        opponent: PlayerId,
        mut alpha: f64,
        mut beta: f64,
        pc: &mut BTreeSet<u32>,
        oc: &mut BTreeSet<u32>,
        occupied: &mut BTreeSet<u32>,
        root_occupied: &BTreeSet<u32>,
        n: u32,
        nbrs: &HashMap<u32, Vec<u32>>,
        transposition_table: &mut HashMap<(BTreeSet<u32>, BTreeSet<u32>), (u32, f64)>,
    ) -> f64 {
        let key = (pc.clone(), oc.clone());
        if let Some(&(stored_depth, stored_value)) = transposition_table.get(&key)
            && stored_depth >= depth
        {
            return stored_value;
        }

        if depth == 0 || matches!(board.status(), crate::GameStatus::Finished { .. }) {
            let eval = Self::evaluate(board, player, pc, oc, root_occupied, n, nbrs);
            transposition_table.insert(key, (depth, eval));
            return eval;
        }

        let current = if maximizing { player } else { opponent };

        let (my_in_filter, opp_in_filter) = if maximizing {
            (pc as &BTreeSet<u32>, oc as &BTreeSet<u32>)
        } else {
            (oc as &BTreeSet<u32>, pc as &BTreeSet<u32>)
        };

        let mut moves = Self::relevant_moves(
            board.available_cells(),
            my_in_filter,
            opp_in_filter,
            occupied,
            root_occupied,
            n,
            nbrs,
        );

        moves.sort_by_key(|&cell| {
            let s = Self::fast_score(cell, my_in_filter, opp_in_filter, n, nbrs);
            if maximizing { -s } else { s }
        });

        let mut value = if maximizing {
            f64::NEG_INFINITY
        } else {
            f64::INFINITY
        };

        for cell in moves {
            let coords = Coordinates::from_index(cell, n);
            let mut nb = board.clone();
            if nb
                .add_move(crate::Movement::Placement {
                    player: current,
                    coords,
                })
                .is_ok()
            {
                if maximizing {
                    pc.insert(cell);
                } else {
                    oc.insert(cell);
                }
                occupied.insert(cell);

                let eval = self.minimax(
                    &nb,
                    depth - 1,
                    !maximizing,
                    player,
                    opponent,
                    alpha,
                    beta,
                    pc,
                    oc,
                    occupied,
                    root_occupied,
                    n,
                    nbrs,
                    transposition_table,
                );

                if maximizing {
                    pc.remove(&cell);
                    if eval > value {
                        value = eval;
                    }
                    alpha = alpha.max(eval);
                } else {
                    oc.remove(&cell);
                    if eval < value {
                        value = eval;
                    }
                    beta = beta.min(eval);
                }
                occupied.remove(&cell);

                if beta <= alpha {
                    break;
                }
            }
        }

        transposition_table.insert(key, (depth, value));
        value
    }
}

impl YBot for MinimaxBot {
    fn name(&self) -> &str {
        "minimax_bot"
    }

    fn choose_move(&self, board: &GameY) -> Option<Coordinates> {
        let available = board.available_cells();
        if available.is_empty() {
            return None;
        }

        let current_player = match board.status() {
            crate::GameStatus::Ongoing { next_player } => *next_player,
            _ => return None,
        };
        let opponent = crate::other_player(current_player);
        let n = board.board_size();
        let nbrs = Self::build_neighbor_map(n);
        let mut transposition_table: HashMap<(BTreeSet<u32>, BTreeSet<u32>), (u32, f64)> =
            HashMap::new();

        for &cell in available {
            let coords = Coordinates::from_index(cell, n);
            let mut test = board.clone();
            if test
                .add_move(crate::Movement::Placement {
                    player: current_player,
                    coords,
                })
                .is_ok()
                && matches!(
                    test.status(),
                    crate::GameStatus::Finished { winner } if *winner == current_player
                )
            {
                return Some(coords);
            }
        }

        for &cell in available {
            let coords = Coordinates::from_index(cell, n);
            let mut test = board.clone();
            if test
                .add_move(crate::Movement::Placement {
                    player: opponent,
                    coords,
                })
                .is_ok()
                && matches!(
                    test.status(),
                    crate::GameStatus::Finished { winner } if *winner == opponent
                )
            {
                return Some(coords);
            }
        }

        let total = n * (n + 1) / 2;
        let avail_set: HashSet<u32> = available.iter().copied().collect();
        let root_occupied: BTreeSet<u32> = (0..total).filter(|i| !avail_set.contains(i)).collect();

        let mut occupied = root_occupied.clone();
        let mut pc: BTreeSet<u32> = BTreeSet::new();
        let mut oc: BTreeSet<u32> = BTreeSet::new();

        let mut moves =
            Self::relevant_moves(available, &pc, &oc, &occupied, &root_occupied, n, &nbrs);
        moves.sort_by_key(|&cell| Reverse(Self::fast_score(cell, &pc, &oc, n, &nbrs)));

        let mut best_move = None;
        let mut best_value = f64::NEG_INFINITY;

        for cell in moves {
            let coords = Coordinates::from_index(cell, n);
            let mut new_board = board.clone();
            if new_board
                .add_move(crate::Movement::Placement {
                    player: current_player,
                    coords,
                })
                .is_ok()
            {
                pc.insert(cell);
                occupied.insert(cell);
                let value = self.minimax(
                    &new_board,
                    self.max_depth - 1,
                    false,
                    current_player,
                    opponent,
                    f64::NEG_INFINITY,
                    f64::INFINITY,
                    &mut pc,
                    &mut oc,
                    &mut occupied,
                    &root_occupied,
                    n,
                    &nbrs,
                    &mut transposition_table,
                );
                pc.remove(&cell);
                occupied.remove(&cell);

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
        assert!(bot.choose_move(&game).is_some());
    }

    #[test]
    fn test_minimax_bot_evaluate_win_and_loss() {
        let mut game = GameY::new(3);
        let moves = vec![
            crate::Movement::Placement {
                player: crate::PlayerId::new(0),
                coords: Coordinates::new(0, 0, 2),
            },
            crate::Movement::Placement {
                player: crate::PlayerId::new(1),
                coords: Coordinates::new(2, 0, 0),
            },
            crate::Movement::Placement {
                player: crate::PlayerId::new(0),
                coords: Coordinates::new(0, 1, 1),
            },
            crate::Movement::Placement {
                player: crate::PlayerId::new(1),
                coords: Coordinates::new(1, 1, 0),
            },
            crate::Movement::Placement {
                player: crate::PlayerId::new(0),
                coords: Coordinates::new(0, 2, 0),
            },
        ];
        for mv in moves {
            game.add_move(mv).unwrap();
        }
        assert!(matches!(
            game.status(),
            crate::GameStatus::Finished { winner } if *winner == crate::PlayerId::new(0)
        ));

        assert!(MinimaxBot::evaluate_board(&game, crate::PlayerId::new(0)) >= 1000.0);
        assert!(MinimaxBot::evaluate_board(&game, crate::PlayerId::new(1)) <= -1000.0);
    }

    #[test]
    fn test_minimax_bot_returns_none_on_full_board() {
        let bot = MinimaxBot::default();
        let mut game = GameY::new(2);
        for mv in [
            crate::Movement::Placement {
                player: crate::PlayerId::new(0),
                coords: Coordinates::new(1, 0, 0),
            },
            crate::Movement::Placement {
                player: crate::PlayerId::new(1),
                coords: Coordinates::new(0, 1, 0),
            },
            crate::Movement::Placement {
                player: crate::PlayerId::new(0),
                coords: Coordinates::new(0, 0, 1),
            },
        ] {
            game.add_move(mv).unwrap();
        }
        assert!(game.available_cells().is_empty());
        assert!(bot.choose_move(&game).is_none());
    }

    #[test]
    fn test_minimax_bot_prefers_winning_move() {
        let bot = MinimaxBot::default();
        let mut game = GameY::new(3);
        for mv in [
            crate::Movement::Placement {
                player: crate::PlayerId::new(0),
                coords: Coordinates::new(0, 0, 2),
            },
            crate::Movement::Placement {
                player: crate::PlayerId::new(1),
                coords: Coordinates::new(2, 0, 0),
            },
            crate::Movement::Placement {
                player: crate::PlayerId::new(0),
                coords: Coordinates::new(0, 1, 1),
            },
            crate::Movement::Placement {
                player: crate::PlayerId::new(1),
                coords: Coordinates::new(1, 1, 0),
            },
        ] {
            game.add_move(mv).unwrap();
        }
        assert_eq!(bot.choose_move(&game).unwrap(), Coordinates::new(0, 2, 0));
    }
}
