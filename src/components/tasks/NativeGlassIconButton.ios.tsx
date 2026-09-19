import { StyleSheet, View } from 'react-native'
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
 * `variant="prominent"` añade una capa circular RN sutil DETRÁS del botón para
 * que la palomita quede transparente pero un poco más clara que la X
 * (el fondo del propio Button nativo NO se usa: crearía un relleno cuadrado).
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
  const button = (
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
        <Icon name={SYMBOLS[icon]} size={26} color="#FFFFFF" />
      </Button>
    </Host>
  )

  if (variant === 'prominent') {
    return <View style={styles.prominentHalo}>{button}</View>
  }
  return button
}

const styles = StyleSheet.create({
  prominentHalo: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
})