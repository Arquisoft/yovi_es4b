import type { Coordinates, GameStateResponse } from './gameyApi';

export interface BoardCell {
  key: string;
  symbol: string;
  coords: Coordinates;
}

export function toBoardCells(game: GameStateResponse): BoardCell[][] {
  const rows = game.yen.layout.split('/');
  const size = game.yen.size;

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
