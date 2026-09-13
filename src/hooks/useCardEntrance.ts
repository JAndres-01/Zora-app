import { useRef } from 'react'
import { Animated } from 'react-native'

/**
 * Hook de animaciones de entrada seguras para componentes principales.
 * Garantiza opacidad 1 y renderizado inmediato en móvil (iOS/Android) y web sin bloqueos de interfaz.
 */
const playedScreens = new Set<string>()

export function useCardEntrance(
  count: number,
  _screenKey?: string,
  _staggerDelay?: number
): Animated.Value[] {
  const cardEntranceAnims = useRef<Animated.Value[]>(
    Array.from({ length: count }, () => new Animated.Value(1))
  ).current

  return cardEntranceAnims
}

/**
 * Función de utilidad para pruebas unitarias: reinicia el registro de pantallas animadas.
 */
export function resetPlayedEntrances(): void {
  playedScreens.clear()
}
