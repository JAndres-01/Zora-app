import { useCallback, useRef } from 'react'
import { Animated } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { SPRING_ENTRANCE_CONFIG } from '@/constants/animations'

const playedScreens = new Set<string>()

/**
 * Hook reutilizable para animar escalonadamente los contenedores principales de una pantalla.
 * Se dispara en el PRIMER foco de la pantalla —al entrar cada pestaña durante la sesión en
 * frío— y solo una vez por pantalla por sesión para evitar saltos bruscos al cambiar de tab.
 *
 * Usa useFocusEffect (no useEffect) porque NativeTabs monta todas las pestañas al arrancar:
 * si la animación corriera en el mount, las 4 cascadas sonarían ocultas en frío y no se vería
 * ninguna al entrar después en cada pestaña.
 *
 * @param count Número de elementos/tarjetas a animar secuencialmente.
 * @param screenKey Identificador único de la pantalla (ej. 'today', 'tasks', 'schedule', 'settings').
 * @param staggerDelay Retardo en ms entre cada tarjeta animada (default: 80ms).
 */
export function useCardEntrance(
  count: number,
  screenKey: string,
  staggerDelay: number = 80
): Animated.Value[] {
  const hasPlayed = playedScreens.has(screenKey)

  const cardEntranceAnims = useRef<Animated.Value[]>(
    Array.from({ length: count }, () => new Animated.Value(hasPlayed ? 1 : 0))
  ).current

  useFocusEffect(
    useCallback(() => {
      if (playedScreens.has(screenKey)) return
      playedScreens.add(screenKey)

      cardEntranceAnims.forEach((anim) => anim.setValue(0))

      const staggerAnims = cardEntranceAnims.map((anim) =>
        Animated.spring(anim, {
          toValue: 1,
          ...SPRING_ENTRANCE_CONFIG,
        })
      )

      Animated.stagger(staggerDelay, staggerAnims).start()
    }, [cardEntranceAnims, screenKey, staggerDelay])
  )

  return cardEntranceAnims
}

export function getCardEntranceStyle(anim: Animated.Value) {
  return {
    opacity: anim.interpolate({
      inputRange: [0, 0.4, 1],
      outputRange: [0, 0.7, 1],
    }),
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [-36, 0],
        }),
      },
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1],
        }),
      },
    ],
  }
}

/**
 * Función de utilidad para pruebas unitarias: reinicia el registro de pantallas animadas.
 */
export function resetPlayedEntrances(): void {
  playedScreens.clear()
}

