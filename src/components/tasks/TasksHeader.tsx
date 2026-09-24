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
import { MenuView, type MenuAction } from '@react-native-menu/menu'
import { TasksSubjectFilterModal } from './TasksSubjectFilterModal'
import type { Subject, Task } from '@/types/personal'
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
          {Platform.OS === 'ios' && (
            <BlurView
              intensity={50}
              tint="light"
              style={StyleSheet.absoluteFill}
            />
          )}
          <Plus size={20} color="#18181B" strokeWidth={2.4} />
        </Pressable>
      )}
    </Animated.View>
  )
}

export function GlassFilterSearchPill({
  selectedSubject,
  selectedSubjectId,
  subjects,
  tasks,
  onSelectSubject,
  onOpenSearch,
}: {
  selectedSubject: Subject | null
  selectedSubjectId: string
  subjects: Subject[]
  tasks: Task[]
  onSelectSubject: (id: string) => void
  onOpenSearch: () => void
}) {
  const [reduceTransparency, setReduceTransparency] = useState(false)
  const scaleAnim = useRef(new Animated.Value(1)).current
  const [showFilterModal, setShowFilterModal] = useState(false)
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

  // La píldora entera escala al presionar; cada icono conserva su propia acción.
  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.94,
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

  // Acciones del menú nativo: "Todas las materias" + cada materia con su color.
  // En iOS se usan SF Symbols coloreados; en Android se omiten para evitar fallos de recursos.
  const subjectFilterActions: MenuAction[] = [
    {
      id: 'all',
      title: 'Todas las materias',
      image: Platform.OS === 'ios' ? 'square.grid.2x2' : undefined,
      imageColor: '#FFFFFF',
      state: selectedSubjectId === 'all' ? 'on' : 'off',
    },
    ...subjects.map((subj) => {
      const count = tasks.filter(
        (t) =>
          t.subject_id === subj.id ||
          t.subject?.id === subj.id ||
          (t.subject?.name &&
            t.subject.name.trim().toLowerCase() === subj.name.trim().toLowerCase())
      ).length
      return {
        id: subj.id,
        title: subj.name,
        subtitle: count > 0 ? `${count} tarea${count !== 1 ? 's' : ''}` : undefined,
        image: Platform.OS === 'ios' ? 'circle.fill' : undefined,
        imageColor: subj.color || '#FFFFFF',
        state: selectedSubjectId === subj.id ? 'on' : 'off',
      } satisfies MenuAction
    }),
  ]

  const filterIcon = (
    <>
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
    </>
  )

  // iOS: context menu nativo; Android/Web: TasksSubjectFilterModal modal bottom sheet
  const filterZone =
    Platform.OS === 'ios' ? (
      <MenuView
        title="Filtrar por Materia"
        shouldOpenOnLongPress={false}
        themeVariant="dark"
        actions={subjectFilterActions}
        onPressAction={({ nativeEvent }) => {
          triggerHaptic('selection')
          onSelectSubject(nativeEvent.event)
        }}
      >
        <View
          style={styles.pillZone}
          accessibilityRole="button"
          accessibilityLabel="Filtrar materias"
        >
          {filterIcon}
        </View>
      </MenuView>
    ) : (
      <Pressable
        onPress={() => {
          triggerHaptic('light')
          setShowFilterModal(true)
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Filtrar materias"
        style={styles.pillZone}
      >
        {filterIcon}
      </Pressable>
    )

  const searchZone = (
    <Pressable
      onPress={() => {
        triggerHaptic('light')
        onOpenSearch()
      }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Buscar tareas"
      style={styles.pillZone}
    >
      <Search size={19} color="#FFFFFF" strokeWidth={2.2} />
    </Pressable>
  )

  const divider = <View style={styles.pillDivider} pointerEvents="none" />

  return (
    <>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        {useGlass ? (
          <GlassView isInteractive style={styles.pillGlass}>
            {filterZone}
            {divider}
            {searchZone}
          </GlassView>
        ) : (
          <View style={styles.pillBlur}>
            {Platform.OS === 'ios' && (
              <BlurView
                intensity={50}
                tint="dark"
                style={StyleSheet.absoluteFill}
              />
            )}
            {filterZone}
            {divider}
            {searchZone}
          </View>
        )}
      </Animated.View>
      {Platform.OS !== 'ios' && (
        <TasksSubjectFilterModal
          visible={showFilterModal}
          subjects={subjects}
          tasks={tasks}
          selectedSubjectId={selectedSubjectId}
          onSelectSubject={onSelectSubject}
          onClose={() => setShowFilterModal(false)}
        />
      )}
    </>
  )
}

export interface TasksHeaderProps {
  cardEntranceAnim?: Animated.Value
  largeTitleOpacity?: Animated.AnimatedInterpolation<number>
  scrollY?: Animated.Value
}

export function TasksHeader({
  cardEntranceAnim,
  largeTitleOpacity,
  scrollY,
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

  // Colapso dinámico del título: si scrollY existe, interpolar directo de scrollY para evitar cadenas de interpolación en Android
  const titleCollapseY = scrollY
    ? scrollY.interpolate({
        inputRange: [4, 45],
        outputRange: [0, -24],
        extrapolate: 'clamp',
      })
    : largeTitleOpacity?.interpolate({
        inputRange: [0, 1],
        outputRange: [-24, 0],
        extrapolate: 'clamp',
      })

  const titleCollapseScale = scrollY
    ? scrollY.interpolate({
        inputRange: [4, 45],
        outputRange: [1, 0.92],
        extrapolate: 'clamp',
      })
    : largeTitleOpacity?.interpolate({
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
  pillGlass: {
    width: 92,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  pillBlur: {
    width: 92,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: Platform.OS === 'android' ? '#18181B' : 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    overflow: 'hidden',
  },
  pillZone: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pillDivider: {
    width: StyleSheet.hairlineWidth,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
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
    backgroundColor: Platform.OS === 'android' ? '#18181B' : 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    overflow: 'hidden',
  },
  blurBtnWhite: {
    // Variante blanca del botón "+" (fallback sin liquid glass: blanco nítido)
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
})
