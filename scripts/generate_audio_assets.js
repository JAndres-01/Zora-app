const fs = require('fs')
const path = require('path')

const SAMPLE_RATE = 44100

function encodeWAV(samples) {
  const buffer = Buffer.alloc(44 + samples.length * 2)
  /* RIFF identifier */
  buffer.write('RIFF', 0)
  /* file length */
  buffer.writeUInt32LE(36 + samples.length * 2, 4)
  /* RIFF type */
  buffer.write('WAVE', 8)
  /* format chunk identifier */
  buffer.write('fmt ', 12)
  /* format chunk length */
  buffer.writeUInt32LE(16, 16)
  /* sample format (raw) */
  buffer.writeUInt16LE(1, 20)
  /* channel count */
  buffer.writeUInt16LE(1, 22)
  /* sample rate */
  buffer.writeUInt32LE(SAMPLE_RATE, 24)
  /* byte rate (sample rate * block align) */
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28)
  /* block align (channel count * bytes per sample) */
  buffer.writeUInt16LE(2, 32)
  /* bits per sample */
  buffer.writeUInt16LE(16, 34)
  /* data chunk identifier */
  buffer.write('data', 36)
  /* data chunk length */
  buffer.writeUInt32LE(samples.length * 2, 40)

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    buffer.writeInt16LE(s < 0 ? s * 0x8000 : s * 0x7FFF, 44 + i * 2)
  }

  return buffer
}

function tone(freq, durationSec, type = 'sine', decayFactor = 5) {
  const numSamples = Math.floor(SAMPLE_RATE * durationSec)
  const samples = new Float32Array(numSamples)
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE
    let wave = 0
    if (type === 'sine') {
      wave = Math.sin(2 * Math.PI * freq * t)
    } else if (type === 'triangle') {
      wave = 2 * Math.abs(2 * ((freq * t) % 1) - 1) - 1
    } else if (type === 'square') {
      wave = Math.sin(2 * Math.PI * freq * t) >= 0 ? 0.7 : -0.7
    }
    const env = Math.exp(-decayFactor * (t / durationSec))
    samples[i] = wave * env
  }
  return samples
}

function mix(tracks, totalDurationSec) {
  const totalSamples = Math.floor(SAMPLE_RATE * totalDurationSec)
  const out = new Float32Array(totalSamples)
  for (const tr of tracks) {
    const startIdx = Math.floor(tr.startTimeSec * SAMPLE_RATE)
    const vol = tr.volume ?? 1
    for (let i = 0; i < tr.samples.length; i++) {
      if (startIdx + i < totalSamples) {
        out[startIdx + i] += tr.samples[i] * vol
      }
    }
  }
  // Normalizar para evitar clipping
  let max = 0
  for (let i = 0; i < totalSamples; i++) {
    if (Math.abs(out[i]) > max) max = Math.abs(out[i])
  }
  if (max > 0.95) {
    const factor = 0.95 / max
    for (let i = 0; i < totalSamples; i++) out[i] *= factor
  }
  return out
}

const soundsDir = path.join(__dirname, '..', 'assets', 'sounds')
if (!fs.existsSync(soundsDir)) {
  fs.mkdirSync(soundsDir, { recursive: true })
}

// 1. #6 Doble Tono Chime (F#5 -> B5, Things 3 style)
{
  const t1 = tone(739.99, 0.16, 'sine', 4)
  const t2 = tone(987.77, 0.28, 'sine', 3.5)
  const mixed = mix([
    { startTimeSec: 0, samples: t1, volume: 0.65 },
    { startTimeSec: 0.08, samples: t2, volume: 0.8 },
  ], 0.38)
  fs.writeFileSync(path.join(soundsDir, 'task_complete.wav'), encodeWAV(mixed))
}

// 2. #12 Snap de Ficha / Materia (Plastic Snap 30ms)
{
  const t1 = tone(1100, 0.025, 'sine', 12)
  const t2 = tone(420, 0.02, 'triangle', 16)
  const mixed = mix([
    { startTimeSec: 0, samples: t1, volume: 0.7 },
    { startTimeSec: 0.006, samples: t2, volume: 0.6 },
  ], 0.035)
  fs.writeFileSync(path.join(soundsDir, 'chip_snap.wav'), encodeWAV(mixed))
}

