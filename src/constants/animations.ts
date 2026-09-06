import { Easing, LayoutAnimation } from 'react-native'

export const APPLE_EASING = Easing.bezier(0.16, 1, 0.3, 1)

/**
 * ─── FILOSOFÍA DE ANIMACIONES — ZORA ───────────────────────────────────────
 *
 * Estilo canónico: easeInEaseOut
 * ─────────────────────────────
 * Todas las animaciones de la app usan easeInEaseOut como base.
 * - Sin rebote (springDamping ≥ 1.0 o evitar spring por completo)
 * - Sin sacudida ni brusquedad
 * - Rápidas: 180–260ms para transiciones de layout, 120–160ms para fade
 * - La velocidad transmite fluidez y respuesta instantánea
 *
 * Usar spring SOLO para microinteracciones táctiles (press feedback, FAB),
 * nunca para reposicionamiento de listas ni cambios de panel.
 */

/**
 * Configuración LayoutAnimation estándar de Zora.
 * Usar para reposicionamiento de listas, cambios de panel, entrada/salida de filas.
 * - update: easeInEaseOut (sin rebote)
 * - create/delete: easeInEaseOut con opacity
 */
export const LAYOUT_EASE = (
  duration: number = 220,
  phaseDurations?: { create?: number; update?: number; delete?: number }
) =>
  LayoutAnimation.configureNext({
    duration,
    create: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
      duration: phaseDurations?.create,
    },
    update: {
      type: LayoutAnimation.Types.easeInEaseOut,
      duration: phaseDurations?.update,
    },
    delete: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
      duration: phaseDurations?.delete,
    },
  })

/**
 * LayoutAnimation para switches de panel (Pendientes/Completadas/Todas).
 * - update: easeOut (arranca rápido y suaviza al llegar a destino → deslizamiento fluido)
 * - create/delete: easeInEaseOut con opacity (fade rápido)
 */
export const PANEL_SWITCH_LAYOUT = (
  fadeDuration: number = 100,
  updateDuration: number = 150
) =>
  LayoutAnimation.configureNext({
    duration: Math.max(fadeDuration, updateDuration),
    create: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
      duration: fadeDuration,
    },
    update: {
      type: LayoutAnimation.Types.easeOut,
      duration: updateDuration,
    },
    delete: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
      duration: fadeDuration,
    },
  })

/**
 * Física de resorte para paneles modales inferiores.
 */
export const SPRING_PANEL_CONFIG = {
  stiffness: 750,
  damping: 32,
  mass: 0.5,
  useNativeDriver: true,
} as const

/**
 * Física de resorte para animación de entrada escalonada en pantallas principales.
 */
export const SPRING_ENTRANCE_CONFIG = {
  stiffness: 320,
  damping: 24,
  mass: 0.7,
  useNativeDriver: true,
} as const

/**
 * Física de resorte táctil para retroalimentación interactiva (botones, fab, etc.).
 */
export const SPRING_TOUCH_CONFIG = {
  stiffness: 500,
  damping: 20,
  useNativeDriver: true,
} as const

/**
 * Física de resorte críticamente amortiguada (damping ratio ≈ 1.0) para indicadores y barras
 * de deslizamiento horizontal (tabs, segment controls, islas de navegación).
 */
export const SPRING_SLIDE_INDICATOR = {
  stiffness: 420,
  damping: 32,
  mass: 0.55,
  useNativeDriver: true,
} as const
