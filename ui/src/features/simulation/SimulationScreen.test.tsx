import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import SimulationScreen from './SimulationScreen'

afterEach(() => {
  cleanup()
})

describe('SimulationScreen', () => {
  it('renders the first decision and visible hud', () => {
    render(<SimulationScreen />)

    expect(screen.getByText('Order Creation')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Round 1 — Order API Contract/i })).toBeInTheDocument()
    expect(screen.getByText('Budget remaining: 6')).toBeInTheDocument()
    expect(screen.getByText('System Health')).toBeInTheDocument()
    expect(screen.getByText(/Hidden in player view/i)).toBeInTheDocument()
  })

  it('shows a player-facing decision summary before continuing', async () => {
    render(<SimulationScreen />)

    fireEvent.click(screen.getByRole('button', { name: 'post-orders' }))

    expect(screen.getByText('Decision locked in:')).toBeInTheDocument()
    expect(screen.getByText('→ POST /orders')).toBeInTheDocument()
    expect(screen.getByText(/The team chose a clean resource endpoint/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Resolve event/i })).not.toBeInTheDocument()
  })

  it('inserts and renders the async follow-up decision before the event', async () => {
    render(<SimulationScreen />)

    fireEvent.click(screen.getByRole('button', { name: 'post-orders' }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    fireEvent.click(screen.getByRole('button', { name: 'idempotency-key' }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    fireEvent.click(screen.getByRole('button', { name: 'split-async' }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    expect(screen.getByRole('heading', { name: /Round 4 — Recovery Plan/i })).toBeInTheDocument()
    expect(screen.getByText('Step 4 / 5')).toBeInTheDocument()
  })

  it('resolves the event and shows contributors and completion state', async () => {
    render(<SimulationScreen />)

    fireEvent.click(screen.getByRole('button', { name: 'post-orders' }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    fireEvent.click(screen.getByRole('button', { name: 'idempotency-key' }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    fireEvent.click(screen.getByRole('button', { name: 'split-async' }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    fireEvent.click(screen.getByRole('button', { name: 'tracked-retries' }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /Resolve event/i }))

    expect(screen.getByText('Outcome: Success')).toBeInTheDocument()
    expect(screen.getByText(/Contributors:/i)).toBeInTheDocument()
    expect(screen.getByText(/\+ The system had a recovery path for incomplete work\./i)).toBeInTheDocument()
    expect(screen.getByText(/absorbs the spike/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    expect(screen.getByText('First simulation playable')).toBeInTheDocument()
  })

  it('shows hidden trait deltas only in debug mode', () => {
    render(<SimulationScreen />)

    fireEvent.click(screen.getByLabelText(/Debug mode/i))
    fireEvent.click(screen.getByRole('button', { name: 'post-orders-create' }))

    expect(screen.getByText(/No hidden trait changes/i)).toBeInTheDocument()
  })
})
