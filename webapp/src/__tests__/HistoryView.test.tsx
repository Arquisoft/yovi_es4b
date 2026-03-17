import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import '@testing-library/jest-dom';
import HistoryView from '../views/HistoryView';
import type { MatchHistoryItem, PlayerStatsSummary } from '../stats/types';

const PLAYER_STATS: PlayerStatsSummary = {
  totalGames: 8,
  victories: 5,
  defeats: 3,
  updatedAt: '2026-03-01T10:00:00.000Z',
};

function buildMatch(overrides: Partial<MatchHistoryItem> = {}): MatchHistoryItem {
  return {
    gameId: 'match-1',
    result: 'win',
    mode: 'human_vs_bot',
    winnerId: 'adri',
    botId: 'greedy_bot',
    endedAt: '2026-03-01T10:00:00.000Z',
    finalBoard: null,
    ...overrides,
  };
}

describe('HistoryView', () => {
  test('shows the empty state', () => {
    render(<HistoryView playerStats={PLAYER_STATS} matches={[]} />);

    expect(screen.getByText(/estadisticas/i)).toBeInTheDocument();
    expect(screen.getByText(/partidas jugadas/i)).toBeInTheDocument();
    expect(screen.getByText(/historial completo/i)).toBeInTheDocument();
    expect(screen.getByText(/todavia no hay partidas registradas/i)).toBeInTheDocument();
  });

  test('renders each match with mapped values and fallbacks', () => {
    const matches = [
      buildMatch(),
      buildMatch({
        gameId: 'match-2',
        result: 'loss',
        mode: 'human_vs_human',
        winnerId: 'rival',
        botId: null,
      }),
      buildMatch({
        gameId: 'match-3',
        mode: null,
        winnerId: null,
        botId: 'custom_bot',
      }),
    ];

    render(<HistoryView playerStats={PLAYER_STATS} matches={matches} />);

    expect(screen.getByText('match-1')).toBeInTheDocument();
    expect(screen.getByText('match-2')).toBeInTheDocument();
    expect(screen.getByText('match-3')).toBeInTheDocument();
    expect(screen.getAllByText(/victoria|derrota/i)).toHaveLength(3);
    expect(screen.getAllByText('Bot').length).toBeGreaterThan(1);
    expect(screen.getByText('Humano')).toBeInTheDocument();
    expect(screen.getByText('Intermedio')).toBeInTheDocument();
    expect(screen.getByText('custom_bot')).toBeInTheDocument();
    expect(screen.getByText('rival')).toBeInTheDocument();
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
    expect(screen.getAllByText(new Date(matches[0].endedAt).toLocaleString())).toHaveLength(3);
  });

  test('opens the final board preview when a match includes finalBoard', () => {
    const matches = [
      buildMatch({
        finalBoard: {
          size: 3,
          turn: 5,
          players: ['B', 'R'],
          layout: 'B/R./...',
        },
      }),
      buildMatch({
        gameId: 'match-no-board',
      }),
    ];

    render(<HistoryView playerStats={PLAYER_STATS} matches={matches} />);

    fireEvent.click(screen.getByRole('button', { name: 'match-1' }));

    expect(screen.getByText('Tablero final - match-1')).toBeInTheDocument();
    expect(screen.getByText(/estado final guardado en el historial/i)).toBeInTheDocument();
    expect(screen.getAllByTestId(/hex-/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'match-no-board' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(screen.queryByText('Tablero final - match-1')).not.toBeInTheDocument();
  });
});
