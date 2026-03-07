import { render, screen } from '@testing-library/react';
import GameView from '../views/GameView';
import { describe, expect, test } from 'vitest';
import '@testing-library/jest-dom';

const baseGame = {
  game_id: '123',
  yen: { size: 3, turn: 0, players: ['X', 'O'], layout: '' },
  game_over: false,
  next_player: 0,
  winner: null,
};

describe('GameView', () => {
  test('shows bot difficulty when bot_id is present', () => {
    const game = { ...baseGame, bot_id: 'greedy_bot' };
    render(
      <GameView
        game={game}
        board={[]}
        statusText="status"
        canPlayCell={false}
        loading={false}
        refreshCurrentGame={() => {}}
        resignCurrentGame={() => {}}
        playCell={() => {}}
        onBack={() => {}}
      />,
    );

    expect(screen.getByText(/bot:/i)).toBeInTheDocument();
    expect(screen.getByText(/medio/)).toBeInTheDocument();
  });
});
