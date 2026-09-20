import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  LayoutChangeEvent,
  Platform,
  Keyboard,
  AccessibilityInfo,
} from 'react-native'
import { BlurView } from 'expo-blur'
import {
  GlassView,
  isLiquidGlassAvailable,
  isGlassEffectAPIAvailable,
} from 'expo-glass-effect'
import { personalStorage, subscribeToPersonalStorage } from '@/lib/personalStorage'
import type { Schedule, Subject, Task } from '@/types/personal'
import { MinimalistDayView } from '@/components/schedule/MinimalistDayView'
import { MinimalistWeeklyMatrix } from '@/components/schedule/MinimalistWeeklyMatrix'
import { MinimalistSubjectModal } from '@/components/schedule/MinimalistSubjectModal'
import { MinimalistAssignSlotModal } from '@/components/schedule/MinimalistAssignSlotModal'
import { MinimalistDayTasksModal } from '@/components/schedule/MinimalistDayTasksModal'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LayoutGrid, CalendarDays, BookOpen } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'
import { getActiveAcademicWeek } from '@/lib/academicDateUtils'
import { Stack, useRouter, useFocusEffect } from 'expo-router'
import { useCardEntrance, getCardEntranceStyle } from '@/hooks/useCardEntrance'
import { SPRING_SLIDE_INDICATOR } from '@/constants/animations'
import { SCREEN_WIDTH } from '@/constants/layout'
import { useClassAuth } from '@/context/ClassAuthContext'

const GLASS_AVAILABLE =
  Platform.OS === 'ios' &&
  typeof isLiquidGlassAvailable === 'function' &&
  isLiquidGlassAvailable() &&
  typeof isGlassEffectAPIAvailable === 'function' &&
  isGlassEffectAPIAvailable()

