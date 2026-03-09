import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom';
import LoginView from '../views/LoginView';

describe('LoginView', () => {
  test('switches between Login and Register tabs', async () => {
    render(<LoginView onNext={vi.fn()} onAuth={vi.fn()} />);
    const user = userEvent.setup();

    expect(screen.getByRole('button', { name: /^login$/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/confirm password/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /register/i }));

    expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /^login$/i }));

    expect(screen.getByRole('button', { name: /^login$/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/confirm password/i)).not.toBeInTheDocument();
  });
});
