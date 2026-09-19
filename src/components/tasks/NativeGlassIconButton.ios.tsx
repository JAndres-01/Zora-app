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
 * `variant="prominent"` añade un fondo blanco muy sutil para que el botón
 * quede transparente pero un poco más claro que el default (sin tint azul).
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
        style={variant === 'prominent' ? { backgroundColor: 'rgba(255, 255, 255, 0.07)' } : undefined}
        modifiers={[
          buttonStyle('glass'),
          buttonBorderShape('circle'),
          frame({ width: 58, height: 58, alignment: 'center' }),
          accessibilityLabel(label),
        ]}
      >
        <Icon name={SYMBOLS[icon]} size={26} color="#FFFFFF" />
      </Button>
    </Host>
  )
}