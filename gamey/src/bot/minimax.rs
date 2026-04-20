//! A minimax bot implementation — improved version.
use crate::{Coordinates, GameY, PlayerId, YBot};
use std::cmp::Reverse;
use std::collections::{BTreeSet, BinaryHeap, HashMap, HashSet};

pub struct MinimaxBot {
    max_depth: u32,
}

type PathHeap = BinaryHeap<Reverse<(u32, u32)>>;
type TranspositionTable = HashMap<(BTreeSet<u32>, BTreeSet<u32>), (u32, f64)>;

struct PathSearch<'a> {
    my: &'a BTreeSet<u32>,
    opp: &'a BTreeSet<u32>,
    root_occupied: &'a BTreeSet<u32>,
    n: u32,
    nbrs: &'a HashMap<u32, Vec<u32>>,
}

impl<'a> PathSearch<'a> {
    fn new(
        my: &'a BTreeSet<u32>,
        opp: &'a BTreeSet<u32>,
        root_occupied: &'a BTreeSet<u32>,
        n: u32,
        nbrs: &'a HashMap<u32, Vec<u32>>,
    ) -> Self {
        Self {
            my,
            opp,
            root_occupied,
            n,
            nbrs,
        }
    }

    fn total_cells(&self) -> u32 {
        self.n * (self.n + 1) / 2
    }

    fn is_wall(&self, idx: u32) -> bool {
        self.opp.contains(&idx) || (self.root_occupied.contains(&idx) && !self.my.contains(&idx))
    }

    fn step_cost(&self, idx: u32) -> u32 {
        if self.my.contains(&idx) { 0 } else { 1 }
    }

    fn touches_edge(&self, idx: u32, edge: u8) -> bool {
        let (x, y, z) = MinimaxBot::xyz(idx, self.n);
        MinimaxBot::edge_mask(x, y, z) & edge != 0
    }

    fn initialize_sources(&self, from_edge: u8, dist: &mut [u32], heap: &mut PathHeap) {
        for idx in 0..self.total_cells() {
            if self.is_wall(idx) || !self.touches_edge(idx, from_edge) {
                continue;
            }

            let cost = self.step_cost(idx);
            if cost < dist[idx as usize] {
                dist[idx as usize] = cost;
                heap.push(Reverse((cost, idx)));
            }
        }
    }

    fn find_goal(
        &self,
        to_edge: u8,
        dist: &mut [u32],
        prev: &mut [u32],
        heap: &mut PathHeap,
    ) -> Option<(u32, u32)> {
        while let Some(Reverse((distance, idx))) = heap.pop() {
            if dist[idx as usize] < distance {
                continue;
            }

            if self.touches_edge(idx, to_edge) {
                return Some((distance, idx));
            }

            self.relax_neighbors(idx, distance, dist, prev, heap);
        }

        None
    }

    fn relax_neighbors(
        &self,
        idx: u32,
        distance: u32,
        dist: &mut [u32],
        prev: &mut [u32],
        heap: &mut PathHeap,
    ) {
        let Some(neighbors) = self.nbrs.get(&idx) else {
            return;
        };

        for &neighbor in neighbors {
            if self.is_wall(neighbor) {
                continue;
            }

            let next_distance = distance + self.step_cost(neighbor);
            if next_distance < dist[neighbor as usize] {
                dist[neighbor as usize] = next_distance;
                prev[neighbor as usize] = idx;
                heap.push(Reverse((next_distance, neighbor)));
            }
        }
    }

    fn reconstruct_path(&self, prev: &[u32], end: u32) -> Vec<u32> {
        let mut path = Vec::new();
        let mut current = end;

        while current != u32::MAX {
            if !self.my.contains(&current) {
                path.push(current);
            }
            current = prev[current as usize];
        }

        path
    }
}

struct SearchWindow {
    alpha: f64,
    beta: f64,
    value: f64,
    maximizing: bool,
}

impl SearchWindow {
    fn new(maximizing: bool, alpha: f64, beta: f64) -> Self {
        let value = if maximizing {
            f64::NEG_INFINITY
        } else {
            f64::INFINITY
        };

        Self {
            alpha,
            beta,
            value,
            maximizing,
        }
    }

    fn record(&mut self, eval: f64) -> bool {
        if self.maximizing {
            self.value = self.value.max(eval);
            self.alpha = self.alpha.max(eval);
        } else {
            self.value = self.value.min(eval);
            self.beta = self.beta.min(eval);
        }

        self.beta <= self.alpha
    }
}

impl Default for MinimaxBot {
    fn default() -> Self {
        Self { max_depth: 6 }
    }
}

