import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom';
import type React from 'react';
import ConfigView from '../views/ConfigView';

type ConfigOverrides = Partial<React.ComponentProps<typeof ConfigView>>;

function renderConfig(overrides: ConfigOverrides = {}) {
  const props: React.ComponentProps<typeof ConfigView> = {
    boardSize: 7,
    mode: 'human_vs_bot',
    botDifficulty: 'easy',
    loading: false,
    setMode: vi.fn(),
    setBotDifficulty: vi.fn(),
    updateBoardSize: vi.fn(),
    createNewGame: vi.fn(),
    ...overrides,
  };

  render(<ConfigView {...props} />);
  return props;
}

describe('ConfigView', () => {
  test('updates board size when user changes the number input', async () => {
    const props = renderConfig();

    const sizeInput = screen.getByRole('spinbutton');
    fireEvent.change(sizeInput, { target: { value: '9' } });

    expect(props.updateBoardSize).toHaveBeenLastCalledWith(9);
  });

  test('calls setMode when selecting game mode', async () => {
    const props = renderConfig({ mode: 'human_vs_bot' });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /human vs human/i }));

    expect(props.setMode).toHaveBeenCalledWith('human_vs_human');
  });

  test('disables bot difficulty buttons when mode is human_vs_human', () => {
    renderConfig({ mode: 'human_vs_human' });

    expect(screen.getByRole('button', { name: /facil/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /intermedio/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /dificil/i })).toBeDisabled();
  });

  test('calls createNewGame when create button is enabled', async () => {
    const props = renderConfig({ mode: 'human_vs_bot', botDifficulty: 'easy', loading: false });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /crear partida/i }));

    expect(props.createNewGame).toHaveBeenCalledTimes(1);
  });
});
