import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
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
        mode: 'local_human_vs_human',
        winnerId: 'rival',
        botId: null,
      }),
      buildMatch({
        gameId: 'match-3',
        mode: 'online',
        winnerId: 'online-rival',
        botId: null,
      }),
      buildMatch({
        gameId: 'match-4',
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
    const matchFourRow = rows.find((row) => within(row).queryByText('match-4'));

    expect(matchOneRow).toBeTruthy();
    expect(matchTwoRow).toBeTruthy();
    expect(matchThreeRow).toBeTruthy();
    expect(matchFourRow).toBeTruthy();

    expect(within(matchOneRow as HTMLElement).getByText('Victoria')).toBeInTheDocument();
    expect(within(matchOneRow as HTMLElement).getByText('Bot')).toBeInTheDocument();
    expect(within(matchOneRow as HTMLElement).getByText('Intermedio')).toBeInTheDocument();
    expect(within(matchTwoRow as HTMLElement).getByText('Derrota')).toBeInTheDocument();
    expect(within(matchTwoRow as HTMLElement).getByText('Humano local')).toBeInTheDocument();
    expect(within(matchTwoRow as HTMLElement).getByText('rival')).toBeInTheDocument();
    expect(within(matchThreeRow as HTMLElement).getByText('Online')).toBeInTheDocument();
    expect(within(matchThreeRow as HTMLElement).getByText('online-rival')).toBeInTheDocument();
    expect(within(matchFourRow as HTMLElement).getByText('custom_bot')).toBeInTheDocument();
    expect(within(matchFourRow as HTMLElement).getAllByText('-').length).toBeGreaterThan(0);
    expect(screen.getAllByText(new Date(matches[0].endedAt).toLocaleString())).toHaveLength(4);
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

  test('combines result, mode and date filters and allows clearing them', () => {
    const matches = [
      buildMatch({
        gameId: 'match-new-bot-win',
        result: 'win',
        mode: 'human_vs_bot',
        botId: 'greedy_bot',
        winnerId: 'adri',
        endedAt: '2026-03-05T10:00:00.000Z',
      }),
      buildMatch({
        gameId: 'match-old-bot-win',
        result: 'win',
        mode: 'human_vs_bot',
        botId: 'random_bot',
        winnerId: 'adri',
        endedAt: '2026-01-02T10:00:00.000Z',
      }),
      buildMatch({
        gameId: 'match-bot-loss',
        result: 'loss',
        mode: 'human_vs_bot',
        botId: 'greedy_bot',
        winnerId: 'rival',
        endedAt: '2026-02-04T10:00:00.000Z',
      }),
      buildMatch({
        gameId: 'match-human-win',
        result: 'win',
        mode: 'local_human_vs_human',
        botId: null,
        winnerId: 'adri',
        endedAt: '2026-01-01T09:00:00.000Z',
      }),
    ];

    render(<HistoryView playerStats={PLAYER_STATS} matches={matches} />);

    fireEvent.click(screen.getByRole('button', { name: /resultado/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /solo victorias/i }));

    fireEvent.click(screen.getByRole('button', { name: /modo/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^bot$/i }));

    fireEvent.click(screen.getByRole('button', { name: /fecha/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /mas antiguas primero/i }));

    expect(screen.getByText(/mostrando 2 de 4 partidas/i)).toBeInTheDocument();
    expect(screen.queryByText('match-bot-loss')).not.toBeInTheDocument();
    expect(screen.queryByText('match-human-win')).not.toBeInTheDocument();

    const filteredRows = screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).queryByText(/^match-/)?.textContent)
      .filter((value): value is string => Boolean(value));

    expect(filteredRows).toEqual(['match-old-bot-win', 'match-new-bot-win']);

    fireEvent.click(screen.getByRole('button', { name: /limpiar filtros/i }));

    expect(screen.getByText(/mostrando 4 de 4 partidas/i)).toBeInTheDocument();
    expect(screen.getByText('match-bot-loss')).toBeInTheDocument();
    expect(screen.getByText('match-human-win')).toBeInTheDocument();
  });

  test('notifies parent components when filters change', () => {
    const onFiltersChange = vi.fn();

    render(<HistoryView playerStats={PLAYER_STATS} matches={[buildMatch()]} onFiltersChange={onFiltersChange} />);

    fireEvent.click(screen.getByRole('button', { name: /resultado/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /solo victorias/i }));

    expect(onFiltersChange).toHaveBeenCalledWith({
      result: 'win',
      mode: 'all',
      bot: 'all',
      winner: 'all',
      dateSort: 'recent_first',
    });
  });

  test('distinguishes local human games from online and legacy online games', () => {
    const matches = [
      buildMatch({
        gameId: 'match-local-human',
        mode: 'local_human_vs_human',
        botId: null,
      }),
      buildMatch({
        gameId: 'match-online',
        mode: 'online',
        botId: null,
      }),
      buildMatch({
        gameId: 'match-online-legacy',
        mode: 'human_vs_human',
        botId: null,
      }),
    ];

    render(<HistoryView playerStats={PLAYER_STATS} matches={matches} />);

    fireEvent.click(screen.getByRole('button', { name: /modo/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^humano local$/i }));

    expect(screen.getByText(/mostrando 1 de 3 partidas/i)).toBeInTheDocument();
    expect(screen.getByText('match-local-human')).toBeInTheDocument();
    expect(screen.queryByText('match-online')).not.toBeInTheDocument();
    expect(screen.queryByText('match-online-legacy')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /modo/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^online$/i }));

    expect(screen.getByText(/mostrando 2 de 3 partidas/i)).toBeInTheDocument();
    expect(screen.queryByText('match-local-human')).not.toBeInTheDocument();
    expect(screen.getByText('match-online')).toBeInTheDocument();
    expect(screen.getByText('match-online-legacy')).toBeInTheDocument();
  });

  test('supports dynamic bot filters and simple winner perspective filters', () => {
    const matches = [
      buildMatch({
        gameId: 'match-no-bot-no-winner',
        mode: 'local_human_vs_human',
        botId: null,
        winnerId: null,
      }),
      buildMatch({
        gameId: 'match-greedy-adri',
        botId: 'greedy_bot',
        winnerId: 'adri',
      }),
      buildMatch({
        gameId: 'match-random-rival',
        result: 'loss',
        botId: 'random_bot',
        winnerId: 'rival',
      }),
    ];

    render(<HistoryView playerStats={PLAYER_STATS} matches={matches} />);

    fireEvent.click(screen.getByRole('button', { name: /bot\. filtro actual/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^sin bot$/i }));

    expect(screen.getByText(/mostrando 1 de 3 partidas/i)).toBeInTheDocument();
    expect(screen.getByText('match-no-bot-no-winner')).toBeInTheDocument();
    expect(screen.queryByText('match-greedy-adri')).not.toBeInTheDocument();
    expect(screen.queryByText('match-random-rival')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /ganador\. filtro actual/i }));
    expect(screen.queryByRole('menuitem', { name: /^sin ganador$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /^adri$/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: /^tu$/i }));

    expect(screen.getByText('match-no-bot-no-winner')).toBeInTheDocument();
    expect(screen.queryByText('match-greedy-adri')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /limpiar filtros/i }));

    fireEvent.click(screen.getByRole('button', { name: /bot\. filtro actual/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^intermedio$/i }));

    expect(screen.getByText(/mostrando 1 de 3 partidas/i)).toBeInTheDocument();
    expect(screen.getByText('match-greedy-adri')).toBeInTheDocument();
    expect(screen.queryByText('match-no-bot-no-winner')).not.toBeInTheDocument();
    expect(screen.queryByText('match-random-rival')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /ganador\. filtro actual/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^tu$/i }));

    expect(screen.getByText('match-greedy-adri')).toBeInTheDocument();
    expect(screen.queryByText('match-random-rival')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /limpiar filtros/i }));

    fireEvent.click(screen.getByRole('button', { name: /ganador\. filtro actual/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^rival$/i }));

    expect(screen.getByText(/mostrando 1 de 3 partidas/i)).toBeInTheDocument();
    expect(screen.getByText('match-random-rival')).toBeInTheDocument();
    expect(screen.queryByText('match-greedy-adri')).not.toBeInTheDocument();
    expect(screen.queryByText('match-no-bot-no-winner')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /limpiar filtros/i }));

    fireEvent.click(screen.getByRole('button', { name: /bot\. filtro actual/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^con bot$/i }));

    expect(screen.getByText(/mostrando 2 de 3 partidas/i)).toBeInTheDocument();
    expect(screen.getByText('match-greedy-adri')).toBeInTheDocument();
    expect(screen.getByText('match-random-rival')).toBeInTheDocument();
    expect(screen.queryByText('match-no-bot-no-winner')).not.toBeInTheDocument();
  });

  test('returns to first page when match history updates', () => {
    const manyMatches = Array.from({ length: 11 }, (_, index) =>
      buildMatch({
        gameId: `match-${index + 1}`,
      }),
    );

    const { rerender } = render(<HistoryView playerStats={PLAYER_STATS} matches={manyMatches} />);

    fireEvent.click(screen.getByRole('button', { name: /go to next page/i }));
    expect(screen.getByText('match-11')).toBeInTheDocument();

    const refreshedMatches = [
      buildMatch({ gameId: 'match-new' }),
      ...manyMatches,
    ];

    rerender(<HistoryView playerStats={PLAYER_STATS} matches={refreshedMatches} />);

    expect(screen.getByText('match-new')).toBeInTheDocument();
    expect(screen.queryByText('match-11')).not.toBeInTheDocument();
  });
});
