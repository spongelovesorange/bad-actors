export type ClockReading = { seconds: number; mode: 'running' | 'paused' | 'expired' | 'finished' }
export type PlayMode = 'draw' | 'rehearse'

export function drawAnotherCue(previous: number, count: number, random = Math.random): number {
  const card = Math.floor(random() * (count - 1))
  return card >= previous ? card + 1 : card
}

/** Only foreground time spent posing is charged. Timer callbacks may be delayed by the browser. */
export class ActingClock {
  private remaining: number
  private since: number | null = null
  private last?: ClockReading
  private timer?: ReturnType<typeof setTimeout>
  private stopped = false

  constructor(private show: (reading: ClockReading) => void, private expired: () => void, seconds = 45) {
    this.remaining = seconds * 1000
  }

  set(mode: 'running' | 'paused' | 'finished') {
    if (this.stopped) return
    clearTimeout(this.timer)
    const now = performance.now()
    if (this.since !== null) this.remaining = Math.max(0, this.remaining - (now - this.since))
    this.since = mode === 'running' ? now : null
    const reading: ClockReading = { seconds: Math.ceil(this.remaining / 1000), mode: this.remaining ? mode : 'expired' }
    if (reading.mode !== this.last?.mode || reading.seconds !== this.last?.seconds) {
      this.last = reading
      this.show(reading)
    }
    if (reading.mode === 'expired') { this.dispose(); this.expired(); return }
    if (mode === 'finished') { this.dispose(); return }
    if (mode === 'running') this.timer = setTimeout(() => this.set('running'), this.remaining % 1000 || 1000)
  }

  dispose() {
    this.stopped = true
    clearTimeout(this.timer)
  }
}
