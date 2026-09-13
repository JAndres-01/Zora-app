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

const POOL_SIZE = 4
let _globalSoundEnabled = true
const _playerPool: Partial<Record<SoundEffect, AudioPlayer[]>> = {}
const _poolPointers: Partial<Record<SoundEffect, number>> = {}
const _webAssetUrls: Partial<Record<SoundEffect, string>> = {}
let _audioModeConfigured = false

function createPlayerInstance(effect: SoundEffect): AudioPlayer {
  return createAudioPlayer(SOUND_ASSETS[effect], {
    keepAudioSessionActive: true,
    downloadFirst: true,
  })
}

function getOrCreatePool(effect: SoundEffect): AudioPlayer[] {
  let pool = _playerPool[effect]
  if (!pool || pool.length === 0) {
    pool = []
    for (let i = 0; i < POOL_SIZE; i++) {
      pool.push(createPlayerInstance(effect))
    }
    _playerPool[effect] = pool
    _poolPointers[effect] = 0
  }
  return pool
}

/**
 * Resetea el flag de configuración de audio y la caché de reproductores para pruebas.
 */
export function __resetAudioConfigForTesting(): void {
  _audioModeConfigured = false
  for (const key of Object.keys(_playerPool) as SoundEffect[]) {
    const pool = _playerPool[key]
    if (pool) {
      for (const player of pool) {
        try {
          if (typeof player.remove === 'function') {
            player.remove()
          }
        } catch {}
      }
    }
    delete _playerPool[key]
    delete _poolPointers[key]
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
 * Precarga todos los efectos de audio nativos en memoria para reproducción instantánea sin latencia.
 */
export async function preloadAllAudio(): Promise<void> {
  if (Platform.OS === 'web') return
  await configureAudioMode()
  for (const key of Object.keys(SOUND_ASSETS) as SoundEffect[]) {
    try {
      getOrCreatePool(key)
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
 * Reproduce de forma instantánea uno de los efectos de sonido de Zora.
 * Reutiliza instancias precargadas en memoria sin recrearlas para garantizar
 * latencia 0ms y fluidez total incluso en ráfagas rápidas de interacción.
 */
export async function playSound(effect: SoundEffect): Promise<void> {
  if (!_globalSoundEnabled) return

  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
        const src = getWebAudioSrc(effect)
        if (src) {
          const webAudio = new Audio(src)
          webAudio.volume = 0.6
          webAudio.play().catch(() => {})
        }
      }
      return
    }

    if (!_audioModeConfigured) {
      configureAudioMode().catch(() => {})
    }

    const pool = getOrCreatePool(effect)
    if (pool.length === 0) return

    // Buscar un reproductor libre que no esté reproduciendo
    let chosenPlayer: AudioPlayer | null = null
    let chosenIdx = -1

    for (let i = 0; i < pool.length; i++) {
      const p = pool[i]
      if (p && !p.playing) {
        chosenPlayer = p
        chosenIdx = i
        break
      }
    }

    // Si todos están ocupados (ráfaga ultra-rápida), rotación round-robin
    if (!chosenPlayer) {
      const currentIdx = _poolPointers[effect] ?? 0
      _poolPointers[effect] = (currentIdx + 1) % pool.length
      chosenPlayer = pool[currentIdx]
      chosenIdx = currentIdx
    }

    if (!chosenPlayer) return

    try {
      if (chosenPlayer.currentTime > 0) {
        chosenPlayer
          .seekTo(0)
          .then(() => {
            try {
              chosenPlayer?.play()
            } catch {}
          })
          .catch(() => {
            try {
              chosenPlayer?.play()
            } catch {}
          })
      } else {
        chosenPlayer.play()
      }
    } catch (playErr) {
      logger.warn(`[personalAudio] Error reproduciendo ${effect}, regenerando slot:`, playErr)
      try {
        const freshPlayer = createPlayerInstance(effect)
        pool[chosenIdx] = freshPlayer
        freshPlayer.play()
      } catch {}
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
