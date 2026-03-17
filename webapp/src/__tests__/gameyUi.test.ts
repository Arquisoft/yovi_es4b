import { describe, expect, test } from 'vitest';
import {
  canHumanPlay,
  cellClassName,
  findWinningConnectionCellKeysFromBoard,
  findWinningConnectionCellKeys,
  gameStatusText,
  playerName,
  toCoordsKey,
  toBoardCells,
  toBoardCellsFromYen,
} from '../gameyUi';
import type { GameStateResponse } from '../gameyApi';

function buildGame(overrides: Partial<GameStateResponse> = {}): GameStateResponse {
  return {
    api_version: '1.0.0',
    game_id: 'game-1',
    mode: 'human_vs_bot',
    bot_id: null,
    yen: {
      size: 3,
      turn: 0,
      players: ['B', 'R'],
      layout: 'B/R./..R',
    },
    game_over: false,
    next_player: 0,
    winner: null,
    ...overrides,
  };
}

describe('gameyUi', () => {
  test('converts the YEN layout into board cells with computed coordinates', () => {
    const board = toBoardCells(buildGame());

    expect(board).toHaveLength(3);
    expect(board[0][0]).toEqual({
      key: '0-0',
      symbol: 'B',
      coords: { x: 2, y: 0, z: 0 },
    });
    expect(board[1][1]).toEqual({
      key: '1-1',
      symbol: '.',
      coords: { x: 1, y: 1, z: 0 },
    });
    expect(board[2][2]).toEqual({
      key: '2-2',
      symbol: 'R',
      coords: { x: 0, y: 2, z: 0 },
    });
  });

  test('converts a final board snapshot into board cells', () => {
    const board = toBoardCellsFromYen({
      size: 3,
      layout: 'B/R./..R',
    });

    expect(board).toHaveLength(3);
    expect(board[1][0]).toEqual({
      key: '1-0',
      symbol: 'R',
      coords: { x: 1, y: 0, z: 1 },
    });
  });

  test('allows the human player only when the game is active and the turn is valid', () => {
    expect(canHumanPlay(buildGame({ mode: 'human_vs_human', next_player: 1 }))).toBe(true);
    expect(canHumanPlay(buildGame({ mode: 'human_vs_bot', next_player: 0 }))).toBe(true);
    expect(canHumanPlay(buildGame({ mode: 'human_vs_bot', next_player: 1 }))).toBe(false);
    expect(canHumanPlay(buildGame({ game_over: true, next_player: 0 }))).toBe(false);
  });

  test('builds player names and status text with winner and unknown fallbacks', () => {
    expect(playerName(buildGame(), 1)).toBe('Player 1 (R)');
    expect(playerName(buildGame({ yen: { size: 3, turn: 0, players: ['B'], layout: 'B/R./..R' } }), 3)).toBe('Player 3 (?)');

    expect(gameStatusText(buildGame({ next_player: 1 }))).toBe('Turno: Player 1 (R)');
    expect(gameStatusText(buildGame({ next_player: null }))).toBe('Turno: desconocido');
    expect(gameStatusText(buildGame({ game_over: true, winner: 0 }))).toBe('Partida finalizada. Ganador: Player 0 (B)');
    expect(gameStatusText(buildGame({ game_over: true, winner: null }))).toBe('Partida finalizada. Ganador: desconocido');
  });

  test('maps board symbols to UI class names', () => {
    expect(cellClassName('B')).toBe('cell cell-b');
    expect(cellClassName('R')).toBe('cell cell-r');
    expect(cellClassName('.')).toBe('cell cell-empty');
  });

  test('finds winner connection cells that touch all three triangle sides', () => {
    const game = buildGame({
      game_over: true,
      winner: 0,
      yen: {
        size: 3,
        turn: 0,
        players: ['B', 'R'],
        layout: 'B/BB/BBR',
      },
    });

    const winningKeys = findWinningConnectionCellKeys(game);

    expect(winningKeys.size).toBe(5);
    expect(winningKeys).toEqual(
      new Set([
        toCoordsKey({ x: 2, y: 0, z: 0 }),
        toCoordsKey({ x: 1, y: 0, z: 1 }),
        toCoordsKey({ x: 1, y: 1, z: 0 }),
        toCoordsKey({ x: 0, y: 0, z: 2 }),
        toCoordsKey({ x: 0, y: 1, z: 1 }),
      ]),
    );
  });

  test('returns empty winner connection when game is ongoing or winner symbol is unknown', () => {
    expect(findWinningConnectionCellKeys(buildGame({ game_over: false, winner: null }))).toEqual(new Set());
    expect(
      findWinningConnectionCellKeys(
        buildGame({
          game_over: true,
          winner: 1,
          yen: { size: 3, turn: 0, players: ['B'], layout: 'B/BB/BBR' },
        }),
      ),
    ).toEqual(new Set());
  });

  test('finds winner connection cells directly from a board snapshot', () => {
    const winningKeys = findWinningConnectionCellKeysFromBoard({
      size: 3,
      players: ['B', 'R'],
      layout: 'B/BB/BBR',
    });

    expect(winningKeys.size).toBe(5);
    expect(winningKeys).toEqual(
      new Set([
        toCoordsKey({ x: 2, y: 0, z: 0 }),
        toCoordsKey({ x: 1, y: 0, z: 1 }),
        toCoordsKey({ x: 1, y: 1, z: 0 }),
        toCoordsKey({ x: 0, y: 0, z: 2 }),
        toCoordsKey({ x: 0, y: 1, z: 1 }),
      ]),
    );
  });
});
