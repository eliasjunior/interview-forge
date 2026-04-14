import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CrisisAudioBootstrap from './CrisisAudioBootstrap'
import PressureCountdownAudio from './PressureCountdownAudio'
import PressureTimeoutAudio from './PressureTimeoutAudio'

const audioMocks = vi.hoisted(() => ({
  mountCrisisAudio: vi.fn(),
  unmountCrisisAudio: vi.fn(),
  playCrisisAudioCue: vi.fn<(cue: 'pressureTick' | 'pressureTimeout') => boolean>(),
  subscribeToCrisisAudioUnlock: vi.fn<(listener: () => void) => () => void>(),
}))

vi.mock('../audio/crisisAudio', () => ({
  mountCrisisAudio: audioMocks.mountCrisisAudio,
  unmountCrisisAudio: audioMocks.unmountCrisisAudio,
  playCrisisAudioCue: audioMocks.playCrisisAudioCue,
  subscribeToCrisisAudioUnlock: audioMocks.subscribeToCrisisAudioUnlock,
}))

describe('crisis audio components', () => {
  beforeEach(() => {
    audioMocks.mountCrisisAudio.mockReset()
    audioMocks.unmountCrisisAudio.mockReset()
    audioMocks.playCrisisAudioCue.mockReset()
    audioMocks.subscribeToCrisisAudioUnlock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('mounts the shared crisis audio bootstrap once', () => {
    const { unmount } = render(<CrisisAudioBootstrap />)
    expect(audioMocks.mountCrisisAudio).toHaveBeenCalledTimes(1)

    unmount()
    expect(audioMocks.unmountCrisisAudio).toHaveBeenCalledTimes(1)
  })

  it('plays the pressure tick when unlock happens after pressure is already active', async () => {
    let unlockListener: (() => void) | undefined
    audioMocks.subscribeToCrisisAudioUnlock.mockImplementation((listener) => {
      unlockListener = listener
      return () => {}
    })
    audioMocks.playCrisisAudioCue.mockReturnValue(true)

    render(<PressureCountdownAudio active secondsRemaining={11} />)

    unlockListener?.()

    await waitFor(() => {
      expect(audioMocks.playCrisisAudioCue).toHaveBeenCalledWith('pressureTick')
    })
  })

  it('replays the pressure tick on each new second after unlock', async () => {
    audioMocks.subscribeToCrisisAudioUnlock.mockImplementation(() => () => {})
    audioMocks.playCrisisAudioCue.mockReturnValue(true)

    const { rerender } = render(<PressureCountdownAudio active secondsRemaining={11} />)

    await waitFor(() => {
      expect(audioMocks.playCrisisAudioCue).toHaveBeenCalledWith('pressureTick')
    })

    rerender(<PressureCountdownAudio active secondsRemaining={10} />)

    await waitFor(() => {
      expect(audioMocks.playCrisisAudioCue).toHaveBeenCalledTimes(2)
    })
  })

  it('plays the timeout cue when an armed countdown reaches zero', async () => {
    audioMocks.subscribeToCrisisAudioUnlock.mockImplementation(() => () => {})
    audioMocks.playCrisisAudioCue.mockReturnValue(true)

    const { rerender } = render(<PressureTimeoutAudio armed secondsRemaining={1} />)

    rerender(<PressureTimeoutAudio armed secondsRemaining={0} />)

    await waitFor(() => {
      expect(audioMocks.playCrisisAudioCue).toHaveBeenCalledWith('pressureTimeout')
    })
  })
})
