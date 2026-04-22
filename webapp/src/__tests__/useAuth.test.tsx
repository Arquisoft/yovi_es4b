import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useAuth } from '../hooks/useAuth';

describe('useAuth', () => {
  const originalCrypto = globalThis.crypto;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', {
      value: originalCrypto,
      configurable: true,
    });
  });

  test('continueAsGuest creates and stores a guest session id', () => {
    const { result } = renderHook(() => useAuth());

    act(() => {
      result.current.continueAsGuest();
    });

    const guestSessionId = localStorage.getItem('guestSessionId');

    expect(result.current.isGuest).toBe(true);
    expect(result.current.hasSession).toBe(true);
    expect(result.current.displayName).toBe('Usuario anonimo');
    expect(guestSessionId).toMatch(/^guest-/);
    expect(result.current.sessionUserId).toBe(guestSessionId);
  });

  test('continueAsGuest falls back to getRandomValues when randomUUID is unavailable', () => {
    const getRandomValues = vi.fn((buffer: Uint8Array) => {
      buffer.set([0, 1, 2, 3, 4, 5, 6, 7]);
      return buffer;
    });

    Object.defineProperty(globalThis, 'crypto', {
      value: {
        getRandomValues,
      },
      configurable: true,
    });

    const { result } = renderHook(() => useAuth());

    act(() => {
      result.current.continueAsGuest();
    });

    expect(getRandomValues).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('guestSessionId')).toBe('guest-00010203040506070000000000000000');
  });
});
