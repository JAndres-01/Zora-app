import { Platform } from 'react-native'
import { AudioModule, createAudioPlayer, type AudioPlayer } from 'expo-audio'
import { Asset } from 'expo-asset'
import { logger } from '@/lib/logger'

export type SoundEffect =
  | 'confetti'        // Confetti fanfarria al completar tareas
  | 'task_undo'       // Desmarcar / Deshacer tarea
  | 'trash_delete'    // Eliminar / desvanecer tarea
  | 'warning_thud'    // Aviso suave / límite

const SOUND_ASSETS: Record<SoundEffect, any> = {
  confetti: require('../../assets/sounds/confetti.wav'),
  task_undo: require('../../assets/sounds/task_undo.wav'),
  trash_delete: require('../../assets/sounds/trash_delete.wav'),
  warning_thud: require('../../assets/sounds/warning_thud.wav'),
}

let _globalSoundEnabled = true
const _cachedPlayers: Partial<Record<SoundEffect, AudioPlayer>> = {}
let _audioModeConfigured = false

/**
 * Resetea el flag de configuración de audio y la caché de reproductores para pruebas.
 */
export function __resetAudioConfigForTesting(): void {
  _audioModeConfigured = false
  for (const key of Object.keys(_cachedPlayers) as SoundEffect[]) {
    delete _cachedPlayers[key]
  }
}

/**
 * Configura el modo de audio nativo para reproducir en modo silencioso y mezclar con otras fuentes.
 */
export async function configureAudioMode(): Promise<void> {
  if (_audioModeConfigured || Platform.OS === 'web') return
  try {
    if (AudioModule && typeof AudioModule.setAudioModeAsync === 'function') {
      await AudioModule.setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'mixWithOthers',
      })
      _audioModeConfigured = true
    }
  } catch (err) {
    logger.warn('[personalAudio] Error configurando modo de audio:', err)
  }
}

/**
 * Precarga todos los efectos de audio nativos en memoria para reproducción instantánea sin latencia.
 */
export async function preloadAllAudio(): Promise<void> {
  if (Platform.OS === 'web') return
  await configureAudioMode()
  for (const key of Object.keys(SOUND_ASSETS) as SoundEffect[]) {
    try {
      if (!_cachedPlayers[key]) {
        _cachedPlayers[key] = createAudioPlayer(SOUND_ASSETS[key])
      }
    } catch (err) {
      logger.warn(`[personalAudio] Error precargando sonido ${key}:`, err)
    }
  }
}

/**
 * Activa o desactiva la reproducción de sonidos a nivel de sesión.
 */
export function setGlobalSoundEnabled(enabled: boolean): void {
  _globalSoundEnabled = enabled
}

/**
 * Consulta si los sonidos están habilitados.
 */
export function isGlobalSoundEnabled(): boolean {
  return _globalSoundEnabled
}

/**
 * Reproduce de forma asíncrona ("fire-and-forget") uno de los efectos de sonido de Zora.
 * Si el sonido está deshabilitado en Ajustes, se omite de inmediato sin retrasar la UI.
 */
export async function playSound(effect: SoundEffect): Promise<void> {
  if (!_globalSoundEnabled) return

  try {
    if (Platform.OS === 'web') {
      // En Web reproducimos con HTMLAudioElement
      if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
        const audioAsset = SOUND_ASSETS[effect]
        let src = typeof audioAsset === 'string' ? audioAsset : (audioAsset?.default || audioAsset?.uri || '')
        if (!src) {
          try {
            const assetObj = Asset.fromModule(audioAsset)
            src = assetObj?.uri || ''
          } catch {}
        }
        if (src) {
          const webAudio = new Audio(src)
          webAudio.volume = 0.6
          webAudio.play().catch(() => {})
        }
      }
      return
    }

    // Configurar modo de audio la primera vez en background si no se ha hecho
    if (!_audioModeConfigured) {
      configureAudioMode().catch(() => {})
    }

    // En iOS / Android usamos el reproductor nativo expo-audio
    let player = _cachedPlayers[effect]
    if (!player) {
      const asset = SOUND_ASSETS[effect]
      player = createAudioPlayer(asset)
      _cachedPlayers[effect] = player
    }

    if (player) {
      // Si el reproductor ya se reprodujo antes, rebobinamos en background sin bloquear play()
      if (player.currentTime > 0 && typeof player.seekTo === 'function') {
        player.seekTo(0).catch(() => {})
      }
      player.play()
    }
  } catch (err) {
    // Protección silenciosa: nunca lanzar excepciones que interrumpan la interacción del usuario
    logger.warn(`[personalAudio] Error reproduciendo sonido ${effect}:`, err)
  }
}

// Helpers semánticos rápidos para cada acción del sistema:
// Únicamente 4 sonidos activos solicitados: confetti, desmarcar tarea, borrar tarea y avisos.
export const playConfettiSound = () => playSound('confetti')
export const playTaskUndoSound = () => playSound('task_undo')
export const playTrashSound = () => playSound('trash_delete')
export const playWarningSound = () => playSound('warning_thud')

// Sonidos desactivados para mantener la experiencia limpia y sin ruido (no-op inmediatos):
export const playTaskCompleteSound = () => Promise.resolve()
export const playChipSnapSound = () => Promise.resolve()
export const playModalOpenSound = () => Promise.resolve()
export const playModalCloseSound = () => Promise.resolve()
export const playSwipeSound = () => Promise.resolve()
export const playSaveSound = () => Promise.resolve()
export const playClassReminderSound = () => Promise.resolve()
