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
    expect(screen.getByText('Budget remaining: 10')).toBeInTheDocument()
    expect(screen.getByText('System Health')).toBeInTheDocument()
    expect(screen.getByText(/Hidden in player view/i)).toBeInTheDocument()
  })

  it('shows a calm decision summary before the event preview', () => {
    render(<SimulationScreen />)

    fireEvent.click(screen.getByRole('button', { name: 'post-orders' }))

    expect(screen.getByText('Decision locked in:')).toBeInTheDocument()
    expect(screen.getByText('→ POST /orders')).toBeInTheDocument()
    expect(screen.getByText(/The team chose a clean resource endpoint/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Resolve event/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    expect(screen.getByRole('heading', { name: /Round 1 — Event/i })).toBeInTheDocument()
    expect(screen.getByText(/Event: Duplicate Submission/i)).toBeInTheDocument()
  })

  it('moves from the first event into the second decision instead of skipping ahead', () => {
    render(<SimulationScreen />)

    fireEvent.click(screen.getByRole('button', { name: 'post-orders' }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /Resolve event/i }))

    expect(screen.getByText(/Outcome: Success/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    expect(screen.getByRole('heading', { name: /Round 2 — Network Uncertainty/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'idempotency-key' })).toBeInTheDocument()
  })

  it('inserts the async follow-up decision before the final event', () => {
    render(<SimulationScreen />)

    fireEvent.click(screen.getByRole('button', { name: 'post-orders' }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /Resolve event/i }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    fireEvent.click(screen.getByRole('button', { name: 'idempotency-key' }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /Resolve event/i }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    fireEvent.click(screen.getByRole('button', { name: 'split-async' }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    expect(screen.getByRole('heading', { name: /Round 3 — Recovery Plan/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'tracked-retries' })).toBeInTheDocument()
    expect(screen.getByText('Round 3 / 3')).toBeInTheDocument()
  })

  it('resolves the layered final event and reaches completion', () => {
    render(<SimulationScreen />)

    fireEvent.click(screen.getByRole('button', { name: 'post-orders' }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /Resolve event/i }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    fireEvent.click(screen.getByRole('button', { name: 'idempotency-key' }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /Resolve event/i }))
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
    fireEvent.click(screen.getByRole('button', { name: 'post-orders' }))

    expect(screen.getByText(/Reliability \+1/i)).toBeInTheDocument()
    expect(screen.getByText(/Operability \+1/i)).toBeInTheDocument()
  })

  it('resets the run when restarted after progress', () => {
    render(<SimulationScreen />)

    fireEvent.click(screen.getByRole('button', { name: 'post-orders' }))
    fireEvent.click(screen.getByRole('button', { name: /Restart run/i }))

    expect(screen.getByRole('heading', { name: /Round 1 — Order API Contract/i })).toBeInTheDocument()
    expect(screen.getByText('Budget remaining: 10')).toBeInTheDocument()
    expect(screen.queryByText('Decision locked in:')).not.toBeInTheDocument()
  })

  it('shows neutral contributors in the final debug-style outcome card after completion', () => {
    render(<SimulationScreen />)

    fireEvent.click(screen.getByRole('button', { name: 'get-create-order' }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /Resolve event/i }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    fireEvent.click(screen.getByRole('button', { name: 'client-handles-retries' }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /Resolve event/i }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    fireEvent.click(screen.getByRole('button', { name: 'everything-sync' }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /Resolve event/i }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    expect(screen.getByText('First simulation playable')).toBeInTheDocument()
    expect(screen.getByText(/value 0 x -1 = 0/i)).toBeInTheDocument()
  })
})
