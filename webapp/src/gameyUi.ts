import type { Coordinates, GameStateResponse, YEN } from './gameyApi';

export interface BoardCell {
  key: string;
  symbol: string;
  coords: Coordinates;
}

export function toCoordsKey(coords: Coordinates): string {
  return `${coords.x}-${coords.y}-${coords.z}`;
}

function touchesAllSides(component: Iterable<BoardCell>): boolean {
  let touchesSideA = false;
  let touchesSideB = false;
  let touchesSideC = false;

  for (const cell of component) {
    touchesSideA = touchesSideA || cell.coords.x === 0;
    touchesSideB = touchesSideB || cell.coords.y === 0;
    touchesSideC = touchesSideC || cell.coords.z === 0;
  }

  return touchesSideA && touchesSideB && touchesSideC;
}

function getNeighborCoordinates(coords: Coordinates): Coordinates[] {
  const { x, y, z } = coords;
  const neighbors: Coordinates[] = [];

  if (x > 0) {
    neighbors.push(
      { x: x - 1, y: y + 1, z },
      { x: x - 1, y, z: z + 1 },
    );
  }

  if (y > 0) {
    neighbors.push(
      { x: x + 1, y: y - 1, z },
      { x, y: y - 1, z: z + 1 },
    );
  }

  if (z > 0) {
    neighbors.push(
      { x: x + 1, y, z: z - 1 },
      { x, y: y + 1, z: z - 1 },
    );
  }

  return neighbors;
}

export function toBoardCells(game: GameStateResponse): BoardCell[][] {
  return toBoardCellsFromYen(game.yen);
}

export function toBoardCellsFromYen(yen: Pick<YEN, 'size' | 'layout'>): BoardCell[][] {
  const rows = yen.layout.split('/');
  const size = yen.size;

  return rows.map((row, rowIndex) =>
    Array.from(row).map((symbol, columnIndex) => {
      const x = size - 1 - rowIndex;
      const y = columnIndex;
      const z = rowIndex - columnIndex;
      return {
        key: `${rowIndex}-${columnIndex}`,
        symbol,
        coords: { x, y, z },
      };
    }),
  );
}

function findWinningComponentKeys(boardCells: BoardCell[][], symbol: string): Set<string> {
  if (!symbol) {
    return new Set();
  }

  const winnerCells = collectSymbolCells(boardCells, symbol);

  const visited = new Set<string>();
  for (const [startKey, startCell] of winnerCells.entries()) {
    if (visited.has(startKey)) {
      continue;
    }

    const componentCells = collectConnectedComponent(
      startKey,
      startCell,
      winnerCells,
      visited,
    );

    if (touchesAllSides(componentCells)) {
      return toBoardCellKeySet(componentCells);
    }
  }

  return new Set();
}

function collectSymbolCells(boardCells: BoardCell[][], symbol: string): Map<string, BoardCell> {
  const winnerCells = new Map<string, BoardCell>();

  for (const row of boardCells) {
    for (const cell of row) {
      if (cell.symbol === symbol) {
        winnerCells.set(toCoordsKey(cell.coords), cell);
      }
    }
  }

  return winnerCells;
}

function collectConnectedComponent(
  startKey: string,
  startCell: BoardCell,
  winnerCells: ReadonlyMap<string, BoardCell>,
  visited: Set<string>,
): BoardCell[] {
  const componentCells: BoardCell[] = [];
  const queue: BoardCell[] = [startCell];

  visited.add(startKey);

  for (const current of queue) {
    componentCells.push(current);
    enqueueConnectedNeighbors(current, winnerCells, visited, queue);
  }

  return componentCells;
}

function enqueueConnectedNeighbors(
  cell: BoardCell,
  winnerCells: ReadonlyMap<string, BoardCell>,
  visited: Set<string>,
  queue: BoardCell[],
): void {
  for (const neighborCoords of getNeighborCoordinates(cell.coords)) {
    const neighborKey = toCoordsKey(neighborCoords);
    if (visited.has(neighborKey)) {
      continue;
    }

    const neighborCell = winnerCells.get(neighborKey);
    if (!neighborCell) {
      continue;
    }

    visited.add(neighborKey);
    queue.push(neighborCell);
  }
}

function toBoardCellKeySet(cells: Iterable<BoardCell>): Set<string> {
  return new Set(Array.from(cells, (cell) => toCoordsKey(cell.coords)));
}

export function findWinningConnectionCellKeys(game: GameStateResponse): Set<string> {
  if (!game.game_over || game.winner === null) {
    return new Set();
  }

  const winnerSymbol = game.yen.players[game.winner];
  if (!winnerSymbol) {
    return new Set();
  }

  return findWinningComponentKeys(toBoardCells(game), winnerSymbol);
}

export function findWinningConnectionCellKeysFromBoard(boardSnapshot: Pick<YEN, 'size' | 'layout' | 'players'>): Set<string> {
  const boardCells = toBoardCellsFromYen(boardSnapshot);

  for (const symbol of boardSnapshot.players) {
    if (typeof symbol !== 'string' || symbol.length === 0) {
      continue;
    }

    const winningKeys = findWinningComponentKeys(boardCells, symbol);
    if (winningKeys.size > 0) {
      return winningKeys;
    }
  }

  return new Set();
}

export function canHumanPlay(game: GameStateResponse): boolean {
  return !game.game_over && (game.mode === 'human_vs_human' || game.next_player === 0);
}

export function playerName(game: GameStateResponse, playerId: number): string {
  const symbol = game.yen.players[playerId] ?? '?';
  return `Player ${playerId} (${symbol})`;
}

export function gameStatusText(game: GameStateResponse): string {
  if (game.game_over) {
    return `Partida finalizada. Ganador: ${
      game.winner === null ? 'desconocido' : playerName(game, game.winner)
    }`;
  }

  return `Turno: ${
    game.next_player === null ? 'desconocido' : playerName(game, game.next_player)
  }`;
}

export function cellClassName(symbol: string): string {
  if (symbol === 'B') {
    return 'cell cell-b';
  }
  if (symbol === 'R') {
    return 'cell cell-r';
  }
  return 'cell cell-empty';
}
