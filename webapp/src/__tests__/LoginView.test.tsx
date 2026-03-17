import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom';
import LoginView from '../views/LoginView';

vi.mock('../LoginForm', () => ({
  default: ({ onSuccess }: { onSuccess: (token: string, username: string) => void }) => (
    <button onClick={() => onSuccess('login-token', 'login-user')}>Login Form Mock</button>
  ),
}));

vi.mock('../RegisterForm', () => ({
  default: ({ onSuccess }: { onSuccess: (token: string, username: string) => void }) => (
    <button onClick={() => onSuccess('register-token', 'register-user')}>Register Form Mock</button>
  ),
}));

describe('LoginView', () => {
  test('switches between Login and Register tabs', () => {
    render(<LoginView onNext={vi.fn()} onAuth={vi.fn()} />);

    expect(screen.getByRole('button', { name: /login form mock/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /register form mock/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /register/i }));

    expect(screen.getByRole('button', { name: /register form mock/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /login form mock/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /^login$/i }));

    expect(screen.getByRole('button', { name: /login form mock/i })).toBeInTheDocument();
  });

  test('forwards auth success from both tabs to onAuth and onNext', () => {
    const onNext = vi.fn();
    const onAuth = vi.fn();

    render(<LoginView onNext={onNext} onAuth={onAuth} />);

    fireEvent.click(screen.getByRole('button', { name: /login form mock/i }));
    expect(onAuth).toHaveBeenCalledWith('login-token', 'login-user');
    expect(onNext).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('tab', { name: /register/i }));
    fireEvent.click(screen.getByRole('button', { name: /register form mock/i }));
    expect(onAuth).toHaveBeenCalledWith('register-token', 'register-user');
    expect(onNext).toHaveBeenCalledTimes(2);
  });
});
