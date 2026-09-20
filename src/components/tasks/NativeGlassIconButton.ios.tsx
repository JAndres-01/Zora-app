import { Host, Button, Icon } from '@expo/ui'
import {
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  frame,
} from '@expo/ui/swift-ui/modifiers'
import type { SFSymbol } from 'sf-symbols-typescript'

export type GlassIconName = 'xmark' | 'checkmark' | 'back'

export type GlassIconVariant = 'default' | 'prominent'

const SYMBOLS: Record<GlassIconName, SFSymbol> = {
  xmark: 'xmark',
  checkmark: 'checkmark',
  back: 'chevron.backward',
}

// SF Symbols: chevron.backward es ópticamente más angosto que checkmark;
// se escala un poco más para que "atrás" se perciba del mismo tamaño que la palomita.
const DEFAULT_ICON_SIZE: Record<GlassIconName, number> = {
  xmark: 26,
  checkmark: 26,
  back: 32,
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
          buttonStyle('glass'),
          buttonBorderShape('circle'),
          frame({ width: 58, height: 58, alignment: 'center' }),
          accessibilityLabel(label),
        ]}
      >
        <Icon name={SYMBOLS[icon]} size={effectiveSize} color="#FFFFFF" />
      </Button>
    </Host>
  )
}