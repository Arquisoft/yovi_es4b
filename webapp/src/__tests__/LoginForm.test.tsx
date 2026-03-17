import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom';
import LoginForm from '../LoginForm';

describe('LoginForm', () => {
  const onSuccess = vi.fn();

  afterEach(() => {
    vi.restoreAllMocks();
    onSuccess.mockReset();
  });

  test('shows validation error when username/password are empty', async () => {
    render(<LoginForm onSuccess={onSuccess} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /login/i }));

    expect(screen.getByText(/please enter username and password/i)).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  test('submits credentials and calls onSuccess on valid response', async () => {
    const payload = { token: 'fake-login-token', username: 'adri' };
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(payload),
    } as Response);

    render(<LoginForm onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(/^username$/i), 'adri');
    await user.type(screen.getByLabelText(/^password$/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith('fake-login-token', 'adri');
    });
  });

  test('shows backend error when login fails', async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ message: 'Invalid credentials' }),
    } as Response);

    render(<LoginForm onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(/^username$/i), 'adri');
    await user.type(screen.getByLabelText(/^password$/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  test('shows fallback backend error when the response has no message', async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => '{}',
    } as Response);

    render(<LoginForm onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(/^username$/i), 'adri');
    await user.type(screen.getByLabelText(/^password$/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText(/login failed \(500\)/i)).toBeInTheDocument();
    });
  });

  test('shows network error message when fetch rejects', async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Connection lost'));

    render(<LoginForm onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(/^username$/i), 'adri');
    await user.type(screen.getByLabelText(/^password$/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText(/connection lost/i)).toBeInTheDocument();
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });
});
