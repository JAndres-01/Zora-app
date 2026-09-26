import { useRef } from 'react'
import type { ComponentType } from 'react'
import { Animated, Pressable, StyleSheet, View, Platform } from 'react-native'
import { BlurView } from 'expo-blur'
import { Check, ChevronLeft, Images, MoreHorizontal, X } from 'lucide-react-native'

export type GlassIconName = 'xmark' | 'checkmark' | 'back' | 'ellipsis' | 'photos'

export type GlassIconVariant = 'default' | 'prominent'

const DEFAULT_ICON_SIZE: Record<GlassIconName, number> = {
  xmark: 17,
  checkmark: 17,
  back: 19,
  ellipsis: 22,
  photos: 18,
}

const ICON_MAP: Record<
  GlassIconName,
  ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
> = {
  xmark: X,
  checkmark: Check,
  back: ChevronLeft,
  ellipsis: MoreHorizontal,
  photos: Images,
}

/**
 * Fallback para Android/web: botón circular con acabado limpio y nítido.
 * En iOS se usa la versión nativa (`NativeGlassIconButton.ios.tsx`) con SwiftUI.
 * En Android/web, evita BlurView y brillos diagonales que difuminan el icono.
 */
export function NativeGlassIconButton({
  onPress,
  icon,
  accessibilityLabel,
  disabled,
  variant = 'default',
  iconSize,
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
  const effectiveSize = iconSize ?? DEFAULT_ICON_SIZE[icon]
  const isIOS = Platform.OS === 'ios'

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
        {isIOS && (
          <>
            <BlurView intensity={prominent ? 30 : 26} tint="dark" style={StyleSheet.absoluteFill} />
            <View pointerEvents="none" style={styles.glassSheen} />
          </>
        )}
        <Icon size={effectiveSize} color={disabled ? '#8E8E93' : '#FFFFFF'} strokeWidth={2.4} />
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  glassButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    overflow: 'hidden',
  },
  glassButtonProminent: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderColor: 'rgba(255, 255, 255, 0.28)',
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