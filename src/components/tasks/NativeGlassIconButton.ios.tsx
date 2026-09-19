import { Host, Button, Icon } from '@expo/ui'
import {
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  frame,
} from '@expo/ui/swift-ui/modifiers'
import type { SFSymbol } from 'sf-symbols-typescript'

export type GlassIconName = 'xmark' | 'checkmark'

export type GlassIconVariant = 'default' | 'prominent'

const SYMBOLS: Record<GlassIconName, SFSymbol> = {
  xmark: 'xmark',
  checkmark: 'checkmark',
}

/**
 * Botón circular liquid glass NATIVO (SwiftUI buttonStyle `.glass` + borde circle)
 * — el mismo rendering que los botones de las apps de iOS 26.
 * `variant="prominent"` usa `.glassProminent`, el glass relleno más brillante
 * (para resaltar la acción principal).
 */
export function NativeGlassIconButton({
  onPress,
  icon,
  accessibilityLabel: label,
  disabled,
  variant = 'default',
}: {
  onPress: () => void
  icon: GlassIconName
  accessibilityLabel: string
  disabled?: boolean
  variant?: GlassIconVariant
}) {
  return (
    <Host matchContents>
      <Button
        variant="outlined"
        onPress={onPress}
        disabled={disabled}
        modifiers={[
          buttonStyle(variant === 'prominent' ? 'glassProminent' : 'glass'),
          buttonBorderShape('circle'),
          frame({ width: 48, height: 48, alignment: 'center' }),
          accessibilityLabel(label),
        ]}
      >
        <Icon name={SYMBOLS[icon]} size={22} color="#FFFFFF" />
      </Button>
    </Host>
  )
}