let audioCtx = null

export function getAudioContext() {
  if (!audioCtx && typeof window !== 'undefined') {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (AudioContextClass) audioCtx = new AudioContextClass()
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

export function playChime(type = 'receive') {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    if (type === 'receive') {
      osc.frequency.setValueAtTime(587.33, now)
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12)
      gain.gain.setValueAtTime(0.08, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.25)
    } else {
      osc.frequency.setValueAtTime(440, now)
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.08)
      gain.gain.setValueAtTime(0.05, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.15)
    }
  } catch {}
}

let ringInterval = null
export function startRingtone(isIncoming = false) {
  stopRingtone()
  const playPulse = () => {
    try {
      const ctx = getAudioContext()
      if (!ctx) return
      const now = ctx.currentTime
      if (isIncoming) {
        [523.25, 659.25, 783.99].forEach((freq, i) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'triangle'
          osc.frequency.setValueAtTime(freq, now + i * 0.14)
          gain.gain.setValueAtTime(0.08, now + i * 0.14)
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.14 + 0.28)
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start(now + i * 0.14)
          osc.stop(now + i * 0.14 + 0.28)
        })
      } else {
        [440, 480].forEach((freq) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.setValueAtTime(freq, now)
          gain.gain.setValueAtTime(0.06, now)
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75)
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start(now)
          osc.stop(now + 0.75)
        })
      }
    } catch {}
  }
  playPulse()
  ringInterval = setInterval(playPulse, isIncoming ? 2600 : 3000)
}

export function stopRingtone() {
  if (ringInterval) {
    clearInterval(ringInterval)
    ringInterval = null
  }
}
