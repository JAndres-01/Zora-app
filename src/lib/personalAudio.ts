import { Platform } from 'react-native'
import { createAudioPlayer, type AudioPlayer } from 'expo-audio'
import { logger } from '@/lib/logger'

export type SoundEffect =
  | 'task_complete'   // #6 Doble tono Chime
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
  task_complete: require('../../assets/sounds/task_complete.wav'),
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
 * Reproduce de forma asíncrona ("fire-and-forget") uno de los 10 efectos de sonido de Zora.
 * Si el sonido está deshabilitado en Ajustes, se omite de inmediato sin retrasar la UI.
 */
export async function playSound(effect: SoundEffect): Promise<void> {
  if (!_globalSoundEnabled) return

  try {
    if (Platform.OS === 'web') {
      // En Web reproducimos de forma nativa con HTMLAudioElement
      if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
        const audioAsset = SOUND_ASSETS[effect]
        const src = typeof audioAsset === 'string' ? audioAsset : (audioAsset?.default || audioAsset?.uri || '')
        if (src) {
          const webAudio = new Audio(src)
          webAudio.volume = 0.6
          webAudio.play().catch(() => {})
        }
      }
      return
    }

    // En iOS / Android usamos el reproductor nativo expo-audio
    let player = _cachedPlayers[effect]
    if (!player) {
      const asset = SOUND_ASSETS[effect]
      player = createAudioPlayer(asset)
      _cachedPlayers[effect] = player
    }

    // Reiniciar posición y reproducir
    if (player) {
      if (typeof player.seekTo === 'function') {
        await player.seekTo(0)
      }
      player.play()
    }
  } catch (err) {
    // Protección silenciosa: nunca lanzar excepciones que interrumpan la interacción del usuario
    logger.warn(`[personalAudio] Error reproduciendo sonido ${effect}:`, err)
  }
}

// Helpers semánticos rápidos para cada acción del sistema:
export const playTaskCompleteSound = () => playSound('task_complete') // #6
export const playChipSnapSound = () => playSound('chip_snap') // #12
export const playModalOpenSound = () => playSound('modal_open') // #16
export const playModalCloseSound = () => playSound('modal_close') // #17
export const playSwipeSound = () => playSound('swipe_velvet') // #18
export const playSaveSound = () => playSound('shutter_save') // #20
export const playConfettiSound = () => playSound('confetti') // #22
export const playClassReminderSound = () => playSound('class_reminder') // #25
export const playTrashSound = () => playSound('trash_delete') // #26
export const playWarningSound = () => playSound('warning_thud') // #27
