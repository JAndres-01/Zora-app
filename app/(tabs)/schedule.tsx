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
} from 'react-native'
import { BlurView } from 'expo-blur'
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
import {
  cancelTaskReminder,
  scheduleTaskReminder,
} from '@/lib/personalNotifications'
import { useRouter, useFocusEffect } from 'expo-router'
import { useCardEntrance } from '@/hooks/useCardEntrance'
import { SPRING_SLIDE_INDICATOR } from '@/constants/animations'
import { SCREEN_WIDTH } from '@/constants/layout'

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const [subjects, setSubjects] = useState<Subject[]>(() => personalStorage.getCachedSubjects())
  const [schedules, setSchedules] = useState<Schedule[]>(() => personalStorage.getCachedSchedulesWithSubjects())
  const [tasks, setTasks] = useState<Task[]>(() => personalStorage.getCachedTasksWithSubjects())
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day')

  const academicWeek = useMemo(() => getActiveAcademicWeek(), [])
  const [selectedDay, setSelectedDay] = useState<number>(academicWeek.defaultSelectedDay)

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

  // Animaciones del Switcher de Vista (Día / Semana)
  const [segmentContainerWidth, setSegmentContainerWidth] = useState(SCREEN_WIDTH - 32)
  const segmentWidth = Math.max(0, (segmentContainerWidth - 6) / 2)
  const viewModeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.spring(viewModeAnim, {
      toValue: viewMode === 'day' ? 0 : segmentWidth,
      ...SPRING_SLIDE_INDICATOR,
    }).start()
  }, [viewMode, segmentWidth, viewModeAnim])

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
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed'
    if (newStatus === 'completed') {
      cancelTaskReminder(taskId)
    } else {
      const taskObj = tasks.find((t) => t.id === taskId)
      if (taskObj) {
        const prefs = await personalStorage.getPreferences()
        scheduleTaskReminder({ ...taskObj, status: 'pending' }, prefs)
      }
    }

    const updatedTasks = tasks.map((t) =>
      t.id === taskId ? { ...t, status: newStatus as 'pending' | 'completed' } : t
    )
    setTasks(updatedTasks)
    await personalStorage.setTasks(updatedTasks)
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

  // Animaciones de Entrada Escalonada hacia abajo
  const cardEntranceAnims = useCardEntrance(2, 'schedule')

  return (
    <View style={styles.screenWrapper}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 90 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Coherente con Tareas y Hoy */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.title}>Horario</Text>
              <Text style={styles.subtitle}>{academicWeek.fullLabel}</Text>
            </View>

            <Pressable
              onPress={() => {
                triggerHaptic('light')
                setShowSubjectModal(true)
              }}
              style={styles.manageSubjBtn}
            >
              <BookOpen size={13} color="#09090B" />
              <Text style={styles.manageSubjBtnText}>Materias</Text>
            </Pressable>
          </View>
        </View>

        {/* Card 0: Segmented Control iOS con Glassmorfismo Nativo (BlurView) */}
        <Animated.View
          style={{
            opacity: cardEntranceAnims[0].interpolate({
              inputRange: [0, 0.4, 1],
              outputRange: [0, 0.7, 1],
            }),
            transform: [
              {
                translateY: cardEntranceAnims[0].interpolate({
                  inputRange: [0, 1],
                  outputRange: [-36, 0],
                }),
              },
              {
                scale: cardEntranceAnims[0].interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.96, 1],
                }),
              },
            ],
          }}
        >
          <BlurView
            intensity={Platform.OS === 'ios' ? 55 : 90}
            tint="dark"
            style={styles.segmentedContainer}
            onLayout={(e: LayoutChangeEvent) => {
              const w = e.nativeEvent.layout.width
              if (w > 0 && Math.abs(w - segmentContainerWidth) > 1) {
                setSegmentContainerWidth(w)
              }
            }}
          >
            <Animated.View
              style={[
                styles.activeSegmentPill,
                {
                  width: segmentWidth,
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
                color={viewMode === 'day' ? '#09090B' : '#A1A1AA'}
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
                color={viewMode === 'week' ? '#09090B' : '#A1A1AA'}
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
          </BlurView>
        </Animated.View>

        {/* Card 1: Vista Seleccionada (Diaria / Semanal) */}
        <Animated.View
          style={{
            opacity: cardEntranceAnims[1].interpolate({
              inputRange: [0, 0.4, 1],
              outputRange: [0, 0.7, 1],
            }),
            transform: [
              {
                translateY: cardEntranceAnims[1].interpolate({
                  inputRange: [0, 1],
                  outputRange: [-36, 0],
                }),
              },
              {
                scale: cardEntranceAnims[1].interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.96, 1],
                }),
              },
            ],
          }}
        >
          {viewMode === 'day' ? (
            <MinimalistDayView
              schedules={schedules}
              tasks={tasks}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              onOpenDayTasks={handleOpenDayTasks}
              onAssignSlot={handleOpenAssign}
            />
          ) : (
            <MinimalistWeeklyMatrix
              schedules={schedules}
              tasks={tasks}
              onAssignSlot={handleOpenAssign}
            />
          )}
        </Animated.View>
      </ScrollView>

      {/* Modal de Tareas del Día */}
      <MinimalistDayTasksModal
        visible={dayTasksModalData.visible}
        day={dayTasksModalData.day}
        subjectId={dayTasksModalData.subjectId}
        schedules={schedules}
        tasks={tasks}
        onClose={() => setDayTasksModalData((prev) => ({ ...prev, visible: false, subjectId: null }))}
        onToggleTaskStatus={handleToggleTaskStatus}
        onOpenTaskDetail={handleOpenTaskDetailFromModal}
      />

      {/* Modal de Asignar Bloque (Desde Vista Diaria) */}
      <MinimalistAssignSlotModal
        visible={assignModalData.visible}
        onClose={() => setAssignModalData((prev) => ({ ...prev, visible: false }))}
        subjects={subjects}
        initialDay={assignModalData.day}
        initialBlock={assignModalData.block}
        existingSchedule={assignModalData.existingSchedule}
        onScheduleSaved={loadData}
      />

      {/* Modal de Administrar Materias */}
      <MinimalistSubjectModal
        visible={showSubjectModal}
        onClose={() => setShowSubjectModal(false)}
        subjects={subjects}
        onSubjectsUpdated={loadData}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: '#09090B',
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
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#71717A',
    fontSize: 12.5,
    marginTop: 2,
    fontWeight: '500',
  },
  manageSubjBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5.5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 7.5,
    borderRadius: 14,
  },
  manageSubjBtnText: {
    color: '#09090B',
    fontSize: 12.5,
    fontWeight: '800',
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 3,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
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
    color: '#09090B',
    fontWeight: '800',
  },
})
