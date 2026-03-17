import { fireEvent, render, screen } from '@testing-library/react';
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
  test('updates board size when user changes the number input and leaves the field', async () => {
    const props = renderConfig();

    const sizeInput = screen.getByRole('spinbutton');
    fireEvent.change(sizeInput, { target: { value: '9' } });
    fireEvent.blur(sizeInput);

    expect(props.updateBoardSize).toHaveBeenLastCalledWith(9);
  });

  test('falls back to board size 1 when the input is empty', () => {
    const props = renderConfig();

    const sizeInput = screen.getByRole('spinbutton');
    fireEvent.change(sizeInput, { target: { value: '' } });
    fireEvent.blur(sizeInput);

    expect(props.updateBoardSize).toHaveBeenLastCalledWith(1);
  });

  test('calls setMode when selecting game mode', () => {
    const props = renderConfig({ mode: 'human_vs_bot' });

    fireEvent.click(screen.getByRole('button', { name: /humano vs humano/i }));

    expect(props.setMode).toHaveBeenCalledWith('human_vs_human');
  });

  test('calls setMode when switching back to human vs bot', () => {
    const props = renderConfig({ mode: 'human_vs_human' });

    fireEvent.click(screen.getByRole('button', { name: /humano vs bot/i }));

    expect(props.setMode).toHaveBeenCalledWith('human_vs_bot');
  });

  test('disables bot difficulty buttons when mode is human_vs_human', () => {
    renderConfig({ mode: 'human_vs_human' });

    expect(screen.getByRole('button', { name: /^muy facil$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^facil$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /intermedio/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /dificil/i })).toBeDisabled();
  });

  test('calls setBotDifficulty when selecting a bot difficulty in bot mode', () => {
    const props = renderConfig({ mode: 'human_vs_bot', botDifficulty: 'easy' });

    fireEvent.click(screen.getByRole('button', { name: /intermedio/i }));

    expect(props.setBotDifficulty).toHaveBeenCalledWith('medium');
  });

  test('calls createNewGame when create button is enabled', () => {
    const props = renderConfig({ mode: 'human_vs_bot', botDifficulty: 'easy', loading: false });
    const sizeInput = screen.getByRole('spinbutton');
    fireEvent.change(sizeInput, { target: { value: '10' } });

    fireEvent.click(screen.getByRole('button', { name: /crear partida/i }));

    expect(props.updateBoardSize).toHaveBeenLastCalledWith(10);
    expect(props.createNewGame).toHaveBeenCalledTimes(1);
  });

  test('shows loading state on create button and disables it', () => {
    renderConfig({ loading: true });

    expect(screen.getByRole('button', { name: /cargando/i })).toBeDisabled();
  });
});
