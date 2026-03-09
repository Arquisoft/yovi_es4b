import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import '@testing-library/jest-dom';
import PlayerStatsCardView from '../views/PlayerStatsCardView';

describe('PlayerStatsCardView', () => {
  test('renders the player summary values and formatted update date', () => {
    const updatedAt = '2026-03-01T10:00:00.000Z';

    render(
      <PlayerStatsCardView
        playerStats={{
          totalGames: 12,
          victories: 7,
          defeats: 5,
          updatedAt,
        }}
      />,
    );

    expect(screen.getByText(/estadisticas del jugador/i)).toBeInTheDocument();
    expect(screen.getByText(/partidas jugadas/i)).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText(new Date(updatedAt).toLocaleDateString())).toBeInTheDocument();
  });

  test('shows fallback text when there is no updated date yet', () => {
    render(
      <PlayerStatsCardView
        playerStats={{
          totalGames: 0,
          victories: 0,
          defeats: 0,
          updatedAt: null,
        }}
      />,
    );

    expect(screen.getByText(/sin partidas/i)).toBeInTheDocument();
  });
});
