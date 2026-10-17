/**
 * The timer's sounds, made by the browser (Web Audio), with no file to
 * load: a bell of two notes when a block of work ends, three notes going up
 * when the break does, a short tick when a block starts. "Avec des sound
 * effects desactivables" (Kee): the timer's `sound` switch decides whether
 * they play at all.
 *
 * A browser lets a page make sound only after the person has touched it, so
 * the context opens on a tap or a key (`unlock`, called by the timer on the
 * first pointerdown or keydown) and never from a timer by itself; a phone
 * that suspended it is asked to resume on the next one.
 *
 * Each note is a sine with two quieter overtones and a quick rise and slow
 * fall, so it rings like a small bell rather than beeps.
 */
export const NOTES = {
  focusEnd: [
    [784, 0],
    [587, 0.34],
  ],
  breakEnd: [
    [523, 0],
    [659, 0.18],
    [784, 0.36],
  ],
  start: [[660, 0]],
}

const PARTIALS = [
  [1, 1, 'sine'],
  [2, 0.22, 'sine'],
  [3, 0.07, 'triangle'],
]

let ctx = null

/** Open (or wake) the audio context. Only ever called from a gesture. */
export function unlock() {
  try {
    const AC = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null
    if (!AC) return null
    if (!ctx) ctx = new AC()
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    return ctx
  } catch {
    return null
  }
}

function bell(c, freq, at, length, peak) {
  const out = c.createGain()
  out.gain.setValueAtTime(0.0001, at)
  out.gain.exponentialRampToValueAtTime(peak, at + 0.012)
  out.gain.exponentialRampToValueAtTime(0.0001, at + length)
  out.connect(c.destination)
  for (const [mult, level, type] of PARTIALS) {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = type
    osc.frequency.value = freq * mult
    gain.gain.value = level
    osc.connect(gain)
    gain.connect(out)
    osc.start(at)
    osc.stop(at + length + 0.05)
  }
}

/**
 * Play one of the sounds. Silent, and false, when no gesture has opened the
 * audio yet or the kind is unknown. `c` is for the tests.
 */
export function play(kind, c = ctx) {
  const notes = NOTES[kind]
  if (!c || !notes) return false
  try {
    if (c.state === 'suspended') c.resume().catch(() => {})
    const t0 = c.currentTime + 0.02
    const short = kind === 'start'
    for (const [freq, at] of notes) bell(c, freq, t0 + at, short ? 0.2 : 1.5, short ? 0.07 : 0.2)
    return true
  } catch {
    return false
  }
}
