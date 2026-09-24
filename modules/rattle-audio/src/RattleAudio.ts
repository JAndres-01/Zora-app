import { requireNativeModule } from 'expo-modules-core'
import { Asset } from 'expo-asset'
import { logger } from '@/lib/logger'

/**
 * Wrapper JS del módulo nativo `RattleAudio` (iOS AVAudioEngine / Android AudioTrack).
 *
 * La ráfaga completa de clics se programa de GOLPE en el reloj del hardware de audio:
 * se pasa la lista de offsets (ms desde el arranque del giro) y el nativo monta un
 * único flujo PCM y lo reproduce con precisión de muestra. El hilo JS NO vuelve a
 * intervenir por cada clic — por eso no hay lag ni desfase, como en las apps de slots.
 */

interface RattleAudioNative {
  /** Pre-carga y decodifica el WAV del clic (idempotente; sincroniza el audio mode). */
  prepareAsync(uri: string): Promise<void>
  /** Programa y reproduce los clics en los offsets dados. Devuelve true si aceptó. */
  playClicks(offsetsMs: number[]): boolean
  /** Corta cualquier ráfaga en reproducción. */
  stop(): void
  /** Sincroniza datos con UserDefaults del App Group de iOS y recarga WidgetKit. */
  syncWidgetData?(jsonString: string): boolean
}

let nativeModule: RattleAudioNative | null = null
try {
  nativeModule = requireNativeModule('RattleAudio') as RattleAudioNative
} catch {
  nativeModule = null
}

/** True si el módulo nativo está disponible (iOS/Android real). Web y Jest → false. */
export function isRattleAvailable(): boolean {
  return nativeModule != null
}

let preparedKey: string | null = null
let preparePromise: Promise<void> | null = null

/**
 * Pre-carga y decodifica el clic en el motor de audio nativo (una sola vez, cacheado).
 * Se llama al abrir el modal: así el primer giro no paga el costo de decodificar.
 */
export async function prepareRattle(assetModule: Parameters<typeof Asset.fromModule>[0]): Promise<void> {
  if (!nativeModule) return
  if (preparePromise) return preparePromise

  preparePromise = (async () => {
    try {
      const assets = await Asset.loadAsync(assetModule as any)
      const asset = assets?.[0]
      const assetUri = asset?.localUri || asset?.uri || null
      if (!assetUri || assetUri === preparedKey) return
      await nativeModule.prepareAsync(assetUri)
      preparedKey = assetUri
    } catch (err) {
      logger.warn('[RattleAudio] No se pudo preparar el clic:', err)
    } finally {
      preparePromise = null
    }
  })()

  return preparePromise
}

/**
 * Programa TODA la ráfaga en el audio nativo. `offsetsMs` son los instantes (ms)
 * en los que cada fila cruza la línea de pago. Devuelve true si el nativo aceptó;
 * false si no hay módulo nativo (web/test) → el llamador cae al modo por-clic.
 */
export function playRattleClicks(offsetsMs: number[]): boolean {
  if (!nativeModule) return false
  try {
    // El nativo devuelve false si el motor aún no está preparado (prepareAsync pendiente):
    // si se ignora, JS cree que la ráfaga se programó y no hay fallback → silencio total.
    return nativeModule.playClicks(offsetsMs.map(Math.round)) === true
  } catch (err) {
    logger.warn('[RattleAudio] No se pudieron programar los clics:', err)
    return false
  }
}

/** Corta cualquier ráfaga en reproducción (al cerrar el modal o re-girar). */
export function stopRattle(): void {
  try {
    nativeModule?.stop()
  } catch {
    // no-op
  }
}

/** Sincroniza datos de widgets con el App Group de iOS y refresca WidgetKit. */
export function syncWidgetDataNative(jsonString: string): boolean {
  if (!nativeModule || typeof nativeModule.syncWidgetData !== 'function') return false
  try {
    return nativeModule.syncWidgetData(jsonString) === true
  } catch (err) {
    logger.warn('[RattleAudio] Error sincronizando datos de widget:', err)
    return false
  }
}