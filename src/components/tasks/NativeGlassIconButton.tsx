import { useRef } from 'react'
import type { ComponentType } from 'react'
import { Animated, Pressable, StyleSheet, View } from 'react-native'
import { BlurView } from 'expo-blur'
import { ArrowLeft, Check, X } from 'lucide-react-native'

export type GlassIconName = 'xmark' | 'checkmark' | 'arrowleft'

export type GlassIconVariant = 'default' | 'prominent'

const ICON_MAP: Record<
  GlassIconName,
  ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
> = {
  xmark: X,
  checkmark: Check,
  arrowleft: ArrowLeft,
}

/**
 * Fallback para Android/web: botón circular liquid glass aproximado
 * (BlurView + tinte translúcido + sheen). En iOS se usa la versión nativa
 * (`NativeGlassIconButton.ios.tsx`) con SwiftUI.
 * `variant="prominent"` aclara apenas el fondo (transparente, un poco más
 * claro que el default) para resaltar la acción principal.
 */
export function NativeGlassIconButton({
  onPress,
  icon,
  accessibilityLabel,
  disabled,
  variant = 'default',
  iconSize = 26,
}: {
  onPress: () => void
  icon: GlassIconName
  accessibilityLabel: string
  disabled?: boolean
  variant?: GlassIconVariant
  iconSize?: number
}) {
  const scale = useRef(new Animated.Value(1)).current
  const Icon = ICON_MAP[icon]
  const prominent = variant === 'prominent'
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() =>
          Animated.spring(scale, {
            toValue: 0.88,
            stiffness: 600,
            damping: 18,
            useNativeDriver: true,
          }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, {
            toValue: 1,
            stiffness: 400,
            damping: 20,
            useNativeDriver: true,
          }).start()
        }
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        hitSlop={8}
        style={[styles.glassButton, prominent && styles.glassButtonProminent]}
      >
        <BlurView intensity={prominent ? 30 : 26} tint="dark" style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={styles.glassSheen} />
        <Icon size={iconSize} color={disabled ? '#8E8E93' : '#FFFFFF'} />
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  glassButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
  },
  glassButtonProminent: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderColor: 'rgba(255, 255, 255, 0.26)',
  },
  glassSheen: {
    position: 'absolute',
    top: 6,
    left: 10,
    width: 38,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    transform: [{ rotate: '16deg' }],
  },
})