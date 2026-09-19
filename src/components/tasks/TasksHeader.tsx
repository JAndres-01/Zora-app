import { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Platform,
  AccessibilityInfo,
} from 'react-native'
import { BlurView } from 'expo-blur'
import {
  GlassView,
  isLiquidGlassAvailable,
  isGlassEffectAPIAvailable,
} from 'expo-glass-effect'
import { SlidersHorizontal, Plus, Search } from 'lucide-react-native'
import type { Subject } from '@/types/personal'
import { isWhiteColor } from '@/constants/theme'
import { triggerHaptic } from '@/lib/personalHaptics'

const GLASS_AVAILABLE =
  Platform.OS === 'ios' &&
  typeof isLiquidGlassAvailable === 'function' &&
  isLiquidGlassAvailable() &&
  typeof isGlassEffectAPIAvailable === 'function' &&
  isGlassEffectAPIAvailable()

export function GlassAddTaskButton({ onPress }: { onPress: () => void }) {
  const [reduceTransparency, setReduceTransparency] = useState(false)
  const scaleAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (Platform.OS !== 'ios') return
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
      toValue: 0.9,
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
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      {useGlass ? (
        <GlassView
          isInteractive
          colorScheme="light"
          style={[styles.glassBtn, styles.glassBtnWhite]}
        >
          <Pressable
            onPress={() => {
              triggerHaptic('medium')
              onPress()
            }}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Nueva tarea"
            style={styles.glassBtnInner}
          >
            <Plus size={20} color="#18181B" strokeWidth={2.4} />
          </Pressable>
        </GlassView>
      ) : (
        <Pressable
          onPress={() => {
            triggerHaptic('medium')
            onPress()
          }}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Nueva tarea"
          style={[styles.blurBtn, styles.blurBtnWhite]}
        >
          <BlurView
            intensity={Platform.OS === 'ios' ? 50 : 85}
            tint="light"
            style={StyleSheet.absoluteFill}
          />
          <Plus size={20} color="#18181B" strokeWidth={2.4} />
        </Pressable>
      )}
    </Animated.View>
  )
}

export function GlassSubjectIconButton({
  selectedSubject,
  selectedSubjectId,
  onPress,
}: {
  selectedSubject: Subject | null
  selectedSubjectId: string
  onPress: () => void
}) {
  const [reduceTransparency, setReduceTransparency] = useState(false)
  const scaleAnim = useRef(new Animated.Value(1)).current
  const isSelectedWhite = isWhiteColor(selectedSubject?.color)

  useEffect(() => {
    if (Platform.OS !== 'ios') return
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
      toValue: 0.9,
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
  const hasFilter = selectedSubjectId !== 'all'

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      {useGlass ? (
        <GlassView isInteractive style={[styles.glassBtn, hasFilter && styles.glassBtnActive]}>
          <Pressable
            onPress={() => {
              triggerHaptic('selection')
              onPress()
            }}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Filtrar materias"
            style={styles.glassBtnInner}
          >
            <SlidersHorizontal size={19} color="#FFFFFF" strokeWidth={2.2} />
            {hasFilter && selectedSubject && (
              <View
                style={[
                  styles.filterActiveDot,
                  { backgroundColor: selectedSubject.color || '#FFFFFF' },
                  isSelectedWhite && styles.whiteDotBorder,
                ]}
              />
            )}
          </Pressable>
        </GlassView>
      ) : (
        <Pressable
          onPress={() => {
            triggerHaptic('selection')
            onPress()
          }}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Filtrar materias"
          style={[styles.blurBtn, hasFilter && styles.glassBtnActive]}
        >
          <BlurView
            intensity={Platform.OS === 'ios' ? 50 : 85}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <SlidersHorizontal size={19} color="#FFFFFF" strokeWidth={2.2} />
          {hasFilter && selectedSubject && (
            <View
              style={[
                styles.filterActiveDot,
                { backgroundColor: selectedSubject.color || '#FFFFFF' },
                isSelectedWhite && styles.whiteDotBorder,
              ]}
            />
          )}
        </Pressable>
      )}
    </Animated.View>
  )
}

export function GlassSearchButton({ onPress }: { onPress: () => void }) {
  const [reduceTransparency, setReduceTransparency] = useState(false)
  const scaleAnim = useRef(new Animated.Value(0.4)).current

  // Pop de entrada: cada vez que la barra reaparece (al cerrar el buscador) la
  // lupa "brota" con un resorte desde escala pequeña.
  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 12,
    }).start()
  }, [scaleAnim])

  useEffect(() => {
    if (Platform.OS !== 'ios') return
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
      toValue: 0.82,
      useNativeDriver: true,
      speed: 30,
      bounciness: 2,
    }).start()
  }

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 25,
      bounciness: 12,
    }).start()
  }

  const useGlass = GLASS_AVAILABLE && !reduceTransparency

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      {useGlass ? (
        <GlassView isInteractive style={styles.glassBtn}>
          <Pressable
            onPress={() => {
              triggerHaptic('light')
              onPress()
            }}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Buscar tareas"
            style={styles.glassBtnInner}
          >
            <Search size={19} color="#FFFFFF" strokeWidth={2.2} />
          </Pressable>
        </GlassView>
      ) : (
        <Pressable
          onPress={() => {
            triggerHaptic('light')
            onPress()
          }}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Buscar tareas"
          style={styles.blurBtn}
        >
          <BlurView
            intensity={Platform.OS === 'ios' ? 50 : 85}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <Search size={19} color="#FFFFFF" strokeWidth={2.2} />
        </Pressable>
      )}
    </Animated.View>
  )
}

