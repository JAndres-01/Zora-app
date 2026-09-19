import { Host, Button, Icon } from '@expo/ui'
import {
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  frame,
  padding,
} from '@expo/ui/swift-ui/modifiers'
import type { SFSymbol } from 'sf-symbols-typescript'

export type GlassIconName = 'xmark' | 'checkmark'

const SYMBOLS: Record<GlassIconName, SFSymbol> = {
  xmark: 'xmark',
  checkmark: 'checkmark',
}

/**
 * Botón circular liquid glass NATIVO (SwiftUI buttonStyle `.glass` + borde circle)
 * — el mismo rendering que los botones de las apps de iOS 26.
 * El padding fijo (19pt por lado) mantiene el círculo glass en 58pt aunque el
 * icono sea pequeño, porque el glass de SwiftUI se dimensiona por el contenido.
 */
export function NativeGlassIconButton({
  onPress,
  icon,
  accessibilityLabel: label,
  disabled,
}: {
  onPress: () => void
  icon: GlassIconName
  accessibilityLabel: string
  disabled?: boolean
}) {
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
          padding({ vertical: 19, horizontal: 19 }),
          accessibilityLabel(label),
        ]}
      >
        <Icon name={SYMBOLS[icon]} size={20} color="#FFFFFF" />
      </Button>
    </Host>
  )
}