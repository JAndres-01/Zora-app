import {
  playSound,
  setGlobalSoundEnabled,
  isGlobalSoundEnabled,
  playTaskCompleteSound,
  playChipSnapSound,
  playModalOpenSound,
  playModalCloseSound,
  playSwipeSound,
  playSaveSound,
  playConfettiSound,
  playClassReminderSound,
  playTrashSound,
  playWarningSound,
} from '@/lib/personalAudio'
import { createAudioPlayer } from 'expo-audio'

describe('personalAudio', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setGlobalSoundEnabled(true)
  })

  it('permite consultar y alternar el estado global del sonido', () => {
    expect(isGlobalSoundEnabled()).toBe(true)
    setGlobalSoundEnabled(false)
    expect(isGlobalSoundEnabled()).toBe(false)
    setGlobalSoundEnabled(true)
    expect(isGlobalSoundEnabled()).toBe(true)
  })

  it('reproduce sonidos mediante expo-audio cuando el sonido está activo', async () => {
    await playSound('task_complete')
    expect(createAudioPlayer).toHaveBeenCalled()
    const mockPlayer = (createAudioPlayer as jest.Mock).mock.results[0]?.value
    expect(mockPlayer.play).toHaveBeenCalled()
  })

  it('no reproduce sonidos si el sonido está deshabilitado', async () => {
    setGlobalSoundEnabled(false)
    await playSound('task_complete')
    expect(createAudioPlayer).not.toHaveBeenCalled()
  })

  it('ejecuta los 10 helpers semánticos sin errores', async () => {
    await expect(playTaskCompleteSound()).resolves.not.toThrow()
    await expect(playChipSnapSound()).resolves.not.toThrow()
    await expect(playModalOpenSound()).resolves.not.toThrow()
    await expect(playModalCloseSound()).resolves.not.toThrow()
    await expect(playSwipeSound()).resolves.not.toThrow()
    await expect(playSaveSound()).resolves.not.toThrow()
    await expect(playConfettiSound()).resolves.not.toThrow()
    await expect(playClassReminderSound()).resolves.not.toThrow()
    await expect(playTrashSound()).resolves.not.toThrow()
    await expect(playWarningSound()).resolves.not.toThrow()
  })

  it('captura errores silenciosamente si el reproductor falla', async () => {
    ;(createAudioPlayer as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Audio hardware unavailable')
    })
    await expect(playSound('warning_thud')).resolves.not.toThrow()
  })
})
