import { useRef } from 'react'
import type { ComponentType } from 'react'
import { Animated, Pressable, StyleSheet, View } from 'react-native'
import { BlurView } from 'expo-blur'
import { Check, X } from 'lucide-react-native'

export type GlassIconName = 'xmark' | 'checkmark'

export type GlassIconVariant = 'default' | 'prominent'

const ICON_MAP: Record<
  GlassIconName,
  ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
> = {
  xmark: X,
  checkmark: Check,
}

/**
 * Fallback para Android/web: botón circular liquid glass aproximado
 * (BlurView + tinte translúcido + sheen). En iOS se usa la versión nativa
 * (`NativeGlassIconButton.ios.tsx`) con SwiftUI.
 * `variant="prominent"` aclara el fondo para resaltar la acción principal.
 */
export function NativeGlassIconButton({
  onPress,
  icon,
  accessibilityLabel,
  disabled,
  variant = 'default',
}: {
  onPress: () => void
  icon: GlassIconName
  accessibilityLabel: string
  disabled?: boolean
  variant?: GlassIconVariant
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
        <BlurView intensity={prominent ? 34 : 26} tint="dark" style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={styles.glassSheen} />
        <Icon size={22} color={disabled ? '#8E8E93' : '#FFFFFF'} />
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  glassButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
  },
  glassButtonProminent: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderColor: 'rgba(255, 255, 255, 0.32)',
  },
  glassSheen: {
    position: 'absolute',
    top: 5,
    left: 8,
    width: 32,
    height: 11,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    transform: [{ rotate: '16deg' }],
  },
})