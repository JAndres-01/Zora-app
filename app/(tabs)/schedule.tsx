import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Animated,
  LayoutChangeEvent,
  Platform,
  LayoutAnimation,
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
import { playConfettiSound, playTaskUndoSound } from '@/lib/personalAudio'
import { getActiveAcademicWeek } from '@/lib/academicDateUtils'
import {
  cancelTaskReminder,
  scheduleTaskReminder,
} from '@/lib/personalNotifications'
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
        <GlassView isInteractive style={styles.glassAddBtn}>
          <Pressable
            onPress={() => {
              triggerHaptic('light')
              onPress()
            }}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Materias"
            style={styles.glassAddBtnInner}
          >
            <BookOpen size={16} color="#FFFFFF" strokeWidth={2.2} />
            <Text style={styles.headerAddBtnText}>Materias</Text>
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
          accessibilityLabel="Materias"
          style={styles.headerAddBtn}
        >
          <BlurView
            intensity={Platform.OS === 'ios' ? 50 : 85}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <BookOpen size={16} color="#FFFFFF" strokeWidth={2.2} />
          <Text style={styles.headerAddBtnText}>Materias</Text>
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
  const cardEntranceAnims = useCardEntrance(2, 'schedule')

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
    triggerHaptic('selection')
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

  const handleToggleTaskStatus = useCallback(async (taskId: string, currentStatus: string) => {
    const newStatus: 'pending' | 'completed' = currentStatus === 'completed' ? 'pending' : 'completed'
    const isCompleted = newStatus === 'completed'
    const nowIso = new Date().toISOString()

    if (isCompleted) {
      cancelTaskReminder(taskId)
      personalStorage.getPreferences().then((prefs) => {
        if (prefs.confetti_enabled) {
          playConfettiSound()
        }
      })
    } else {
      playTaskUndoSound()
      const taskObj = tasks.find((t) => t.id === taskId)
      if (taskObj) {
        const prefs = await personalStorage.getPreferences()
        scheduleTaskReminder({ ...taskObj, status: 'pending' }, prefs)
      }
    }

    const updatedTasks = tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
            status: newStatus,
            completed_at: isCompleted ? nowIso : null,
            updated_at: nowIso,
          }
        : t
    )
    setTasks(updatedTasks)

    if (taskId.startsWith('class_')) {
      const classTaskId = taskId.replace('class_', '')
      await personalStorage.setClassTaskStatus(classTaskId, newStatus)
    } else {
      await personalStorage.setTasks(updatedTasks)
    }
  }, [tasks])

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

      <ScrollView
        style={styles.container}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 16) + 4,
            paddingBottom: insets.bottom + 90,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Cabecera iOS con Large Title y Botón Materias */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.titleColumn}>
              <Text style={styles.title}>Horario</Text>
              <Text style={styles.subtitle}>
                {isConnected && !isAdmin ? `Clase • ${academicWeek.fullLabel}` : academicWeek.fullLabel}
              </Text>
            </View>

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

        {/* Card 0: Segmented Control iOS Minimalista y Ultrarrápido */}
        <Animated.View style={getCardEntranceStyle(cardEntranceAnims[0])}>
          <View style={styles.segmentedContainer}>
            <BlurView
              intensity={Platform.OS === 'ios' ? 50 : 85}
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

        {/* Card 1: Vista Seleccionada (Diaria / Semanal) */}
        <Animated.View style={getCardEntranceStyle(cardEntranceAnims[1])}>
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
      </ScrollView>

      {/* Modal de Tareas del Día */}
      <MinimalistDayTasksModal
        visible={dayTasksModalData.visible}
        day={dayTasksModalData.day}
        subjectId={dayTasksModalData.subjectId}
        schedules={activeSchedules}
        tasks={tasks}
        onClose={() => setDayTasksModalData((prev) => ({ ...prev, visible: false, subjectId: null }))}
        onToggleTaskStatus={handleToggleTaskStatus}
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
  header: {
    paddingHorizontal: 2,
    marginBottom: 4,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleColumn: {
    gap: 3,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: {
    color: '#A1A1AA',
    fontSize: 13.5,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  glassAddBtn: {
    height: 40,
    borderRadius: 20,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassAddBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 15,
    height: 40,
    borderRadius: 20,
    borderCurve: 'continuous',
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 15,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  headerAddBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#000000',
    padding: 3,
    borderRadius: 15,
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
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
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
  },
  segmentButtonTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
})
