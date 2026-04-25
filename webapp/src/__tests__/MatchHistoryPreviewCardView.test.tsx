import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom';
import MatchHistoryPreviewCardView from '../views/MatchHistoryPreviewCardView';
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

describe('MatchHistoryPreviewCardView', () => {
  test('shows an empty state when there are no matches', () => {
    render(<MatchHistoryPreviewCardView matches={[]} onViewMoreMatches={vi.fn()} />);

    expect(screen.getByText(/todavia no hay partidas registradas/i)).toBeInTheDocument();
  });

  test('renders only the first three matches with mapped labels', () => {
    const matches = [
      buildMatch({ gameId: 'match-1', result: 'win', mode: 'human_vs_bot', botId: 'greedy_bot' }),
      buildMatch({ gameId: 'match-2', result: 'loss', mode: 'local_human_vs_human', botId: null, winnerId: 'rival' }),
      buildMatch({ gameId: 'match-3', result: 'win', mode: 'online', botId: null, winnerId: 'online-rival' }),
      buildMatch({ gameId: 'match-4' }),
    ];

    render(<MatchHistoryPreviewCardView matches={matches} onViewMoreMatches={vi.fn()} />);

    expect(screen.getByText('match-1')).toBeInTheDocument();
    expect(screen.getByText('match-2')).toBeInTheDocument();
    expect(screen.getByText('match-3')).toBeInTheDocument();
    expect(screen.queryByText('match-4')).not.toBeInTheDocument();
    expect(screen.getAllByText(/victoria|derrota/i)).toHaveLength(3);
    expect(screen.getAllByText('Bot').length).toBeGreaterThan(1);
    expect(screen.getByText('Humano local')).toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
    expect(screen.getByText('Intermedio')).toBeInTheDocument();
    expect(screen.getByText('online-rival')).toBeInTheDocument();
    expect(screen.getAllByText(new Date(matches[0].endedAt).toLocaleString())).toHaveLength(3);
  });

  test('calls the view more handler', () => {
    const onViewMoreMatches = vi.fn();

    render(<MatchHistoryPreviewCardView matches={[]} onViewMoreMatches={onViewMoreMatches} />);

    fireEvent.click(screen.getByRole('button', { name: /ver mas partidas/i }));

    expect(onViewMoreMatches).toHaveBeenCalledTimes(1);
  });
});
