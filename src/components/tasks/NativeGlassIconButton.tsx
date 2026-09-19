import { useRef } from 'react'
import type { ComponentType } from 'react'
import { Animated, Pressable, StyleSheet, View } from 'react-native'
import { BlurView } from 'expo-blur'
import { Check, X } from 'lucide-react-native'

export type GlassIconName = 'xmark' | 'checkmark'

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
 */
export function NativeGlassIconButton({
  onPress,
  icon,
  accessibilityLabel,
  disabled,
}: {
  onPress: () => void
  icon: GlassIconName
  accessibilityLabel: string
  disabled?: boolean
}) {
  const scale = useRef(new Animated.Value(1)).current
  const Icon = ICON_MAP[icon]
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
        style={styles.glassButton}
      >
        <BlurView intensity={26} tint="dark" style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={styles.glassSheen} />
        <Icon size={20} color={disabled ? '#8E8E93' : '#FFFFFF'} />
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  glassButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
  },
  glassSheen: {
    position: 'absolute',
    top: 4,
    left: 7,
    width: 30,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    transform: [{ rotate: '16deg' }],
  },
})