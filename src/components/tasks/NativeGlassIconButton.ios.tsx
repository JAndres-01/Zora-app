import { useState, useEffect, useRef } from 'react'
import type { ComponentType } from 'react'
import {
  View,
  Pressable,
  StyleSheet,
  Animated,
  AccessibilityInfo,
  Platform,
} from 'react-native'
import { BlurView } from 'expo-blur'
import {
  GlassView,
  isLiquidGlassAvailable,
  isGlassEffectAPIAvailable,
} from 'expo-glass-effect'
import { Check, ChevronLeft, Images, MoreHorizontal, X } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'

export type GlassIconName = 'xmark' | 'checkmark' | 'back' | 'ellipsis' | 'photos'

export type GlassIconVariant = 'default' | 'prominent'

const DEFAULT_ICON_SIZE: Record<GlassIconName, number> = {
  xmark: 20,
  checkmark: 20,
  back: 22,
  ellipsis: 22,
  photos: 20,
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

const GLASS_AVAILABLE =
  Platform.OS === 'ios' &&
  typeof isLiquidGlassAvailable === 'function' &&
  isLiquidGlassAvailable() &&
  typeof isGlassEffectAPIAvailable === 'function' &&
  isGlassEffectAPIAvailable()

/**
 * Botón circular liquid glass para cabeceras modales en iOS.
 * Tamaño 44×44 nativo centrado en slot de 58×58, con renderizado síncrono en frame 0.
 */
export function NativeGlassIconButton({
  onPress,
  icon,
  accessibilityLabel: label,
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
  const [reduceTransparency, setReduceTransparency] = useState(false)
  const scaleAnim = useRef(new Animated.Value(1)).current
  const IconComponent = ICON_MAP[icon]
  const effectiveSize = iconSize ?? DEFAULT_ICON_SIZE[icon]
  const prominent = variant === 'prominent'

  useEffect(() => {
    let active = true
    AccessibilityInfo.isReduceTransparencyEnabled().then((val) => {
      if (active) setReduceTransparency(val)
    })
    return () => {
      active = false
    }
  }, [])

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.88,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start()
  }

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start()
  }

  const useGlass = GLASS_AVAILABLE && !reduceTransparency

  return (
    <View style={styles.buttonWrapper}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        {useGlass ? (
          <GlassView
            isInteractive
            colorScheme="dark"
            style={[styles.glassButton, prominent && styles.glassButtonProminent]}
          >
            <Pressable
              onPress={() => {
                if (disabled) return
                triggerHaptic('light')
                onPress()
              }}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              disabled={disabled}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={label}
              style={styles.innerPressable}
            >
              <IconComponent
                size={effectiveSize}
                color={disabled ? '#8E8E93' : '#FFFFFF'}
                strokeWidth={2.4}
              />
            </Pressable>
          </GlassView>
        ) : (
          <Pressable
            onPress={() => {
              if (disabled) return
              triggerHaptic('light')
              onPress()
            }}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={disabled}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={[styles.blurButton, prominent && styles.blurButtonProminent]}
          >
            <BlurView
              intensity={prominent ? 32 : 28}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
            <View pointerEvents="none" style={styles.glassSheen} />
            <IconComponent
              size={effectiveSize}
              color={disabled ? '#8E8E93' : '#FFFFFF'}
              strokeWidth={2.4}
            />
          </Pressable>
        )}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  buttonWrapper: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassButtonProminent: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  innerPressable: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blurButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    overflow: 'hidden',
  },
  blurButtonProminent: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  glassSheen: {
    position: 'absolute',
    top: 7,
    left: 11,
    width: 44,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    transform: [{ rotate: '16deg' }],
  },
})