impl MinimaxBot {
    const THREAT_PATHS: [(u8, u8); 3] = [(0b001, 0b010), (0b010, 0b100), (0b001, 0b100)];
    const RELEVANT_THREAT_COST_LIMIT: u32 = 4;

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
        let search = PathSearch::new(my, opp, root_occupied, n, nbrs);
        let total = search.total_cells();
        let mut dist = vec![u32::MAX; total as usize];
        let mut prev = vec![u32::MAX; total as usize];
        let mut heap = PathHeap::new();

        search.initialize_sources(from_edge, &mut dist, &mut heap);
        let (cost, end) = search.find_goal(to_edge, &mut dist, &mut prev, &mut heap)?;

        Some((cost, search.reconstruct_path(&prev, end)))
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

    #[inline]
    fn centrality(idx: u32, n: u32) -> u32 {
        let (x, y, z) = Self::xyz(idx, n);
        x.min(y).min(z)
    }

    fn sort_moves_by_centrality(moves: &mut [u32], n: u32) {
        moves.sort_by_key(|&idx| Reverse(Self::centrality(idx, n)));
    }

    fn all_moves_by_centrality(available: &[u32], n: u32) -> Vec<u32> {
        let mut moves = available.to_vec();
        Self::sort_moves_by_centrality(&mut moves, n);
        moves
    }

    fn insert_available_cells<I>(relevant: &mut HashSet<u32>, avail_set: &HashSet<u32>, cells: I)
    where
        I: IntoIterator<Item = u32>,
    {
        for cell in cells {
            if avail_set.contains(&cell) {
                relevant.insert(cell);
            }
        }
    }

    fn extend_relevant_neighbors(
        origin: u32,
        relevant: &mut HashSet<u32>,
        avail_set: &HashSet<u32>,
        nbrs: &HashMap<u32, Vec<u32>>,
    ) {
        let Some(neighbors) = nbrs.get(&origin) else {
            return;
        };

        for &neighbor in neighbors {
            if !avail_set.contains(&neighbor) {
                continue;
            }

            relevant.insert(neighbor);
            if let Some(second_ring) = nbrs.get(&neighbor) {
                Self::insert_available_cells(relevant, avail_set, second_ring.iter().copied());
            }
        }
    }

    fn collect_neighbor_relevant_moves(
        occupied: &BTreeSet<u32>,
        avail_set: &HashSet<u32>,
        nbrs: &HashMap<u32, Vec<u32>>,
    ) -> HashSet<u32> {
        let mut relevant = HashSet::new();

        for &cell in occupied {
            Self::extend_relevant_neighbors(cell, &mut relevant, avail_set, nbrs);
        }

        relevant
    }

    fn add_opponent_threat_moves(
        relevant: &mut HashSet<u32>,
        avail_set: &HashSet<u32>,
        my: &BTreeSet<u32>,
        opp: &BTreeSet<u32>,
        root_occupied: &BTreeSet<u32>,
        n: u32,
        nbrs: &HashMap<u32, Vec<u32>>,
    ) {
        if opp.is_empty() {
            return;
        }

        for (from_edge, to_edge) in Self::THREAT_PATHS {
            let Some((cost, path)) =
                Self::min_path_with_cells(from_edge, to_edge, opp, my, root_occupied, n, nbrs)
            else {
                continue;
            };

            if cost <= Self::RELEVANT_THREAT_COST_LIMIT {
                Self::insert_available_cells(relevant, avail_set, path);
            }
        }
    }

    fn finalize_relevant_moves(available: &[u32], relevant: HashSet<u32>, n: u32) -> Vec<u32> {
        let mut moves = if relevant.is_empty() {
            available.to_vec()
        } else {
            relevant.into_iter().collect()
        };
        Self::sort_moves_by_centrality(&mut moves, n);
        moves
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

        if occupied.len() < 2 {
            return Self::all_moves_by_centrality(available, n);
        }

        let mut relevant = Self::collect_neighbor_relevant_moves(occupied, &avail_set, nbrs);
        Self::add_opponent_threat_moves(&mut relevant, &avail_set, my, opp, root_occupied, n, nbrs);

        Self::finalize_relevant_moves(available, relevant, n)
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

    fn cached_minimax_value(
        transposition_table: &TranspositionTable,
        key: &(BTreeSet<u32>, BTreeSet<u32>),
        depth: u32,
    ) -> Option<f64> {
        match transposition_table.get(key) {
            Some(&(stored_depth, stored_value)) if stored_depth >= depth => Some(stored_value),
            _ => None,
        }
    }

    fn store_minimax_value(
        transposition_table: &mut TranspositionTable,
        key: (BTreeSet<u32>, BTreeSet<u32>),
        depth: u32,
        value: f64,
    ) -> f64 {
        transposition_table.insert(key, (depth, value));
        value
    }

    fn is_terminal_minimax_node(board: &GameY, depth: u32) -> bool {
        depth == 0 || matches!(board.status(), crate::GameStatus::Finished { .. })
    }

    fn current_player(maximizing: bool, player: PlayerId, opponent: PlayerId) -> PlayerId {
        if maximizing { player } else { opponent }
    }

    fn filter_sets<'a>(
        maximizing: bool,
        pc: &'a BTreeSet<u32>,
        oc: &'a BTreeSet<u32>,
    ) -> (&'a BTreeSet<u32>, &'a BTreeSet<u32>) {
        if maximizing { (pc, oc) } else { (oc, pc) }
    }

