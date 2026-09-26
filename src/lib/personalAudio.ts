import { Platform } from 'react-native'
import { setAudioModeAsync, AudioModule, createAudioPlayer, preload, type AudioPlayer } from 'expo-audio'
import { Asset } from 'expo-asset'
import { prepareRattle, playRattleClicks, stopRattle } from '../../modules/rattle-audio/src'
import { logger } from '@/lib/logger'

export type SoundEffect =
  | 'confetti'        // Confetti fanfarria al completar tareas
  | 'task_undo'       // Desmarcar / Deshacer tarea
  | 'trash_delete'    // Eliminar / desvanecer tarea
  | 'warning_thud'    // Aviso suave / límite
  | 'shutter_save'    // Guardar o editar tareas / elementos
  | 'roulette_click'  // Clic de bola de ruleta (tic de la máquina de "¿Qué estudio?")

const SOUND_ASSETS: Record<SoundEffect, any> = {
  confetti: require('../../assets/sounds/confetti.wav'),
  task_undo: require('../../assets/sounds/task_undo.wav'),
  trash_delete: require('../../assets/sounds/trash_delete.wav'),
  warning_thud: require('../../assets/sounds/warning_thud.wav'),
  shutter_save: require('../../assets/sounds/shutter_save.wav'),
  roulette_click: require('../../assets/sounds/roulette_click.wav'),
}

let _globalSoundEnabled = true
const _nativePlayers: Partial<Record<SoundEffect, AudioPlayer>> = {}
const _webAudioElements: Partial<Record<SoundEffect, HTMLAudioElement>> = {}
const _webAssetUrls: Partial<Record<SoundEffect, string>> = {}
const ROULETTE_POOL_SIZE = 8
const _roulettePlayers: AudioPlayer[] = []
let _rouletteIndex = 0
let _audioModeConfigured = false

function getOrCreateNativePlayer(effect: SoundEffect): AudioPlayer | null {
  try {
    if (!_nativePlayers[effect]) {
      _nativePlayers[effect] = createAudioPlayer(SOUND_ASSETS[effect], {
        keepAudioSessionActive: true,
      })
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
  while (_roulettePlayers.length > 0) {
    const player = _roulettePlayers.pop()
    if (player) {
      try {
        if (typeof player.remove === 'function') player.remove()
      } catch {}
    }
  }
  _rouletteIndex = 0
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
    if (typeof setAudioModeAsync === 'function') {
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'mixWithOthers',
      })
    } else if (AudioModule && typeof AudioModule.setAudioModeAsync === 'function') {
      await AudioModule.setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'mixWithOthers',
      })
    }
    _audioModeConfigured = true
  } catch (err) {
    logger.warn('[personalAudio] Error configurando modo de audio:', err)
  }
}

/**
 * Precarga de audio segura y bajo demanda con configuración temprana de hardware.
 */
export async function preloadAllAudio(): Promise<void> {
  await configureAudioMode()
  if (Platform.OS !== 'web') {
    try {
      prepareRouletteRattle()
      warmUpRouletteClick()
      if (typeof preload === 'function') {
        await Promise.all(
          Object.values(SOUND_ASSETS).map((asset) => preload(asset).catch(() => {}))
        )
      }
    } catch {}
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
      await configureAudioMode()
    }

    const player = getOrCreateNativePlayer(effect)
    if (!player) return

    try {
      if (typeof player.seekTo === 'function') {
        await player.seekTo(0)
      }
    } catch {}

    try {
      player.play()
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
/**
 * Prepara los reproductores del clic sin reproducir (para pre-calentarlos al abrir el modal
 * y que su creación no provoque un tirón justo cuando arranca el giro).
 */
export function warmUpRouletteClick(): void {
  if (Platform.OS === 'web') return
  if (!_audioModeConfigured) {
    configureAudioMode().catch(() => {})
  }
  try {
    Asset.loadAsync(SOUND_ASSETS.roulette_click).catch(() => {})
    while (_roulettePlayers.length < ROULETTE_POOL_SIZE) {
      const player = createAudioPlayer(SOUND_ASSETS.roulette_click, {
        keepAudioSessionActive: true,
      })
      try {
        if (typeof player.seekTo === 'function') {
          player.seekTo(0).catch(() => {})
        }
      } catch {}
      _roulettePlayers.push(player)
    }
  } catch (err) {
    logger.warn('[personalAudio] Error preparando clic de ruleta:', err)
  }
}

/**
 * Clic de ruleta ultra-ligero: rota entre 8 reproductores dedicados precargados
 * con sesión activa para cero cortes de audio en iOS y fluidez total en Expo Go.
 */
export function playRouletteClickSound(): void {
  if (!_globalSoundEnabled) return
  if (Platform.OS === 'web') {
    playSound('roulette_click')
    return
  }
  if (_roulettePlayers.length === 0) {
    warmUpRouletteClick()
  }
  if (_roulettePlayers.length === 0) return

  const player = _roulettePlayers[_rouletteIndex]
  _rouletteIndex = (_rouletteIndex + 1) % _roulettePlayers.length
  if (!player) return

  try {
    // seekTo es ASÍNCRONO: jugar antes de que termine reproduce desde el final de la
    // pista (silencio). Esperar el rebobinado garantiza que cada cruce de fila suene.
    player.seekTo(0)
      .then(() => {
        try { player.play() } catch {}
      })
      .catch(() => {
        try { player.play() } catch {}
      })
  } catch (err) {
    try { player.play() } catch {}
  }
}

// ─── Ráfaga completa por módulo nativo (RattleAudio) ─────────────────────────
// Toda la ráfaga de clics (fase rápida + desaceleración) se programa DE GOLPE en el
// reloj del hardware de audio (AVAudioEngine / AudioTrack). El hilo JS no interviene
// por clic: cero lag y sincronía con precisión de muestra, como las apps de slots.

/** Pre-carga el clic en el motor nativo al abrir el modal (idempotente). */
export function prepareRouletteRattle(): void {
  prepareRattle(SOUND_ASSETS.roulette_click).catch(() => {})
}

/**
 * Programa y reproduce la ráfaga completa. `offsetsMs` = instantes (ms) en que cada
 * fila cruza la línea de pago. Devuelve true si el nativo lo aceptó; en web/test
 * (sin módulo nativo) devuelve false y el modal cae al modo por-clic del bucle rAF.
 */
export function playRouletteRattle(offsetsMs: number[]): boolean {
  if (Platform.OS === 'web' || !_globalSoundEnabled) return false
  return playRattleClicks(offsetsMs)
}

/** Corta cualquier ráfaga en reproducción (al cerrar el modal o re-girar). */
export function stopRouletteRattle(): void {
  stopRattle()
}

// Sonidos desactivados para mantener la experiencia limpia y sin ruido (no-op inmediatos):
export const playTaskCompleteSound = () => Promise.resolve()
export const playChipSnapSound = () => Promise.resolve()
export const playModalOpenSound = () => Promise.resolve()
export const playModalCloseSound = () => Promise.resolve()
export const playSwipeSound = () => Promise.resolve()
export const playClassReminderSound = () => Promise.resolve()