export interface TasksHeaderProps {
  cardEntranceAnim?: Animated.Value
  largeTitleOpacity?: Animated.AnimatedInterpolation<number>
}

export function TasksHeader({
  cardEntranceAnim,
  largeTitleOpacity,
}: TasksHeaderProps) {
  const card0Style = cardEntranceAnim
    ? {
        opacity: cardEntranceAnim.interpolate({
          inputRange: [0, 0.4, 1],
          outputRange: [0, 0.7, 1],
        }),
        transform: [
          {
            translateY: cardEntranceAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-24, 0],
            }),
          },
          {
            scale: cardEntranceAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.97, 1],
            }),
          },
        ],
      }
    : {}

  // Colapso dinámico del título: al esconderse sube y encoge hacia la barra
  // (sincronizado con la opacidad, que a su vez sigue el scroll).
  const titleCollapseY = largeTitleOpacity?.interpolate({
    inputRange: [0, 1],
    outputRange: [-24, 0],
    extrapolate: 'clamp',
  })
  const titleCollapseScale = largeTitleOpacity?.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
    extrapolate: 'clamp',
  })

  return (
    <View style={styles.headerContainer}>
      <Animated.View style={card0Style}>
        {/* Bloque del Título (se desvanece al hacer scroll para dar paso a la barra compacta) */}
        <Animated.View
          style={[
            styles.titleCoverBlock,
            largeTitleOpacity !== undefined && { opacity: largeTitleOpacity },
            titleCollapseY !== undefined && {
              transform: [
                { translateY: titleCollapseY },
                { scale: titleCollapseScale ?? 1 },
              ],
            },
          ]}
        >
          <Text style={styles.title}>Tareas</Text>
        </Animated.View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  headerContainer: {
    marginBottom: 8,
    position: 'relative',
  },
  titleCoverBlock: {
    backgroundColor: '#000000',
    zIndex: 20,
    paddingHorizontal: 2,
    marginBottom: 2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  glassBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 6,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassBtnInner: {
    width: 44,
    height: 44,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassBtnActive: {
    borderColor: 'rgba(255, 255, 255, 0.35)',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  glassBtnWhite: {
    // Variante del botón "+": material glass CLARO (colorScheme="light") teñido
    // de blanco. Sin colorScheme="light" el material hereda el dark mode y el
    // blanco translúcido encima se ve gris.
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderColor: 'rgba(255, 255, 255, 1)',
  },
  filterActiveDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  whiteDotBorder: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  blurBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    overflow: 'hidden',
  },
  blurBtnWhite: {
    // Variante blanca del botón "+" (fallback sin liquid glass: blur claro)
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderColor: 'rgba(255, 255, 255, 0.7)',
  },
})
