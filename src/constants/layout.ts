import { Dimensions } from 'react-native'

const windowDimensions = Dimensions.get('window')

export const SCREEN_WIDTH = windowDimensions.width
export const SCREEN_HEIGHT = windowDimensions.height

/**
 * Ratios de altura estándar para hojas modales (bottom sheets).
 */
export const MODAL_HEIGHTS = {
  full: SCREEN_HEIGHT * 0.94,
  large: SCREEN_HEIGHT * 0.88,
  standard: SCREEN_HEIGHT * 0.84,
  medium: SCREEN_HEIGHT * 0.82,
  compact: SCREEN_HEIGHT * 0.55,
} as const
