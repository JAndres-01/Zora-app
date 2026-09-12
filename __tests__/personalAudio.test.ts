import {
  playSound,
  setGlobalSoundEnabled,
  isGlobalSoundEnabled,
  playTaskCompleteSound,
  playTaskUndoSound,
  playChipSnapSound,
  playModalOpenSound,
  playModalCloseSound,
  playSwipeSound,
  playSaveSound,
  playConfettiSound,
  playClassReminderSound,
  playTrashSound,
  playWarningSound,
  preloadAllAudio,
  configureAudioMode,
  __resetAudioConfigForTesting,
} from '@/lib/personalAudio'
import { createAudioPlayer, AudioModule } from 'expo-audio'

describe('personalAudio', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setGlobalSoundEnabled(true)
    __resetAudioConfigForTesting()
  })

  it('permite consultar y alternar el estado global del sonido', () => {
    expect(isGlobalSoundEnabled()).toBe(true)
    setGlobalSoundEnabled(false)
    expect(isGlobalSoundEnabled()).toBe(false)
    setGlobalSoundEnabled(true)
    expect(isGlobalSoundEnabled()).toBe(true)
  })

  it('reproduce sonidos mediante expo-audio cuando el sonido esta activo', async () => {
    await playSound('confetti')
    expect(createAudioPlayer).toHaveBeenCalled()
    const mockPlayer = (createAudioPlayer as jest.Mock).mock.results[0]?.value
    expect(mockPlayer.play).toHaveBeenCalled()
  })

  it('no reproduce sonidos si el sonido esta deshabilitado', async () => {
    setGlobalSoundEnabled(false)
    await playSound('confetti')
    expect(createAudioPlayer).not.toHaveBeenCalled()
  })

  it('ejecuta los helpers semanticos sin errores', async () => {
    await expect(playTaskCompleteSound()).resolves.not.toThrow()
    await expect(playTaskUndoSound()).resolves.not.toThrow()
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

  it('configura el modo de audio nativo y precarga sonidos', async () => {
    await expect(configureAudioMode()).resolves.not.toThrow()
    expect(AudioModule.setAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
    })

    await expect(preloadAllAudio()).resolves.not.toThrow()
    expect(createAudioPlayer).toHaveBeenCalled()
  })

  it('captura errores silenciosamente si el reproductor falla', async () => {
    ;(createAudioPlayer as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Audio hardware unavailable')
    })
    await expect(playSound('warning_thud')).resolves.not.toThrow()
  })

  it('soporta disparos rápidos consecutivos mediante el pool de reproductores rotativos', async () => {
    for (let i = 0; i < 6; i++) {
      await playSound('task_undo')
    }
    // Cada llamada inicial crea una instancia en el pool de 6 slots
    expect(createAudioPlayer).toHaveBeenCalledTimes(6)

    // La 7ma llamada recicla el slot 0 liberando el anterior y garantizando reproducción limpia
    await playSound('task_undo')
    expect(createAudioPlayer).toHaveBeenCalledTimes(7)
  })
})