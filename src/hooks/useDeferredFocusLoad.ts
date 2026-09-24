import { useCallback, useRef } from 'react'
import { useFocusEffect } from 'expo-router'

/**
 * Retardo entre el foco (cambio de pestaña) y el refresco de datos.
 * ~2-3 frames: suficiente para que el paint del switch ya se haya entregado
 * y el re-render de loadData no retrase ni bloquee la entrada.
 */
const FOCUS_REFRESH_DELAY_MS = 50

/**
 * Ejecuta un refresco de datos al enfocar la pantalla, pero DIFERIDO para que
 * la entrada a la pestaña ocurra al instante.
 *
 * Sin diferir, `useFocusEffect(loadData)` re-renderizaba la pantalla completa
 * en microtasks del mismo frame del switch: la pestaña anterior se quedaba
 * congelada ~1s y el FPS de JS caía de 90 a 60 en Android. Al diferir ~50ms,
 * el paint del switch se entrega primero y loadData refresca después, sin
 * bloquear la entrada ni volver a visitar pestañas ya cargadas.
 *
 * Se usa un timeout (no InteractionManager) porque las animaciones con Animated
 * registran handles de interacción por defecto (isInteraction: true) y loops
 * como el pulso del timeline los mantendrían activos indefinidamente.
 *
 * @param load Función de refresh (p. ej. loadData). Se cancela si la pantalla
 *             pierde el foco antes de ejecutarse.
 */
export function useDeferredFocusLoad(load: () => void, delayMs: number = FOCUS_REFRESH_DELAY_MS) {
  const loadRef = useRef(load)
  loadRef.current = load

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useFocusEffect(
    useCallback(() => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        loadRef.current()
      }, delayMs)
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }, [delayMs])
  )
}