import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfigView from '../views/ConfigView';
import { describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom';

describe('ConfigView', () => {
  const defaultProps = {
    boardSize: 7,
    mode: 'bot_muy_facil' as any,
    loading: false,
    setMode: vi.fn(),
    updateBoardSize: vi.fn(),
    createNewGame: vi.fn(),
    onBack: vi.fn(),
  };

  test('renders all bot difficulty options in the mode selector', async () => {
    const user = userEvent.setup();
    render(<ConfigView {...defaultProps} />);

    const select = screen.getByLabelText(/modo/i);
    expect(select).toBeInTheDocument();

    // click to open the dropdown; MUI renders the menu items into a popup
    await user.click(select);

    expect(screen.getByRole('option', { name: /bot muy fácil/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /bot fácil/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /bot medio/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /bot difícil/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /humano vs humano/i })).toBeInTheDocument();
  });

  test('invokes setMode when user picks a different option', async () => {
    const user = userEvent.setup();
    render(<ConfigView {...defaultProps} />);

    const select = screen.getByLabelText(/modo/i);
    await user.selectOptions(select, 'bot_facil');
    expect(defaultProps.setMode).toHaveBeenCalledWith('bot_facil');
  });
});