function GlassSubjectButton({ onPress }: { onPress: () => void }) {
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
            accessibilityLabel="Gestionar materias"
            style={styles.glassBtnInner}
          >
            <BookOpen size={20} color="#18181B" strokeWidth={2.2} />
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
          accessibilityLabel="Gestionar materias"
          style={[styles.blurBtn, styles.blurBtnWhite]}
        >
          <BlurView
            intensity={Platform.OS === 'ios' ? 50 : 85}
            tint="light"
            style={StyleSheet.absoluteFill}
          />
          <BookOpen size={20} color="#18181B" strokeWidth={2.2} />
        </Pressable>
      )}
    </Animated.View>
  )
}

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const {
    isConnected,
    isAdmin,
    classSubjects,
    classSchedules,
    saveClassSubject,
    deleteClassSubject,
    assignClassScheduleSlot,
    clearClassScheduleSlot,
    syncClassSchedule,
  } = useClassAuth()

  const [subjects, setSubjects] = useState<Subject[]>(() => personalStorage.getCachedSubjects())
  const [schedules, setSchedules] = useState<Schedule[]>(() => personalStorage.getCachedSchedulesWithSubjects())
  const [tasks, setTasks] = useState<Task[]>(() => personalStorage.getCachedTasksWithSubjects())
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day')

  const academicWeek = useMemo(() => getActiveAcademicWeek(), [])
  const [selectedDay, setSelectedDay] = useState<number>(academicWeek.defaultSelectedDay)

  const activeSubjects = useMemo(() => {
    if (isConnected && classSubjects && classSubjects.length > 0) return classSubjects
    return subjects
  }, [isConnected, classSubjects, subjects])

  const activeSchedules = useMemo(() => {
    if (isConnected && classSchedules && classSchedules.length > 0) return classSchedules
    return schedules
  }, [isConnected, classSchedules, schedules])

  const canEdit = !isConnected || isAdmin

  // Modales
  const [showSubjectModal, setShowSubjectModal] = useState(false)
  const [assignModalData, setAssignModalData] = useState<{
    visible: boolean
    day: number
    block: number
    existingSchedule?: Schedule | null
  }>({
    visible: false,
    day: 1,
    block: 1,
    existingSchedule: null,
  })

  // Modal de Tareas del Día (Minimalista y Rápido)
  const [dayTasksModalData, setDayTasksModalData] = useState<{
    visible: boolean
    day: number
    subjectId?: string | null
  }>({
    visible: false,
    day: academicWeek.defaultSelectedDay,
    subjectId: null,
  })

  // Animaciones de Entrada Escalonada
  const cardEntranceAnims = useCardEntrance(3, 'schedule')

  // Colapso del header estilo Apple Notes / WhatsApp (sincronizado con el scroll).
  // El título grande se esconde justo cuando la barra fija toca su borde inferior.
  const scrollY = useRef(new Animated.Value(0)).current

  const headerBgOpacity = scrollY.interpolate({
    inputRange: [18, 38],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  })

  const compactTitleOpacity = scrollY.interpolate({
    inputRange: [40, 60],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  })

  const compactTitleTranslateY = scrollY.interpolate({
    inputRange: [40, 60],
    outputRange: [6, 0],
    extrapolate: 'clamp',
  })

  const largeTitleOpacity = scrollY.interpolate({
    inputRange: [4, 45],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  })

  const titleCollapseY = largeTitleOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [-24, 0],
    extrapolate: 'clamp',
  })

  const titleCollapseScale = largeTitleOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
    extrapolate: 'clamp',
  })

  // Dimensiones estáticas para evitar saltos y re-renderizados innecesarios por onLayout
  const SEGMENT_CONTAINER_WIDTH = SCREEN_WIDTH - 32
  const SEGMENT_WIDTH = Math.max(0, (SEGMENT_CONTAINER_WIDTH - 6) / 2)
  const viewModeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.spring(viewModeAnim, {
      toValue: viewMode === 'day' ? 0 : SEGMENT_WIDTH,
      ...SPRING_SLIDE_INDICATOR,
    }).start()
  }, [viewMode, SEGMENT_WIDTH, viewModeAnim])

  const handleViewModeChange = (mode: 'day' | 'week') => {
    if (mode === viewMode) return
    setViewMode(mode)
  }

  const loadData = useCallback(async () => {
    const [resolvedScheds, cachedSubjs, resolvedTasks] = await Promise.all([
      personalStorage.getSchedulesWithSubjects(),
      personalStorage.getSubjects(),
      personalStorage.getTasksWithSubjects(),
    ])

    setSchedules(resolvedScheds)
    setSubjects(cachedSubjs)
    setTasks(resolvedTasks)
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [loadData])
  )

  useEffect(() => {
    const unsubscribe = subscribeToPersonalStorage(() => {
      loadData()
    })
    return unsubscribe
  }, [loadData])

  const handleOpenAssign = useCallback((day: number, block: number, existingSchedule?: Schedule | null) => {
    triggerHaptic('light')
    setAssignModalData({
      visible: true,
      day,
      block,
      existingSchedule: existingSchedule || null,
    })
  }, [])

  const handleOpenDayTasks = useCallback((day: number, subjectId?: string | null) => {
    triggerHaptic('light')
    setDayTasksModalData({
      visible: true,
      day,
      subjectId: subjectId || null,
    })
  }, [])

  const handleOpenTaskDetailFromModal = useCallback((task: Task) => {
    triggerHaptic('light')
    setDayTasksModalData((prev) => ({ ...prev, visible: false }))
    setTimeout(() => {
      router.navigate({
        pathname: '/(tabs)/tasks',
        params: {
          taskId: task.id,
        },
      })
    }, 120)
  }, [router])

  return (
    <View style={styles.screenWrapper}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Barra de Navegación Sticky Superior (estilo Apple Notes / WhatsApp) */}
      <View
        pointerEvents="box-none"
        style={[
          styles.stickyHeaderBar,
          {
            height: insets.top + 56,
            paddingTop: insets.top,
          },
        ]}
      >
        {/* Fondo Translúcido con Transición en Scroll */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: headerBgOpacity }]}
          pointerEvents="none"
        >
          <BlurView
            intensity={Platform.OS === 'ios' ? 75 : 90}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.stickyHeaderBorder} />
        </Animated.View>

        {/* Contenido: título compacto centrado + botón Materias a la derecha */}
        <View style={styles.stickyHeaderContent} pointerEvents="box-none">
          <View style={styles.stickyHeaderLeft} />

          <Animated.View
            style={[
              styles.compactTitleWrapper,
              {
                opacity: compactTitleOpacity,
                transform: [{ translateY: compactTitleTranslateY }],
              },
            ]}
            pointerEvents="none"
          >
            <Text style={styles.compactTitle}>Horario</Text>
          </Animated.View>

          <View style={styles.stickyHeaderRight}>
            {canEdit && (
              <GlassSubjectButton
                onPress={() => {
                  triggerHaptic('light')
                  setShowSubjectModal(true)
                }}
              />
            )}
          </View>
        </View>
      </View>

      <Animated.ScrollView
        style={styles.container}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 60,
            paddingBottom: insets.bottom + 90,
          },
        ]}
        showsVerticalScrollIndicator={false}
        bounces
        alwaysBounceVertical
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => Keyboard.dismiss()}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
      >
        {/* Cabecera iOS: Large Title colapsable + semana académica */}
        <Animated.View style={getCardEntranceStyle(cardEntranceAnims[0])}>
          <Animated.View
            style={[
              styles.titleCoverBlock,
              {
                opacity: largeTitleOpacity,
                transform: [
                  { translateY: titleCollapseY },
                  { scale: titleCollapseScale },
                ],
              },
            ]}
          >
            <Text style={styles.title}>Horario</Text>
            <Text style={styles.subtitle}>
              {isConnected && !isAdmin ? `Clase • ${academicWeek.fullLabel}` : academicWeek.fullLabel}
            </Text>
          </Animated.View>
        </Animated.View>

        {/* Card 1: Segmented Control iOS Minimalista y Ultrarrápido */}
        <Animated.View style={getCardEntranceStyle(cardEntranceAnims[1])}>
          <View style={styles.segmentedContainer}>
            <BlurView
              intensity={Platform.OS === 'ios' ? 55 : 90}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
            <Animated.View
              style={[
                styles.activeSegmentPill,
                {
                  width: SEGMENT_WIDTH,
                  transform: [{ translateX: viewModeAnim }],
                },
              ]}
            />

            <Pressable
              onPressIn={() => handleViewModeChange('day')}
              style={styles.segmentButton}
            >
              <CalendarDays
                size={13.5}
                color={viewMode === 'day' ? '#000000' : '#A1A1AA'}
              />
              <Text
                style={[
                  styles.segmentButtonText,
                  viewMode === 'day' && styles.segmentButtonTextActive,
                ]}
              >
                Vista Diaria
              </Text>
            </Pressable>

            <Pressable
              onPressIn={() => handleViewModeChange('week')}
              style={styles.segmentButton}
            >
              <LayoutGrid
                size={13.5}
                color={viewMode === 'week' ? '#000000' : '#A1A1AA'}
              />
              <Text
                style={[
                  styles.segmentButtonText,
                  viewMode === 'week' && styles.segmentButtonTextActive,
                ]}
              >
                Matriz Semanal
              </Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Card 2: Vista Seleccionada (Diaria / Semanal) */}
        <Animated.View style={getCardEntranceStyle(cardEntranceAnims[2])}>
          {viewMode === 'day' ? (
            <MinimalistDayView
              schedules={activeSchedules}
              tasks={tasks}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              onOpenDayTasks={handleOpenDayTasks}
              onAssignSlot={canEdit ? handleOpenAssign : undefined}
            />
          ) : (
            <MinimalistWeeklyMatrix
              schedules={activeSchedules}
              tasks={tasks}
              onAssignSlot={canEdit ? handleOpenAssign : undefined}
              onOpenDayTasks={handleOpenDayTasks}
            />
          )}
        </Animated.View>
      </Animated.ScrollView>

      {/* Modal de Tareas del Día */}
      <MinimalistDayTasksModal
        visible={dayTasksModalData.visible}
        day={dayTasksModalData.day}
        subjectId={dayTasksModalData.subjectId}
        schedules={activeSchedules}
        tasks={tasks}
        onClose={() => setDayTasksModalData((prev) => ({ ...prev, visible: false, subjectId: null }))}
        onOpenTaskDetail={handleOpenTaskDetailFromModal}
      />

      {/* Modal de Asignar Bloque (Desde Vista Diaria) */}
      <MinimalistAssignSlotModal
        visible={assignModalData.visible}
        onClose={() => setAssignModalData((prev) => ({ ...prev, visible: false }))}
        subjects={activeSubjects}
        initialDay={assignModalData.day}
        initialBlock={assignModalData.block}
        existingSchedule={assignModalData.existingSchedule}
        onScheduleSaved={loadData}
        onSaveSlotCustom={isConnected && isAdmin ? assignClassScheduleSlot : undefined}
        onClearSlotCustom={isConnected && isAdmin ? ((slotId) => clearClassScheduleSlot(slotId)) : undefined}
      />

      {/* Modal de Administrar Materias */}
      <MinimalistSubjectModal
        visible={showSubjectModal}
        onClose={() => setShowSubjectModal(false)}
        subjects={activeSubjects}
        onSubjectsUpdated={loadData}
        onSaveSubjectCustom={isConnected && isAdmin ? saveClassSubject : undefined}
        onDeleteSubjectCustom={isConnected && isAdmin ? deleteClassSubject : undefined}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: '#000000',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    gap: 16,
  },
  // ─── Barra sticky superior ───
  stickyHeaderBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  stickyHeaderBorder: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  stickyHeaderContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  stickyHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactTitleWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  compactTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  stickyHeaderRight: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  // ─── Cabecera Large Title colapsable ───
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
  subtitle: {
    color: '#A1A1AA',
    fontSize: 13.5,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginTop: 3,
  },
  // ─── Botón circular glass (variante blanca, acción principal) ───
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
  glassBtnWhite: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderColor: 'rgba(255, 255, 255, 1)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderColor: 'rgba(255, 255, 255, 0.7)',
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#000000',
    padding: 3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    position: 'relative',
    height: 42,
    alignItems: 'center',
    overflow: 'hidden',
  },
  activeSegmentPill: {
    position: 'absolute',
    left: 3,
    top: 3,
    bottom: 3,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: '100%',
    zIndex: 1,
  },
  segmentButtonText: {
    color: '#71717A',
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  segmentButtonTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
})
