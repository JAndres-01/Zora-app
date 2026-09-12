import { Platform } from 'react-native'
import { AudioModule, createAudioPlayer, type AudioPlayer } from 'expo-audio'
import { Asset } from 'expo-asset'
import { logger } from '@/lib/logger'

export type SoundEffect =
  | 'task_undo'       // Desmarcar / Deshacer tarea (water pop suave)
  | 'chip_snap'       // #12 Snap de ficha / materia
  | 'modal_open'      // #16 Suspiro al abrir modal
  | 'modal_close'     // #17 Exhalación al cerrar modal
  | 'swipe_velvet'    // #18 Deslizar día / tab
  | 'shutter_save'    // #20 Obturador al guardar
  | 'confetti'        // #22 Confetti fanfarria
  | 'class_reminder'  // #25 Aviso de clase
  | 'trash_delete'    // #26 Eliminar / desvanecer
  | 'warning_thud'    // #27 Aviso suave / límite

const SOUND_ASSETS: Record<SoundEffect, any> = {
  task_undo: require('../../assets/sounds/task_undo.wav'),
  chip_snap: require('../../assets/sounds/chip_snap.wav'),
  modal_open: require('../../assets/sounds/modal_open.wav'),
  modal_close: require('../../assets/sounds/modal_close.wav'),
  swipe_velvet: require('../../assets/sounds/swipe_velvet.wav'),
  shutter_save: require('../../assets/sounds/shutter_save.wav'),
  confetti: require('../../assets/sounds/confetti.wav'),
  class_reminder: require('../../assets/sounds/class_reminder.wav'),
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
// #6 eliminado a petición del usuario para evitar colisión con el sonido festivo de confetti
export const playTaskCompleteSound = () => Promise.resolve()
export const playTaskUndoSound = () => playSound('task_undo')
export const playChipSnapSound = () => playSound('chip_snap') // #12
export const playModalOpenSound = () => playSound('modal_open') // #16
export const playModalCloseSound = () => playSound('modal_close') // #17
export const playSwipeSound = () => playSound('swipe_velvet') // #18
export const playSaveSound = () => playSound('shutter_save') // #20
export const playConfettiSound = () => playSound('confetti') // #22
export const playClassReminderSound = () => playSound('class_reminder') // #25
export const playTrashSound = () => playSound('trash_delete') // #26
export const playWarningSound = () => playSound('warning_thud') // #27
