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

  test('shows validation error when passwords do not match', async () => {
    render(<RegisterForm onSuccess={onSuccess} />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/^username$/i), 'Pablo')
    await user.type(screen.getByLabelText(/^password$/i), 'secret123')
    await user.type(screen.getByLabelText(/confirm password/i), 'secret124')
    await user.click(screen.getByRole('button', { name: /register/i }))

    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
  })

  test('shows validation error when password is too short', async () => {
    render(<RegisterForm onSuccess={onSuccess} />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/^username$/i), 'Pablo')
    await user.type(screen.getByLabelText(/^password$/i), '12345')
    await user.type(screen.getByLabelText(/confirm password/i), '12345')
    await user.click(screen.getByRole('button', { name: /register/i }))

    expect(screen.getByText(/password must be at least 6 characters/i)).toBeInTheDocument()
  })

  test('shows fallback server error when backend response has no message', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => '{}',
    } as Response)

    render(<RegisterForm onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText(/^username$/i), 'Pablo')
    await user.type(screen.getByLabelText(/^password$/i), 'secret123')
    await user.type(screen.getByLabelText(/confirm password/i), 'secret123')
    await user.click(screen.getByRole('button', { name: /register/i }))

    await waitFor(() => {
      expect(screen.getByText(/server error \(500\)/i)).toBeInTheDocument()
    })
  })

  test('shows network error when the register request throws', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network down'))

    render(<RegisterForm onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText(/^username$/i), 'Pablo')
    await user.type(screen.getByLabelText(/^password$/i), 'secret123')
    await user.type(screen.getByLabelText(/confirm password/i), 'secret123')
    await user.click(screen.getByRole('button', { name: /register/i }))

    await waitFor(() => {
      expect(screen.getByText(/network down/i)).toBeInTheDocument()
    })
  })
})
