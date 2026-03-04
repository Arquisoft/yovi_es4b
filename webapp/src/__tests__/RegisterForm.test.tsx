import { render, screen,  waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RegisterForm from '../RegisterForm'
import { afterEach, describe, expect, test, vi } from 'vitest' 
import '@testing-library/jest-dom'


describe('RegisterForm', () => {
  const onSuccess = vi.fn()

  afterEach(() => {
    vi.restoreAllMocks()
    onSuccess.mockReset()
  })

  test('shows validation error when username is empty', async () => {
    render(<RegisterForm onSuccess={onSuccess} />)
    const user = userEvent.setup()

    await waitFor(async () => {
      await user.click(screen.getByRole('button', { name: /register/i }))
      expect(screen.getByText(/please enter a username and password/i)).toBeInTheDocument()
    })
  })

  test('submits username/password and displays response', async () => {
    const user = userEvent.setup()
    const payload = { message: 'User pablo registered successfully', token: 'fake-token', username: 'pablo' }

    // Mock fetch to resolve automatically
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      text: async () => JSON.stringify(payload),
    } as Response)

    render(<RegisterForm onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText(/^username$/i), 'Pablo')
    await user.type(screen.getByLabelText(/^password$/i), 'secret123')
    await user.type(screen.getByLabelText(/confirm password/i), 'secret123')
    await user.click(screen.getByRole('button', { name: /register/i }))

    await waitFor(() => {
      expect(screen.getByText(/registered successfully/i)).toBeInTheDocument()
    })
    expect(onSuccess).toHaveBeenCalledWith('fake-token', 'pablo')
  })
})
