import { Platform } from 'react-native'
import { AudioModule, createAudioPlayer, type AudioPlayer } from 'expo-audio'
import { Asset } from 'expo-asset'
import { logger } from '@/lib/logger'

export type SoundEffect =
  | 'confetti'        // Confetti fanfarria al completar tareas
  | 'task_undo'       // Desmarcar / Deshacer tarea
  | 'trash_delete'    // Eliminar / desvanecer tarea
  | 'warning_thud'    // Aviso suave / límite
  | 'shutter_save'    // Guardar o editar tareas / elementos

const SOUND_ASSETS: Record<SoundEffect, any> = {
  confetti: require('../../assets/sounds/confetti.wav'),
  task_undo: require('../../assets/sounds/task_undo.wav'),
  trash_delete: require('../../assets/sounds/trash_delete.wav'),
  warning_thud: require('../../assets/sounds/warning_thud.wav'),
  shutter_save: require('../../assets/sounds/shutter_save.wav'),
}

let _globalSoundEnabled = true
const _nativePlayers: Partial<Record<SoundEffect, AudioPlayer>> = {}
const _webAudioElements: Partial<Record<SoundEffect, HTMLAudioElement>> = {}
const _webAssetUrls: Partial<Record<SoundEffect, string>> = {}
let _audioModeConfigured = false

function getOrCreateNativePlayer(effect: SoundEffect): AudioPlayer | null {
  try {
    if (!_nativePlayers[effect]) {
      _nativePlayers[effect] = createAudioPlayer(SOUND_ASSETS[effect])
    }
    return _nativePlayers[effect]!
  } catch (err) {
    logger.warn(`[personalAudio] Error creando reproductor para ${effect}:`, err)
    return null
  }
}

/**
 * Resetea el flag de configuración de audio y la caché de reproductores para pruebas.
 */
export function __resetAudioConfigForTesting(): void {
  _audioModeConfigured = false
  for (const key of Object.keys(_nativePlayers) as SoundEffect[]) {
    const player = _nativePlayers[key]
    if (player) {
      try {
        if (typeof player.remove === 'function') {
          player.remove()
        }
      } catch {}
    }
    delete _nativePlayers[key]
  }
  for (const key of Object.keys(_webAudioElements) as SoundEffect[]) {
    delete _webAudioElements[key]
  }
  for (const key of Object.keys(_webAssetUrls) as SoundEffect[]) {
    delete _webAssetUrls[key]
  }
}

/**
 * Obtiene la URL resolver de la fuente Web de forma síncrona y cacheada.
 */
function getWebAudioSrc(effect: SoundEffect): string {
  if (_webAssetUrls[effect]) return _webAssetUrls[effect]!
  const audioAsset = SOUND_ASSETS[effect]
  let src = typeof audioAsset === 'string' ? audioAsset : (audioAsset?.default || audioAsset?.uri || '')
  if (!src) {
    try {
      const assetObj = Asset.fromModule(audioAsset)
      src = assetObj?.uri || assetObj?.localUri || ''
    } catch {}
  }
  if (src) {
    _webAssetUrls[effect] = src
  }
  return src
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
 * Precarga de audio segura y bajo demanda (no-op para evitar picos de memoria innecesarios).
 */
export async function preloadAllAudio(): Promise<void> {
  // Inicialización diferida bajo demanda para optimizar memoria RAM a <50MB
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
 * Reproduce de forma instantánea uno de los efectos de sonido de Zora de forma ligera.
 */
export async function playSound(effect: SoundEffect): Promise<void> {
  if (!_globalSoundEnabled) return

  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
        const src = getWebAudioSrc(effect)
        if (src) {
          let webAudio = _webAudioElements[effect]
          if (!webAudio) {
            webAudio = new Audio(src)
            webAudio.volume = 0.6
            _webAudioElements[effect] = webAudio
          }
          webAudio.currentTime = 0
          webAudio.play().catch(() => {})
        }
      }
      return
    }

    if (!_audioModeConfigured) {
      configureAudioMode().catch(() => {})
    }

    const player = getOrCreateNativePlayer(effect)
    if (!player) return

    try {
      if (player.currentTime > 0) {
        player.seekTo(0).then(() => {
          try { player.play() } catch {}
        }).catch(() => {
          try { player.play() } catch {}
        })
      } else {
        player.play()
      }
    } catch (playErr) {
      logger.warn(`[personalAudio] Error reproduciendo ${effect}:`, playErr)
    }
  } catch (err) {
    logger.warn(`[personalAudio] Error reproduciendo sonido ${effect}:`, err)
  }
}

// Helpers semánticos rápidos para cada acción del sistema:
export const playConfettiSound = () => playSound('confetti')
export const playTaskUndoSound = () => playSound('task_undo')
export const playTrashSound = () => playSound('trash_delete')
export const playWarningSound = () => playSound('warning_thud')
export const playSaveSound = () => playSound('shutter_save')

// Sonidos desactivados para mantener la experiencia limpia y sin ruido (no-op inmediatos):
export const playTaskCompleteSound = () => Promise.resolve()
export const playChipSnapSound = () => Promise.resolve()
export const playModalOpenSound = () => Promise.resolve()
export const playModalCloseSound = () => Promise.resolve()
export const playSwipeSound = () => Promise.resolve()
export const playClassReminderSound = () => Promise.resolve()