// 3. #16 Suspiro al Abrir Modal (Soft Air Up 90ms)
{
  const duration = 0.09
  const numSamples = Math.floor(SAMPLE_RATE * duration)
  const samples = new Float32Array(numSamples)
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE
    const freq = 260 + (540 - 260) * (t / duration)
    const env = Math.sin(Math.PI * (t / duration))
    samples[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.5
  }
  fs.writeFileSync(path.join(soundsDir, 'modal_open.wav'), encodeWAV(samples))
}

// 4. #17 Exhalación al Descartar (Soft Air Down 80ms)
{
  const duration = 0.08
  const numSamples = Math.floor(SAMPLE_RATE * duration)
  const samples = new Float32Array(numSamples)
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE
    const freq = 520 - (520 - 220) * (t / duration)
    const env = Math.sin(Math.PI * (t / duration))
    samples[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.45
  }
  fs.writeFileSync(path.join(soundsDir, 'modal_close.wav'), encodeWAV(samples))
}

// 5. #18 Swipe de Terciopelo (Velvet Swoosh 60ms)
{
  const duration = 0.06
  const numSamples = Math.floor(SAMPLE_RATE * duration)
  const samples = new Float32Array(numSamples)
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE
    const freq = 320 + Math.sin(Math.PI * (t / duration)) * 100
    const env = Math.sin(Math.PI * (t / duration))
    samples[i] = (Math.sin(2 * Math.PI * freq * t) * 0.7 + (Math.random() * 2 - 1) * 0.3) * env * 0.35
  }
  fs.writeFileSync(path.join(soundsDir, 'swipe_velvet.wav'), encodeWAV(samples))
}

// 6. #20 Obturador Guardar (Camera Shutter Soft 50ms)
{
  const click1 = tone(1200, 0.015, 'triangle', 15)
  const click2 = tone(1600, 0.02, 'triangle', 12)
  const mixed = mix([
    { startTimeSec: 0, samples: click1, volume: 0.5 },
    { startTimeSec: 0.025, samples: click2, volume: 0.75 },
  ], 0.055)
  fs.writeFileSync(path.join(soundsDir, 'shutter_save.wav'), encodeWAV(mixed))
}

// 7. #22 Confetti Fanfarria (Major 7th: C5, E5, G5, C6)
{
  const notes = [523.25, 659.25, 783.99, 1046.50]
  const tracks = notes.map((freq, idx) => ({
    startTimeSec: idx * 0.065,
    samples: tone(freq, 0.35, 'triangle', 4),
    volume: 0.75,
  }))
  const mixed = mix(tracks, 0.6)
  fs.writeFileSync(path.join(soundsDir, 'confetti.wav'), encodeWAV(mixed))
}

// 8. #25 Aviso de Clase Próxima (Vibraphone Triad: A4, C#5, E5)
{
  const notes = [440, 554.37, 659.25]
  const tracks = notes.map((freq, idx) => ({
    startTimeSec: idx * 0.11,
    samples: tone(freq, 0.45, 'sine', 3),
    volume: 0.75,
  }))
  const mixed = mix(tracks, 0.75)
  fs.writeFileSync(path.join(soundsDir, 'class_reminder.wav'), encodeWAV(mixed))
}

// 9. #26 Eliminar / Desvanecer (Hollow Fade 320Hz -> 90Hz)
{
  const duration = 0.085
  const numSamples = Math.floor(SAMPLE_RATE * duration)
  const samples = new Float32Array(numSamples)
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE
    const freq = 320 * Math.pow(90 / 320, t / duration)
    const env = Math.pow(1 - (t / duration), 1.5)
    samples[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.6
  }
  fs.writeFileSync(path.join(soundsDir, 'trash_delete.wav'), encodeWAV(samples))
}

// 10. #27 Aviso Suave / Límite (Soft Thud 280Hz -> 240Hz)
{
  const t1 = tone(280, 0.07, 'sine', 8)
  const t2 = tone(240, 0.09, 'sine', 7)
  const mixed = mix([
    { startTimeSec: 0, samples: t1, volume: 0.6 },
    { startTimeSec: 0.08, samples: t2, volume: 0.5 },
  ], 0.18)
  fs.writeFileSync(path.join(soundsDir, 'warning_thud.wav'), encodeWAV(mixed))
}

console.log('[generate_audio_assets] 10 archivos de audio WAV generados exitosamente en assets/sounds/')