    fn ordered_minimax_moves(
        board: &GameY,
        maximizing: bool,
        pc: &BTreeSet<u32>,
        oc: &BTreeSet<u32>,
        occupied: &BTreeSet<u32>,
        root_occupied: &BTreeSet<u32>,
        n: u32,
        nbrs: &HashMap<u32, Vec<u32>>,
    ) -> Vec<u32> {
        let (my_in_filter, opp_in_filter) = Self::filter_sets(maximizing, pc, oc);
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
            let score = Self::fast_score(cell, my_in_filter, opp_in_filter, n, nbrs);
            if maximizing { -score } else { score }
        });

        moves
    }

    fn apply_search_move(
        maximizing: bool,
        cell: u32,
        pc: &mut BTreeSet<u32>,
        oc: &mut BTreeSet<u32>,
        occupied: &mut BTreeSet<u32>,
    ) {
        if maximizing {
            pc.insert(cell);
        } else {
            oc.insert(cell);
        }
        occupied.insert(cell);
    }

    fn rollback_search_move(
        maximizing: bool,
        cell: u32,
        pc: &mut BTreeSet<u32>,
        oc: &mut BTreeSet<u32>,
        occupied: &mut BTreeSet<u32>,
    ) {
        if maximizing {
            pc.remove(&cell);
        } else {
            oc.remove(&cell);
        }
        occupied.remove(&cell);
    }

    #[allow(clippy::too_many_arguments)]
    fn evaluate_minimax_child(
        &self,
        board: &GameY,
        cell: u32,
        depth: u32,
        maximizing: bool,
        player: PlayerId,
        opponent: PlayerId,
        alpha: f64,
        beta: f64,
        pc: &mut BTreeSet<u32>,
        oc: &mut BTreeSet<u32>,
        occupied: &mut BTreeSet<u32>,
        root_occupied: &BTreeSet<u32>,
        n: u32,
        nbrs: &HashMap<u32, Vec<u32>>,
        transposition_table: &mut TranspositionTable,
    ) -> Option<f64> {
        let coords = Coordinates::from_index(cell, n);
        let current = Self::current_player(maximizing, player, opponent);
        let mut next_board = board.clone();

        next_board
            .add_move(crate::Movement::Placement {
                player: current,
                coords,
            })
            .ok()?;

        Self::apply_search_move(maximizing, cell, pc, oc, occupied);
        let eval = self.minimax(
            &next_board,
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
        Self::rollback_search_move(maximizing, cell, pc, oc, occupied);

        Some(eval)
    }

    #[allow(clippy::too_many_arguments)]
    fn search_minimax_children(
        &self,
        board: &GameY,
        depth: u32,
        maximizing: bool,
        player: PlayerId,
        opponent: PlayerId,
        moves: Vec<u32>,
        window: &mut SearchWindow,
        pc: &mut BTreeSet<u32>,
        oc: &mut BTreeSet<u32>,
        occupied: &mut BTreeSet<u32>,
        root_occupied: &BTreeSet<u32>,
        n: u32,
        nbrs: &HashMap<u32, Vec<u32>>,
        transposition_table: &mut TranspositionTable,
    ) -> f64 {
        for cell in moves {
            let Some(eval) = self.evaluate_minimax_child(
                board,
                cell,
                depth,
                maximizing,
                player,
                opponent,
                window.alpha,
                window.beta,
                pc,
                oc,
                occupied,
                root_occupied,
                n,
                nbrs,
                transposition_table,
            ) else {
                continue;
            };

            if window.record(eval) {
                break;
            }
        }

        window.value
    }

    #[allow(clippy::too_many_arguments)]
    fn minimax(
        &self,
        board: &GameY,
        depth: u32,
        maximizing: bool,
        player: PlayerId,
        opponent: PlayerId,
        alpha: f64,
        beta: f64,
        pc: &mut BTreeSet<u32>,
        oc: &mut BTreeSet<u32>,
        occupied: &mut BTreeSet<u32>,
        root_occupied: &BTreeSet<u32>,
        n: u32,
        nbrs: &HashMap<u32, Vec<u32>>,
        transposition_table: &mut TranspositionTable,
    ) -> f64 {
        let key = (pc.clone(), oc.clone());
        if let Some(cached_value) = Self::cached_minimax_value(transposition_table, &key, depth) {
            return cached_value;
        }

        if Self::is_terminal_minimax_node(board, depth) {
            let eval = Self::evaluate(board, player, pc, oc, root_occupied, n, nbrs);
            return Self::store_minimax_value(transposition_table, key, depth, eval);
        }

        let moves = Self::ordered_minimax_moves(
            board,
            maximizing,
            pc,
            oc,
            occupied,
            root_occupied,
            n,
            nbrs,
        );
        let mut window = SearchWindow::new(maximizing, alpha, beta);
        let value = self.search_minimax_children(
            board,
            depth,
            maximizing,
            player,
            opponent,
            moves,
            &mut window,
            pc,
            oc,
            occupied,
            root_occupied,
            n,
            nbrs,
            transposition_table,
        );

        Self::store_minimax_value(transposition_table, key, depth, value)
    }

    fn find_immediate_winning_move(
        board: &GameY,
        available: &[u32],
        player: PlayerId,
        n: u32,
    ) -> Option<Coordinates> {
        for &cell in available {
            let coords = Coordinates::from_index(cell, n);
            let mut test_board = board.clone();

            if test_board
                .add_move(crate::Movement::Placement { player, coords })
                .is_ok()
                && matches!(
                    test_board.status(),
                    crate::GameStatus::Finished { winner } if *winner == player
                )
            {
                return Some(coords);
            }
        }

        None
    }

    fn root_occupied_from_available(available: &[u32], n: u32) -> BTreeSet<u32> {
        let total = n * (n + 1) / 2;
        let avail_set: HashSet<u32> = available.iter().copied().collect();
        (0..total).filter(|idx| !avail_set.contains(idx)).collect()
    }

    #[allow(clippy::too_many_arguments)]
    fn choose_best_root_move(
        &self,
        board: &GameY,
        current_player: PlayerId,
        opponent: PlayerId,
        root_occupied: &BTreeSet<u32>,
        n: u32,
        nbrs: &HashMap<u32, Vec<u32>>,
        transposition_table: &mut TranspositionTable,
    ) -> Option<Coordinates> {
        let mut occupied = root_occupied.clone();
        let mut pc = BTreeSet::new();
        let mut oc = BTreeSet::new();
        let moves =
            Self::ordered_minimax_moves(board, true, &pc, &oc, &occupied, root_occupied, n, nbrs);
        let mut best_move = None;
        let mut best_value = f64::NEG_INFINITY;

        for cell in moves {
            let Some(value) = self.evaluate_minimax_child(
                board,
                cell,
                self.max_depth,
                true,
                current_player,
                opponent,
                f64::NEG_INFINITY,
                f64::INFINITY,
                &mut pc,
                &mut oc,
                &mut occupied,
                root_occupied,
                n,
                nbrs,
                transposition_table,
            ) else {
                continue;
            };

            if value > best_value {
                best_value = value;
                best_move = Some(Coordinates::from_index(cell, n));
            }
        }

        best_move
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

        let current_player = board.next_player()?;
        let opponent = crate::other_player(current_player);
        let n = board.board_size();
        let nbrs = Self::build_neighbor_map(n);
        let mut transposition_table: TranspositionTable = HashMap::new();

        if let Some(winning_move) =
            Self::find_immediate_winning_move(board, available, current_player, n)
        {
            return Some(winning_move);
        }

        if let Some(blocking_move) =
            Self::find_immediate_winning_move(board, available, opponent, n)
        {
            return Some(blocking_move);
        }

        let root_occupied = Self::root_occupied_from_available(available, n);
        self.choose_best_root_move(
            board,
            current_player,
            opponent,
            &root_occupied,
            n,
            &nbrs,
            &mut transposition_table,
        )
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

    #[test]
    fn test_min_path_with_cells_reconstructs_the_only_open_route() {
        let n = 2;
        let my_cell = Coordinates::new(0, 0, 1).to_index(n);
        let blocked_cell = Coordinates::new(0, 1, 0).to_index(n);
        let required_free_cell = Coordinates::new(1, 0, 0).to_index(n);

        let my = BTreeSet::from([my_cell]);
        let opp = BTreeSet::from([blocked_cell]);
        let root_occupied = BTreeSet::from([my_cell, blocked_cell]);
        let nbrs = MinimaxBot::build_neighbor_map(n);

        let (cost, path) =
            MinimaxBot::min_path_with_cells(0b001, 0b100, &my, &opp, &root_occupied, n, &nbrs)
                .expect("expected a valid path");

        assert_eq!(cost, 1);
        assert_eq!(path, vec![required_free_cell]);
    }
}
