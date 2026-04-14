type CrisisAudioCue = 'pressureTick' | 'pressureTimeout'

type CueConfig = {
  src: string
  volume: number
}

type AudioContextCtor = typeof AudioContext

const CUE_CONFIG: Record<CrisisAudioCue, CueConfig> = {
  pressureTick: {
    src: '/audio/pressure-tick.wav',
    volume: 0.55,
  },
  pressureTimeout: {
    src: '/audio/pressure-timeout.wav',
    volume: 0.75,
  },
}

const unlockSubscribers = new Set<() => void>()
const gestureEvents: Array<keyof WindowEventMap> = ['pointerdown', 'keydown']

let context: AudioContext | null = null
let decodePromise: Promise<void> | null = null
let unlocked = false
let listenerRefCount = 0
let buffers: Partial<Record<CrisisAudioCue, AudioBuffer>> = {}

function getAudioContextConstructor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null
  return window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: AudioContextCtor }).webkitAudioContext
    ?? null
}

function ensureContext() {
  if (context) return context

  const AudioContextCtor = getAudioContextConstructor()
  if (!AudioContextCtor) return null

  context = new AudioContextCtor()
  return context
}

async function loadCueBuffer(cue: CrisisAudioCue, audioContext: AudioContext) {
  if (buffers[cue]) return buffers[cue] ?? null

  const response = await fetch(CUE_CONFIG[cue].src)
  const arrayBuffer = await response.arrayBuffer()
  const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0))
  buffers[cue] = decoded
  return decoded
}

async function preloadBuffers() {
  const audioContext = ensureContext()
  if (!audioContext) return
  if (decodePromise) return decodePromise

  decodePromise = Promise.all(
    (Object.keys(CUE_CONFIG) as CrisisAudioCue[]).map((cue) => loadCueBuffer(cue, audioContext)),
  ).then(() => undefined)

  return decodePromise
}

function notifyUnlockSubscribers() {
  unlockSubscribers.forEach((listener) => listener())
}

export async function unlockCrisisAudio() {
  const audioContext = ensureContext()
  if (!audioContext) return false

  try {
    if (audioContext.state !== 'running') {
      await audioContext.resume()
    }

    await preloadBuffers()
    unlocked = true
    notifyUnlockSubscribers()
    return true
  } catch {
    return false
  }
}

function handleUnlockGesture() {
  void unlockCrisisAudio()
}

export function mountCrisisAudio() {
  ensureContext()
  void preloadBuffers()
  listenerRefCount += 1

  if (listenerRefCount !== 1) return
  gestureEvents.forEach((eventName) => window.addEventListener(eventName, handleUnlockGesture, { passive: true }))
}

export function unmountCrisisAudio() {
  listenerRefCount = Math.max(0, listenerRefCount - 1)

  if (listenerRefCount !== 0) return
  gestureEvents.forEach((eventName) => window.removeEventListener(eventName, handleUnlockGesture))
}

export function subscribeToCrisisAudioUnlock(listener: () => void) {
  unlockSubscribers.add(listener)
  return () => {
    unlockSubscribers.delete(listener)
  }
}

export function playCrisisAudioCue(cue: CrisisAudioCue) {
  const audioContext = ensureContext()
  if (!audioContext || !unlocked || audioContext.state !== 'running') return false

  const buffer = buffers[cue]
  if (!buffer) return false

  const source = audioContext.createBufferSource()
  const gainNode = audioContext.createGain()
  source.buffer = buffer
  gainNode.gain.value = CUE_CONFIG[cue].volume
  source.connect(gainNode)
  gainNode.connect(audioContext.destination)
  source.start(0)
  return true
}

export function __resetCrisisAudioForTests() {
  gestureEvents.forEach((eventName) => window.removeEventListener(eventName, handleUnlockGesture))
  unlockSubscribers.clear()
  buffers = {}
  decodePromise = null
  unlocked = false
  listenerRefCount = 0
  context = null
}
