import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom';
import HistoryView from '../views/HistoryView';
import type { MatchHistoryItem } from '../stats/types';

function buildMatch(overrides: Partial<MatchHistoryItem> = {}): MatchHistoryItem {
  return {
    gameId: 'match-1',
    result: 'win',
    mode: 'human_vs_bot',
    winnerId: 'adri',
    botId: 'greedy_bot',
    endedAt: '2026-03-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('HistoryView', () => {
  test('shows the empty state and allows returning to the dashboard', () => {
    const onBack = vi.fn();

    render(<HistoryView matches={[]} onBack={onBack} />);

    expect(screen.getByText(/historial completo/i)).toBeInTheDocument();
    expect(screen.getByText(/todavia no hay partidas registradas/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /volver al inicio/i }));

    expect(onBack).toHaveBeenCalledTimes(1);
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

    render(<HistoryView matches={matches} onBack={vi.fn()} />);

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
});
