import { Host, Button, Icon } from '@expo/ui'
import {
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  frame,
} from '@expo/ui/swift-ui/modifiers'
import type { SFSymbol } from 'sf-symbols-typescript'

export type GlassIconName = 'xmark' | 'checkmark' | 'back' | 'ellipsis' | 'photos'

export type GlassIconVariant = 'default' | 'prominent'

const SYMBOLS: Record<GlassIconName, SFSymbol> = {
  xmark: 'xmark',
  checkmark: 'checkmark',
  back: 'chevron.backward',
  ellipsis: 'ellipsis',
  photos: 'photo.on.rectangle',
}

// SF Symbols: chevron.backward y ellipsis requieren ajuste de escala óptica
// para que la silueta y los 3 puntos se perciban con el mismo peso visual que xmark.
const DEFAULT_ICON_SIZE: Record<GlassIconName, number> = {
  xmark: 26,
  checkmark: 26,
  back: 32,
  ellipsis: 36,
  photos: 26,
}

/**
 * Botón circular liquid glass NATIVO (SwiftUI buttonStyle `.glass` + borde circle)
 * — el mismo rendering que los botones de las apps de iOS 26.
 * `variant` se acepta por compatibilidad de tipos con el fallback, pero en iOS
 * ambos botones usan exactamente el mismo glass transparente (sin capas extra:
 * cualquier capa de color detrás del material se percibe como un círculo).
 */
export function NativeGlassIconButton({
  onPress,
  icon,
  accessibilityLabel: label,
  disabled,
  iconSize,
}: {
  onPress: () => void
  icon: GlassIconName
  accessibilityLabel: string
  disabled?: boolean
  variant?: GlassIconVariant
  iconSize?: number
}) {
  const effectiveSize = iconSize ?? DEFAULT_ICON_SIZE[icon]
  return (
    <Host matchContents>
      <Button
        variant="outlined"
        onPress={onPress}
        disabled={disabled}
        modifiers={[
          frame({ width: 58, height: 58, alignment: 'center' }),
          buttonStyle('glass'),
          buttonBorderShape('circle'),
          accessibilityLabel(label),
        ]}
      >
        <Icon
          name={SYMBOLS[icon]}
          size={effectiveSize}
          color="#FFFFFF"
          modifiers={[frame({ width: 28, height: 28, alignment: 'center' })]}
        />
      </Button>
    </Host>
  )
}