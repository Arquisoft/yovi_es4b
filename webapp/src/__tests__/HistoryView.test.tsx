import { fireEvent, render, screen, within } from '@testing-library/react';
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

    const rows = screen.getAllByRole('row');
    const matchOneRow = rows.find((row) => within(row).queryByText('match-1'));
    const matchTwoRow = rows.find((row) => within(row).queryByText('match-2'));
    const matchThreeRow = rows.find((row) => within(row).queryByText('match-3'));

    expect(matchOneRow).toBeTruthy();
    expect(matchTwoRow).toBeTruthy();
    expect(matchThreeRow).toBeTruthy();

    expect(within(matchOneRow as HTMLElement).getByText('Victoria')).toBeInTheDocument();
    expect(within(matchOneRow as HTMLElement).getByText('Bot')).toBeInTheDocument();
    expect(within(matchOneRow as HTMLElement).getByText('Intermedio')).toBeInTheDocument();
    expect(within(matchTwoRow as HTMLElement).getByText('Derrota')).toBeInTheDocument();
    expect(within(matchTwoRow as HTMLElement).getByText('Humano')).toBeInTheDocument();
    expect(within(matchTwoRow as HTMLElement).getByText('rival')).toBeInTheDocument();
    expect(within(matchThreeRow as HTMLElement).getByText('custom_bot')).toBeInTheDocument();
    expect(within(matchThreeRow as HTMLElement).getAllByText('-').length).toBeGreaterThan(0);
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

    const noBoardRow = screen
      .getAllByRole('row')
      .find((row) => within(row).queryByText('match-no-board'));

    expect(noBoardRow).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sin tablero' })).toBeDisabled();
    fireEvent.click(noBoardRow as HTMLElement);
    expect(screen.queryByText('Tablero final - match-no-board')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ver tablero' }));

    expect(screen.getByText('Tablero final - match-1')).toBeInTheDocument();
    expect(screen.getByText(/estado final guardado en el historial/i)).toBeInTheDocument();
    expect(screen.getAllByTestId(/hex-/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(screen.queryByText('Tablero final - match-1')).not.toBeInTheDocument();
  });
});
