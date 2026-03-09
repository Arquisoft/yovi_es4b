import { describe, expect, test } from 'vitest';
import {
  canHumanPlay,
  cellClassName,
  gameStatusText,
  playerName,
  toBoardCells,
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
});
